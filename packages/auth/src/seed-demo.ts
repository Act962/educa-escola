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
import { eq } from "drizzle-orm";

import { auth } from "./index";

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
 */

export const DEMO_SLUG = "dom-pedro-ii";
export const DEMO_PASSWORD = "integra2026";
export const DEMO_YEAR = new Date().getFullYear();
/** Bimestre em foco na demonstração. */
export const DEMO_TERM = 3;

interface Person {
  name: string;
  email: string;
  role: "owner" | "admin" | "teacher" | "student";
}

const DIRETORA: Person = {
  name: "Marina Duarte",
  email: "marina.duarte@dompedroii.edu.br",
  role: "owner",
};

const PROFESSORES: (Person & { subject: string })[] = [
  {
    name: "Ricardo Alves",
    email: "ricardo.alves@dompedroii.edu.br",
    role: "teacher",
    subject: "Matemática",
  },
  {
    name: "Helena Diniz",
    email: "helena.diniz@dompedroii.edu.br",
    role: "teacher",
    subject: "Língua Portuguesa",
  },
  {
    name: "Marcos Aurélio",
    email: "marcos.aurelio@dompedroii.edu.br",
    role: "teacher",
    subject: "Ciências",
  },
  {
    name: "Cláudia Reis",
    email: "claudia.reis@dompedroii.edu.br",
    role: "teacher",
    subject: "História",
  },
];

const ALUNA_COM_ACESSO = {
  name: "Ana Clara Souza Lima",
  email: "ana.clara@aluno.dompedroii.edu.br",
};

interface StudentSeed {
  name: string;
  registration: string;
  guardian: string;
  /** Faltas no ano. É daqui que sai o percentual de frequência da tela. */
  absences: number;
  lates?: number;
  status?: "ativo" | "documentacao_pendente" | "transferido";
}

const TURMAS: { name: string; shift: "manha" | "tarde"; students: StudentSeed[] }[] = [
  {
    name: "8º A",
    shift: "manha",
    students: [
      {
        name: "Ana Clara Souza Lima",
        registration: `${DEMO_YEAR}-0301`,
        guardian: "Roberta Souza Lima",
        absences: 3,
      },
      {
        name: "Beatriz Macedo Rocha",
        registration: `${DEMO_YEAR}-0305`,
        guardian: "Marcos Macedo Rocha",
        absences: 2,
      },
      {
        name: "Caio Esteves Portela",
        registration: `${DEMO_YEAR}-0309`,
        guardian: "Luciana Esteves",
        absences: 6,
      },
      {
        name: "Davi Fontes Xavier",
        registration: `${DEMO_YEAR}-0312`,
        guardian: "Sandra Fontes",
        absences: 14,
      },
      {
        name: "Eduarda Mendes Vieira",
        registration: `${DEMO_YEAR}-0318`,
        guardian: "Paulo Mendes Vieira",
        absences: 0,
      },
      {
        name: "Gabriel Tavares Pinto",
        registration: `${DEMO_YEAR}-0323`,
        guardian: "Renata Tavares",
        absences: 4,
        lates: 2,
      },
      {
        name: "Helena Lacerda Guedes",
        registration: `${DEMO_YEAR}-0327`,
        guardian: "Cristina Lacerda",
        absences: 2,
        status: "documentacao_pendente",
      },
    ],
  },
  {
    name: "9º B",
    shift: "manha",
    students: [
      {
        name: "Alice Barreto Nunes",
        registration: `${DEMO_YEAR}-0412`,
        guardian: "Fernanda Barreto",
        absences: 3,
      },
      {
        name: "Bruno Carvalho Dias",
        registration: `${DEMO_YEAR}-0418`,
        guardian: "Marcos Carvalho Dias",
        absences: 1,
      },
      {
        name: "Júlia Moraes Ribeiro",
        registration: `${DEMO_YEAR}-0427`,
        guardian: "Vera Moraes",
        absences: 15,
      },
      {
        name: "Lucas Ferreira Gomes",
        registration: `${DEMO_YEAR}-0433`,
        guardian: "Antônio Ferreira",
        absences: 2,
        lates: 4,
      },
      {
        name: "Mariana Pinheiro Costa",
        registration: `${DEMO_YEAR}-0441`,
        guardian: "Sílvia Pinheiro",
        absences: 0,
      },
      {
        name: "Pedro Lins Andrade",
        registration: `${DEMO_YEAR}-0449`,
        guardian: "Rui Andrade",
        absences: 8,
      },
      {
        name: "Rafael Santana Melo",
        registration: `${DEMO_YEAR}-0455`,
        guardian: "Denise Santana",
        absences: 1,
      },
      {
        name: "Sofia Vasconcelos Braga",
        registration: `${DEMO_YEAR}-0460`,
        guardian: "Jorge Vasconcelos",
        absences: 0,
      },
    ],
  },
  {
    name: "7º C",
    shift: "tarde",
    students: [
      {
        name: "Igor Nascimento Braga",
        registration: `${DEMO_YEAR}-0331`,
        guardian: "Fábio Nascimento",
        absences: 4,
      },
      {
        name: "Laura Antunes Prado",
        registration: `${DEMO_YEAR}-0336`,
        guardian: "Camila Antunes",
        absences: 1,
      },
      {
        name: "Miguel Rocha Teixeira",
        registration: `${DEMO_YEAR}-0340`,
        guardian: "Eduardo Teixeira",
        absences: 2,
      },
      {
        name: "Nina Barbosa Freire",
        registration: `${DEMO_YEAR}-0344`,
        guardian: "Patrícia Freire",
        absences: 0,
      },
      {
        name: "Otávio Campos Nunes",
        registration: `${DEMO_YEAR}-0349`,
        guardian: "Hélio Campos",
        absences: 5,
      },
    ],
  },
];

/**
 * Grade semanal do professor de Matemática: dia da semana (1 = segunda) e
 * horário. Três aulas por dia útil — é o que faz o "Aulas de hoje" do
 * dashboard ter conteúdo em qualquer dia em que a demonstração aconteça.
 */
const HORARIO: Record<
  string,
  { weekday: number; startsAt: string; endsAt: string; room: string }[]
> = {
  "8º A": [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startsAt: "07:30",
    endsAt: "08:20",
    room: "Sala 12",
  })),
  "9º B": [1, 2, 3, 4, 5].map((weekday) => ({
    weekday,
    startsAt: "08:20",
    endsAt: "09:10",
    room: "Sala 12",
  })),
  "7º C": [1, 2, 3, 4].map((weekday) => ({
    weekday,
    startsAt: "10:00",
    endsAt: "10:50",
    room: "Sala 08",
  })),
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
 * Espalha `count` faltas pelas `total` aulas, sem sorteio.
 *
 * Aleatoriedade tornaria cada execução do seed diferente, e uma demonstração
 * que muda de número a cada rodada é impossível de ensaiar.
 */
function spreadIndexes(total: number, count: number, offset = 0): Set<number> {
  const picked = new Set<number>();
  if (count <= 0 || total <= 0) return picked;
  for (let k = 0; k < Math.min(count, total); k += 1) {
    picked.add((Math.floor((k * total) / Math.min(count, total)) + offset) % total);
  }
  return picked;
}

async function ensureUser(person: Person): Promise<string> {
  const db = createDb();
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
  counts: { alunos: number; aulas: number; chamadas: number; notas: number };
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

  const people = [DIRETORA, ...PROFESSORES];
  const userIds = new Map<string, string>();
  for (const person of people) {
    userIds.set(person.email, await ensureUser(person));
  }
  userIds.set(ALUNA_COM_ACESSO.email, await ensureUser({ ...ALUNA_COM_ACESSO, role: "student" }));

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

  const subjectIds = new Map<string, string>();
  for (const name of [...new Set(PROFESSORES.map((p) => p.subject))]) {
    const [row] = await db.insert(subject).values({ schoolId, name }).returning({ id: subject.id });
    subjectIds.set(name, (row as { id: string }).id);
  }

  const classroomIds = new Map<string, string>();
  const studentIds = new Map<string, string>();
  let alunos = 0;

  for (const turma of TURMAS) {
    const [row] = await db
      .insert(classroom)
      .values({ schoolId, name: turma.name, academicYear: DEMO_YEAR })
      .returning({ id: classroom.id });
    const classroomId = (row as { id: string }).id;
    classroomIds.set(turma.name, classroomId);

    for (const person of turma.students) {
      const [created] = await db
        .insert(student)
        .values({
          schoolId,
          classroomId,
          userId:
            person.name === ALUNA_COM_ACESSO.name
              ? (userIds.get(ALUNA_COM_ACESSO.email) as string)
              : null,
          name: person.name,
          registration: person.registration,
          shift: turma.shift,
          guardianName: person.guardian,
          status: person.status ?? "ativo",
        })
        .returning({ id: student.id });
      studentIds.set(person.registration, (created as { id: string }).id);
      alunos += 1;
    }
  }

  // ---- Aulas: dois meses para trás e uma semana para a frente ----
  const today = new Date(`${isoDate(new Date())}T00:00:00Z`);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 63);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + 7);

  const matematica = PROFESSORES[0] as (typeof PROFESSORES)[number];
  const teacherId = userIds.get(matematica.email) as string;
  const subjectId = subjectIds.get(matematica.subject) as string;

  const lessonRows: (typeof lesson.$inferInsert)[] = [];
  for (const turma of TURMAS) {
    const grid = HORARIO[turma.name] ?? [];
    for (const day of schoolDays(start, end)) {
      const weekday = day.getUTCDay();
      for (const slot of grid.filter((item) => item.weekday === weekday)) {
        lessonRows.push({
          schoolId,
          classroomId: classroomIds.get(turma.name) as string,
          subjectId,
          teacherId,
          date: isoDate(day),
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          room: slot.room,
        });
      }
    }
  }

  const inserted = await db
    .insert(lesson)
    .values(lessonRows)
    .returning({ id: lesson.id, date: lesson.date, classroomId: lesson.classroomId });

  const todayIso = isoDate(today);

  /**
   * Uma aula passada fica sem chamada de propósito: é a pendência que o
   * dashboard do professor e o painel da Gestão precisam ter o que mostrar.
   */
  const past = inserted.filter((row) => row.date < todayIso);
  const skipped = past.at(-1);

  let chamadas = 0;
  const attendanceRows: (typeof attendance.$inferInsert)[] = [];

  for (const turma of TURMAS) {
    const classroomId = classroomIds.get(turma.name) as string;
    const turmaLessons = past
      .filter((row) => row.classroomId === classroomId && row.id !== skipped?.id)
      .sort((a, b) => a.date.localeCompare(b.date));

    turma.students.forEach((person, personIndex) => {
      const studentId = studentIds.get(person.registration) as string;
      const faltas = spreadIndexes(turmaLessons.length, person.absences, personIndex);
      const atrasos = spreadIndexes(turmaLessons.length, person.lates ?? 0, personIndex + 3);

      turmaLessons.forEach((row, index) => {
        const status = faltas.has(index)
          ? "falta"
          : atrasos.has(index)
            ? "atraso"
            : ("presente" as const);
        attendanceRows.push({ schoolId, lessonId: row.id, studentId, status });
      });
    });

    chamadas += turmaLessons.length;
  }

  for (let offset = 0; offset < attendanceRows.length; offset += 500) {
    await db.insert(attendance).values(attendanceRows.slice(offset, offset + 500));
  }

  const recorded = new Set(past.filter((row) => row.id !== skipped?.id).map((row) => row.id));
  for (const row of inserted) {
    if (recorded.has(row.id)) {
      await db
        .update(lesson)
        .set({ attendanceRecordedAt: new Date() })
        .where(eq(lesson.id, row.id));
    }
  }

  // Diário preenchido nas aulas mais recentes, para a tela de chamada não
  // abrir sempre em branco.
  const recentes = past.slice(-CONTEUDOS.length);
  for (const [index, row] of recentes.entries()) {
    await db.update(lesson).set({ content: CONTEUDOS[index] }).where(eq(lesson.id, row.id));
  }

  // ---- Avaliações e notas ----
  const notas = await seedAssessments({
    db,
    schoolId,
    teacherId,
    subjectId,
    classroomIds,
    studentIds,
  });

  return {
    schoolId,
    logins: [
      { perfil: "Gestão (diretora)", email: DIRETORA.email, senha: DEMO_PASSWORD },
      { perfil: "Professor", email: matematica.email, senha: DEMO_PASSWORD },
      { perfil: "Aluna", email: ALUNA_COM_ACESSO.email, senha: DEMO_PASSWORD },
    ],
    counts: { alunos, aulas: inserted.length, chamadas, notas },
  };
}

/** Notas por turma. O 8º A fica com uma prova em rascunho e sem lançamento. */
const NOTAS_POR_TURMA: Record<string, Record<string, [number, number, number | null]>> = {
  "8º A": {
    "-0301": [8.5, 9, 7.5],
    "-0305": [7, 8, 6.5],
    "-0309": [5, 6, null],
    "-0312": [4, 5.5, 4.5],
    "-0318": [9.5, 9.5, 10],
    "-0323": [6.5, 7.5, 7],
    "-0327": [8, 7, null],
  },
  "9º B": {
    "-0412": [7.5, 8, 7],
    "-0418": [8, 7.5, 8.5],
    "-0427": [4, 3.5, 4],
    "-0433": [6, 6.5, 6],
    "-0441": [9, 8.5, 9],
    "-0449": [4.5, 4, 3.5],
    "-0455": [7, 7.5, 7],
    "-0460": [8.5, 9, 8],
  },
  "7º C": {
    "-0331": [8, 8.5, 8],
    "-0336": [9, 8, 8.5],
    "-0340": [7.5, 7, 8],
    "-0344": [9.5, 9, 9.5],
    "-0349": [6.5, 6, 7],
  },
};

async function seedAssessments(input: {
  db: ReturnType<typeof createDb>;
  schoolId: string;
  teacherId: string;
  subjectId: string;
  classroomIds: Map<string, string>;
  studentIds: Map<string, string>;
}): Promise<number> {
  const { db, schoolId, teacherId, subjectId } = input;
  const rows: (typeof grade.$inferInsert)[] = [];

  const byRegistrationSuffix = (suffix: string) =>
    [...input.studentIds.entries()].find(([registration]) => registration.endsWith(suffix))?.[1];

  for (const [turmaName, notas] of Object.entries(NOTAS_POR_TURMA)) {
    const classroomId = input.classroomIds.get(turmaName);
    if (!classroomId) continue;

    // Bimestre anterior, já fechado: é ele que dá a barra de comparação do
    // gráfico "média por turma" no dashboard do professor.
    const [anterior] = await db
      .insert(assessment)
      .values({
        schoolId,
        classroomId,
        subjectId,
        teacherId,
        name: `Média do ${DEMO_TERM - 1}º bimestre`,
        weight: 1,
        term: DEMO_TERM - 1,
        status: "publicada",
        publishedAt: new Date(),
      })
      .returning({ id: assessment.id });

    /**
     * Duas avaliações publicadas e uma em rascunho. É esse rascunho que
     * demonstra as duas regras: o aluno não vê a nota, e publicar com aluno
     * sem lançamento é recusado.
     */
    const definicoes = [
      { name: "Prova 1", weight: 4, status: "publicada" as const, offset: -28 },
      { name: "Trabalho em grupo", weight: 3, status: "publicada" as const, offset: -12 },
      { name: "Prova 2", weight: 3, status: "rascunho" as const, offset: -4 },
    ];

    const criadas: string[] = [];
    for (const definicao of definicoes) {
      const appliedOn = new Date();
      appliedOn.setUTCDate(appliedOn.getUTCDate() + definicao.offset);

      const [row] = await db
        .insert(assessment)
        .values({
          schoolId,
          classroomId,
          subjectId,
          teacherId,
          name: definicao.name,
          weight: definicao.weight,
          term: DEMO_TERM,
          appliedOn: isoDate(appliedOn),
          status: definicao.status,
          publishedAt: definicao.status === "publicada" ? new Date() : null,
        })
        .returning({ id: assessment.id });

      criadas.push((row as { id: string }).id);
    }

    for (const [sufixo, scores] of Object.entries(notas)) {
      const studentId = byRegistrationSuffix(sufixo);
      if (!studentId) continue;

      const lancadas = scores.filter((score): score is number => score !== null);
      const media = lancadas.reduce((sum, score) => sum + score, 0) / (lancadas.length || 1);

      // O bimestre anterior fica 0,7 abaixo do atual: a comparação do gráfico
      // precisa de diferença visível, e a evolução é a história da tela.
      rows.push({
        schoolId,
        assessmentId: (anterior as { id: string }).id,
        studentId,
        score: Math.max(0, Math.round((media - 0.7) * 10) / 10),
      });

      scores.forEach((score, index) => {
        const assessmentId = criadas[index];
        if (score === null || !assessmentId) return;
        rows.push({ schoolId, assessmentId, studentId, score });
      });
    }
  }

  for (let offset = 0; offset < rows.length; offset += 500) {
    await db.insert(grade).values(rows.slice(offset, offset + 500));
  }

  return rows.length;
}
