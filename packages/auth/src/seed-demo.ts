import { createDb } from "@educa-escola/db";
import {
  assessment,
  attendance,
  classroom,
  grade,
  lesson,
  member,
  organization,
  school,
  student,
  subject,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { eq } from "drizzle-orm";

import { auth } from "./index";
import {
  ALUNA_COM_ACESSO,
  absencesFor,
  assignTeachers,
  buildClassrooms,
  DEMO_TERM,
  DEMO_YEAR,
  type DemoClassroom,
  DIRETORA,
  DISCIPLINAS,
  NOTAS_DO_ROTEIRO,
  type Person,
  PROFESSOR_DEMO,
  PROFESSORES,
  SECRETARIA,
  scoreFor,
  spreadIndexes,
  timetableOf,
} from "./seed-demo-data";

/**
 * Popula uma escola de demonstração com dados coerentes entre si.
 *
 * Serve para apresentação e para desenvolvimento: sem isso o app sobe vazio e
 * nenhuma tela tem o que mostrar. Os dados são fictícios e seguem os mockups
 * de `docs/design/` — mesmos nomes de turma, disciplina e aluno, para que a
 * comparação tela × PNG seja direta.
 *
 * **As aulas são geradas em torno da data de execução**, não em datas fixas:
 * "Aulas de hoje" precisa ter conteúdo no dia em que a demonstração acontece.
 *
 * Idempotente pelo slug: rodar de novo em cima da mesma escola apaga o que
 * havia e regrava, para o estado de demonstração ser sempre o mesmo.
 *
 * O que é fictício e o que é regra: as notas e as faltas são inventadas, mas
 * frequência, média e situação saem das mesmas funções que o app usa em
 * produção. Nenhum número desta escola é escrito direto na tela.
 */

export const DEMO_SLUG = "dom-pedro-ii";
export const DEMO_PASSWORD = "integra2026";
export { DEMO_TERM, DEMO_YEAR } from "./seed-demo-data";

/** Nove semanas de histórico e uma semana de grade à frente. */
const DIAS_PARA_TRAS = 63;
const DIAS_PARA_FRENTE = 7;

/**
 * Chamadas em atraso por professor, contadas a partir da aula mais recente.
 *
 * O Ricardo tem **exatamente uma** porque é o número que o roteiro ensaia: o
 * painel dele abre com uma pendência, ele registra, e o contador zera. Os
 * outros existem para o painel da direção ter uma fila de cobrança de verdade
 * em vez de uma linha só.
 */
const CHAMADAS_EM_ATRASO: Record<string, number> = {
  [PROFESSOR_DEMO.email]: 1,
  "helena.diniz@dompedroii.edu.br": 4,
  "tiago.pecanha@dompedroii.edu.br": 3,
  "douglas.prata@dompedroii.edu.br": 2,
  "vanessa.lobo@dompedroii.edu.br": 2,
};

const CONTEUDOS = [
  "Equações do 2º grau: fórmula de Bhaskara e cálculo do discriminante.",
  "Resolução de exercícios 14 a 22 da apostila, em duplas.",
  "Sistemas de equações: método da substituição.",
  "Revisão para a prova bimestral: exercícios comentados.",
  "Função quadrática: leitura e construção do gráfico.",
];

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** Dias letivos (segunda a sexta) de `from` até `to`, inclusive. */
function schoolDays(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    const weekday = cursor.getUTCDay();
    if (weekday >= 1 && weekday <= 5) days.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * Insere em lotes.
 *
 * A escola gera dezenas de milhares de linhas de chamada, e um `insert` único
 * estoura o limite de parâmetros de uma instrução do Postgres.
 */
async function insertInBatches<T>(
  rows: T[],
  size: number,
  write: (batch: T[]) => Promise<unknown>,
): Promise<number> {
  for (let offset = 0; offset < rows.length; offset += size) {
    await write(rows.slice(offset, offset + size));
  }
  return rows.length;
}

async function ensureUser(db: DbHandle, person: Person): Promise<string> {
  const existing = await db.query.user.findFirst({
    where: (table, { eq: is }) => is(table.email, person.email),
  });
  if (existing) return existing.id;

  const created = await auth.api.signUpEmail({
    body: { name: person.name, email: person.email, password: DEMO_PASSWORD },
  });
  return created.user.id;
}

export interface SeedResult {
  schoolId: string;
  logins: { perfil: string; email: string; senha: string }[];
  counts: {
    turmas: number;
    alunos: number;
    professores: number;
    disciplinas: number;
    aulas: number;
    chamadas: number;
    notas: number;
  };
}

export async function seedDemoSchool(): Promise<SeedResult> {
  const db = createDb();

  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, DEMO_SLUG))
    .limit(1);

  const schoolId = existing?.id ?? crypto.randomUUID();

  if (!existing) {
    await db.insert(organization).values({
      id: schoolId,
      name: "E. M. Dom Pedro II",
      slug: DEMO_SLUG,
      createdAt: new Date(),
    });
    await db.insert(school).values({ id: schoolId, inepCode: "35012345" });
  } else {
    // Regravar do zero mantém a demonstração previsível. As cascatas de
    // `school_id` limpam aula, chamada, avaliação e nota junto com o aluno.
    await db.delete(student).where(eq(student.schoolId, schoolId));
    await db.delete(lesson).where(eq(lesson.schoolId, schoolId));
    await db.delete(assessment).where(eq(assessment.schoolId, schoolId));
    await db.delete(subject).where(eq(subject.schoolId, schoolId));
    await db.delete(classroom).where(eq(classroom.schoolId, schoolId));
  }

  // ---- Pessoas ----
  const people: Person[] = [DIRETORA, SECRETARIA, ...PROFESSORES];
  const userIds = new Map<string, string>();
  for (const person of people) {
    userIds.set(person.email, await ensureUser(db, person));
  }
  userIds.set(
    ALUNA_COM_ACESSO.email,
    await ensureUser(db, { ...ALUNA_COM_ACESSO, role: "student" }),
  );

  for (const person of [...people, { ...ALUNA_COM_ACESSO, role: "student" as const }]) {
    const userId = userIds.get(person.email) as string;
    const already = await db.query.member.findFirst({
      where: (table, { and: both, eq: is }) =>
        both(is(table.organizationId, schoolId), is(table.userId, userId)),
    });
    if (already) continue;
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: schoolId,
      userId,
      role: person.role,
      createdAt: new Date(),
    });
  }

  // ---- Disciplinas e turmas ----
  const subjectIds = new Map<string, string>();
  for (const name of DISCIPLINAS) {
    const [row] = await db.insert(subject).values({ schoolId, name }).returning({ id: subject.id });
    subjectIds.set(name, (row as { id: string }).id);
  }

  const turmas = buildClassrooms();
  const classroomIds = new Map<string, string>();
  const studentIds = new Map<string, string>();
  let alunos = 0;

  for (const turma of turmas) {
    const [row] = await db
      .insert(classroom)
      .values({ schoolId, name: turma.name, academicYear: DEMO_YEAR })
      .returning({ id: classroom.id });
    const classroomId = (row as { id: string }).id;
    classroomIds.set(turma.name, classroomId);

    const rows = turma.students.map((person) => ({
      schoolId,
      classroomId,
      userId:
        person.name === ALUNA_COM_ACESSO.name
          ? (userIds.get(ALUNA_COM_ACESSO.email) as string)
          : null,
      id: crypto.randomUUID(),
      name: person.name,
      registration: person.registration,
      shift: turma.shift,
      guardianName: person.guardian,
      status: person.status ?? ("ativo" as const),
    }));

    await insertInBatches(rows, 500, (batch) => db.insert(student).values(batch));
    for (const row of rows) studentIds.set(row.registration, row.id);
    alunos += rows.length;
  }

  // ---- Grade horária e alocação de professores ----
  const timetables = turmas.map((turma, index) => ({
    name: turma.name,
    shift: turma.shift,
    timetable: timetableOf(index, turma.shift, turma.room),
  }));
  const assignment = assignTeachers(timetables);

  const { lessonRows, recordedByClassroom } = buildLessons({
    schoolId,
    turmas,
    timetables,
    classroomIds,
    subjectIds,
    userIds,
    assignment,
  });

  await insertInBatches(lessonRows, 400, (batch) => db.insert(lesson).values(batch));

  // ---- Chamadas ----
  const attendanceRows: (typeof attendance.$inferInsert)[] = [];

  for (const turma of turmas) {
    const classroomId = classroomIds.get(turma.name) as string;
    const aulas = recordedByClassroom.get(classroomId) ?? [];

    turma.students.forEach((person, seat) => {
      const studentId = studentIds.get(person.registration) as string;
      const { absences, lates } = absencesFor(person, aulas.length);
      const faltas = spreadIndexes(aulas.length, absences, seat);
      const atrasos = spreadIndexes(aulas.length, lates, seat + 3);

      aulas.forEach((lessonId, index) => {
        const status = faltas.has(index)
          ? "falta"
          : atrasos.has(index)
            ? "atraso"
            : ("presente" as const);
        attendanceRows.push({ schoolId, lessonId, studentId, status });
      });
    });
  }

  await insertInBatches(attendanceRows, 1000, (batch) => db.insert(attendance).values(batch));

  const chamadas = [...recordedByClassroom.values()].reduce((sum, ids) => sum + ids.length, 0);

  // ---- Avaliações e notas ----
  const notas = await seedAssessments({
    db,
    schoolId,
    turmas,
    classroomIds,
    subjectIds,
    studentIds,
    userIds,
    assignment,
  });

  return {
    schoolId,
    logins: [
      { perfil: "Gestão (diretora)", email: DIRETORA.email, senha: DEMO_PASSWORD },
      { perfil: "Professor", email: PROFESSOR_DEMO.email, senha: DEMO_PASSWORD },
      { perfil: "Aluna", email: ALUNA_COM_ACESSO.email, senha: DEMO_PASSWORD },
    ],
    counts: {
      turmas: turmas.length,
      alunos,
      professores: PROFESSORES.length,
      disciplinas: DISCIPLINAS.length,
      aulas: lessonRows.length,
      chamadas,
      notas,
    },
  };
}

/**
 * Monta as aulas do período e decide, já na criação, quais ficam sem chamada.
 *
 * Decidir aqui em vez de atualizar depois não é detalhe: seriam milhares de
 * `UPDATE` de uma linha só, e o seed passaria de segundos a minutos.
 */
function buildLessons(input: {
  schoolId: string;
  turmas: DemoClassroom[];
  timetables: { name: string; timetable: ReturnType<typeof timetableOf> }[];
  classroomIds: Map<string, string>;
  subjectIds: Map<string, string>;
  userIds: Map<string, string>;
  assignment: Map<string, string>;
}) {
  const { schoolId, turmas, timetables, classroomIds, subjectIds, userIds, assignment } = input;

  const today = new Date(`${isoDate(new Date())}T00:00:00Z`);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - DIAS_PARA_TRAS);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + DIAS_PARA_FRENTE);
  const todayIso = isoDate(today);

  const dias = schoolDays(start, end);
  const lessonRows: (typeof lesson.$inferInsert)[] = [];
  /** Aulas passadas por professor, para escolher quais ficam pendentes. */
  const pastByTeacher = new Map<string, { id: string; order: string }[]>();

  for (const turma of turmas) {
    const horario = timetables.find((item) => item.name === turma.name)?.timetable ?? [];
    const classroomId = classroomIds.get(turma.name) as string;

    for (const day of dias) {
      const weekday = day.getUTCDay();
      const date = isoDate(day);

      for (const slot of horario.filter((item) => item.weekday === weekday)) {
        const teacherEmail = assignment.get(`${turma.name}|${slot.subject}`);
        const teacherId = teacherEmail ? userIds.get(teacherEmail) : undefined;
        if (!teacherId || !teacherEmail) continue;

        const id = crypto.randomUUID();
        lessonRows.push({
          id,
          schoolId,
          classroomId,
          subjectId: subjectIds.get(slot.subject) as string,
          teacherId,
          date,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          room: slot.room,
        });

        if (date < todayIso) {
          const list = pastByTeacher.get(teacherEmail) ?? [];
          list.push({ id, order: `${date} ${slot.startsAt}` });
          pastByTeacher.set(teacherEmail, list);
        }
      }
    }
  }

  // As pendências são sempre as aulas mais recentes do professor: cobrar uma
  // aula de dois meses atrás e não a de ontem não se parece com a realidade.
  const pending = new Set<string>();
  for (const [email, quantidade] of Object.entries(CHAMADAS_EM_ATRASO)) {
    const aulas = (pastByTeacher.get(email) ?? []).sort((a, b) => a.order.localeCompare(b.order));
    for (const aula of aulas.slice(-quantidade)) pending.add(aula.id);
  }

  const recordedAt = new Date();
  const recordedByClassroom = new Map<string, string[]>();
  const diario = [...(pastByTeacher.get(PROFESSOR_DEMO.email) ?? [])]
    .sort((a, b) => a.order.localeCompare(b.order))
    .slice(-(CONTEUDOS.length + 1), -1)
    .map((aula) => aula.id);

  for (const row of lessonRows) {
    const id = row.id as string;
    const conteudo = diario.indexOf(id);
    if (conteudo >= 0) row.content = CONTEUDOS[conteudo];

    if ((row.date as string) >= todayIso || pending.has(id)) continue;

    row.attendanceRecordedAt = recordedAt;
    const list = recordedByClassroom.get(row.classroomId) ?? [];
    list.push(id);
    recordedByClassroom.set(row.classroomId, list);
  }

  return { lessonRows, recordedByClassroom };
}

/**
 * Avaliações e notas de todas as turmas, em todas as disciplinas.
 *
 * Cada turma recebe a média fechada do bimestre anterior — é ela que dá a
 * barra de comparação do painel do professor — mais três avaliações do
 * bimestre corrente.
 */
async function seedAssessments(input: {
  db: DbHandle;
  schoolId: string;
  turmas: DemoClassroom[];
  classroomIds: Map<string, string>;
  subjectIds: Map<string, string>;
  studentIds: Map<string, string>;
  userIds: Map<string, string>;
  assignment: Map<string, string>;
}): Promise<number> {
  const { db, schoolId, turmas, classroomIds, subjectIds, studentIds, userIds, assignment } = input;

  const hoje = new Date();
  const dataDe = (offset: number) => {
    const value = new Date(hoje);
    value.setUTCDate(value.getUTCDate() + offset);
    return isoDate(value);
  };

  const assessmentRows: (typeof assessment.$inferInsert)[] = [];
  const gradeRows: (typeof grade.$inferInsert)[] = [];

  for (const [turmaIndex, turma] of turmas.entries()) {
    const classroomId = classroomIds.get(turma.name) as string;

    for (const [subjectIndex, subjectName] of DISCIPLINAS.entries()) {
      const teacherEmail = assignment.get(`${turma.name}|${subjectName}`);
      const teacherId = teacherEmail ? userIds.get(teacherEmail) : undefined;
      if (!teacherId) continue;

      const doRoteiro = turma.name === "8º A" && subjectName === PROFESSOR_DEMO.subject;

      /**
       * A Prova 2 fica em rascunho — e com lançamento faltando — no 8º A de
       * Matemática, que é o caso da apresentação, e em alguns outros pares
       * para a fila de cobrança da direção não ter uma linha só. Nunca em
       * outra turma do professor da demonstração: a pendência dele é a do
       * roteiro, e só.
       */
      const pendente =
        doRoteiro ||
        (teacherEmail !== PROFESSOR_DEMO.email && (turmaIndex * 5 + subjectIndex) % 13 === 0);

      const definicoes = [
        {
          name: `Média do ${DEMO_TERM - 1}º bimestre`,
          weight: 1,
          term: DEMO_TERM - 1,
          status: "publicada" as const,
          appliedOn: null,
        },
        {
          name: "Prova 1",
          weight: 4,
          term: DEMO_TERM,
          status: "publicada" as const,
          appliedOn: dataDe(-28),
        },
        {
          name: "Trabalho em grupo",
          weight: 3,
          term: DEMO_TERM,
          status: "publicada" as const,
          appliedOn: dataDe(-12),
        },
        {
          name: "Prova 2",
          weight: 3,
          term: DEMO_TERM,
          status: pendente ? ("rascunho" as const) : ("publicada" as const),
          appliedOn: dataDe(-4),
        },
      ];

      const ids = definicoes.map(() => crypto.randomUUID());

      definicoes.forEach((definicao, index) => {
        assessmentRows.push({
          id: ids[index] as string,
          schoolId,
          classroomId,
          subjectId: subjectIds.get(subjectName) as string,
          teacherId,
          name: definicao.name,
          weight: definicao.weight,
          term: definicao.term,
          appliedOn: definicao.appliedOn,
          status: definicao.status,
          publishedAt: definicao.status === "publicada" ? hoje : null,
        });
      });

      turma.students.forEach((person, seat) => {
        const studentId = studentIds.get(person.registration);
        if (!studentId) return;

        // Aluno transferido não recebe lançamento do bimestre corrente: ele
        // não está mais na sala.
        if (person.status === "transferido") return;

        const escritas = doRoteiro ? NOTAS_DO_ROTEIRO[person.registration] : undefined;

        /**
         * Só a Prova 2 fica sem lançamento, e só nas duas últimas carteiras:
         * as outras duas avaliações já estão publicadas, e avaliação
         * publicada com buraco é justamente o que o app não deixa existir.
         */
        const notas = [1, 2, 3].map((assessmentIndex, position) => {
          if (escritas) return escritas[position] ?? null;
          const ultima = position === definicoes.length - 2;
          if (pendente && ultima && seat >= turma.students.length - 2) return null;
          return scoreFor(seat, subjectIndex, assessmentIndex, person.aptitude);
        });

        const lancadas = notas.filter((value): value is number => value !== null);
        const media = lancadas.reduce((sum, value) => sum + value, 0) / (lancadas.length || 1);

        // O bimestre anterior fica 0,7 abaixo do atual: a comparação do
        // gráfico precisa de diferença visível, e a evolução é a história.
        gradeRows.push({
          schoolId,
          assessmentId: ids[0] as string,
          studentId,
          score: Math.min(10, Math.max(0, Math.round((media - 0.7) * 10) / 10)),
        });

        notas.forEach((score, position) => {
          if (score === null) return;
          gradeRows.push({
            schoolId,
            assessmentId: ids[position + 1] as string,
            studentId,
            score,
          });
        });
      });
    }
  }

  await insertInBatches(assessmentRows, 400, (batch) => db.insert(assessment).values(batch));
  await insertInBatches(gradeRows, 1000, (batch) => db.insert(grade).values(batch));

  return gradeRows.length;
}
