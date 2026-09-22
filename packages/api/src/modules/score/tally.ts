import { toSchoolDate } from "../../dates";
import { pointsFor, type RuleKey } from "./rules";

/**
 * A apuração: fatos da escola entram, pontos saem.
 *
 * Funções puras, sem banco e sem relógio próprio — o que torna cada regra
 * testável com três linhas de entrada e uma asserção. O service só junta as
 * leituras, chama daqui e grava.
 *
 * Todo evento sai com `sourceId`, que é a chave de idempotência no índice
 * único de `score_event`. Reexecutar a apuração inteira não duplica ponto.
 */

export interface NewEvent {
  subjectKind: "aluno" | "professor" | "escola";
  subjectId: string;
  ruleKey: RuleKey;
  points: number;
  academicYear: number;
  term: number | null;
  sourceKind: string;
  sourceId: string;
  occurredAt: Date;
}

export interface TalliedLesson {
  id: string;
  teacherId: string;
  /** "2026-09-09", data civil da aula. */
  date: string;
  attendanceRecordedAt: Date | null;
  content: string | null;
  homework: string | null;
}

export interface TalliedAttendance {
  id: string;
  studentId: string;
  /** Data da aula a que esta presença pertence. */
  date: string;
  status: "presente" | "falta" | "atraso";
}

export interface TalliedAssessment {
  id: string;
  teacherId: string;
  term: number;
  appliedOn: string | null;
  status: "rascunho" | "publicada";
  publishedAt: Date | null;
  /** Quantos alunos da turma ficaram sem lançamento na publicação. */
  semLancamento: number;
}

export interface TermAverage {
  studentId: string;
  term: number;
  /** Média ponderada das avaliações publicadas. `null` quando não há nota. */
  average: number | null;
}

/**
 * O ano letivo de uma data civil.
 *
 * Tirado do ano da data e não de `classroom.academicYear` de propósito: uma
 * aula de dezembro de 2026 numa turma marcada como 2027 pontuaria no ano
 * errado, e quem lê o extrato procura pelo ano em que a aula aconteceu.
 */
export function yearOf(date: string): number {
  return Number(date.slice(0, 4));
}

/** Meio-dia UTC: longe das bordas de fuso, então o dia nunca vira. */
function instanteDe(date: string): Date {
  const [year, mes, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (mes ?? 1) - 1, day ?? 1, 12));
}

function evento(base: Omit<NewEvent, "points"> & { ruleKey: RuleKey }): NewEvent {
  return { ...base, points: pointsFor(base.ruleKey) };
}

/** Quantas aulas seguidas sem falta valem um ponto de constância. */
export const LESSONS_FOR_STREAK = 10;

/** A partir de quanta frequência no ano o aluno ganha o ponto de mérito. */
export const MERIT_ATTENDANCE_RATE = 0.9;

/**
 * Quantas aulas o aluno precisa ter tido para o mérito de frequência valer.
 *
 * Sem piso, quem teve uma aula e compareceu tem 100% e ganha os 20 pontos —
 * mais que o aluno que veio a 95 de 100 aulas. Vinte aulas é cerca de um mês
 * de um turno: pouco para atrapalhar quem entrou no meio do ano, e o bastante
 * para o percentual querer dizer alguma coisa.
 */
export const MINIMUM_LESSONS_FOR_MERIT = 20;

/** Prazo da devolutiva, contado da aplicação da avaliação. */
export const DAYS_FOR_FEEDBACK = 7;

/**
 * Presença, atraso e constância.
 *
 * As presenças chegam de uma vez e são agrupadas por aluno aqui dentro: a
 * sequência de dez depende da ordem das aulas, e ordenar no SQL deixaria a
 * regra dependendo de um `ORDER BY` longe de onde ela é lida.
 */
export function tallyAttendance(attendanceEntries: TalliedAttendance[]): NewEvent[] {
  const events: NewEvent[] = [];
  const byStudent = new Map<string, TalliedAttendance[]>();

  for (const attendanceEntry of attendanceEntries) {
    const list = byStudent.get(attendanceEntry.studentId);
    if (list) list.push(attendanceEntry);
    else byStudent.set(attendanceEntry.studentId, [attendanceEntry]);
  }

  for (const [studentId, list] of byStudent) {
    const ordenadas = [...list].sort((a, b) => a.date.localeCompare(b.date));
    let seguidas = 0;

    for (const attendanceEntry of ordenadas) {
      const comum = {
        subjectKind: "aluno" as const,
        subjectId: studentId,
        academicYear: yearOf(attendanceEntry.date),
        term: null,
        sourceKind: "attendance",
        sourceId: attendanceEntry.id,
        occurredAt: instanteDe(attendanceEntry.date),
      };

      if (attendanceEntry.status === "presente") {
        events.push(evento({ ...comum, ruleKey: "aluno.presenca" }));
      } else if (attendanceEntry.status === "atraso") {
        events.push(evento({ ...comum, ruleKey: "aluno.atraso" }));
      }

      // Atraso não quebra a sequência: quem chegou assistiu à aula, que é a
      // mesma leitura que a frequência faz.
      if (attendanceEntry.status === "falta") {
        seguidas = 0;
        continue;
      }

      seguidas += 1;
      if (seguidas === LESSONS_FOR_STREAK) {
        events.push(evento({ ...comum, ruleKey: "aluno.sequencia_10" }));
        // Zera para que vinte aulas seguidas valham dois pontos de constância,
        // e não um só nem um a cada aula a partir da décima.
        seguidas = 0;
      }
    }
  }

  return events;
}

/**
 * Mérito de frequência no ano.
 *
 * Só conta com aula registrada: sem aula, a frequência é indefinida — não é
 * 100%. Premiar quem não teve aula nenhuma seria o mesmo defeito que a
 * frequência do boletim já evita devolvendo `null`. E com poucas aulas o
 * percentual não quer dizer nada, daí o piso de `MINIMUM_LESSONS_FOR_MERIT`.
 */
export function tallyYearAttendance(
  attendanceEntries: TalliedAttendance[],
  academicYear: number,
): NewEvent[] {
  const doAno = attendanceEntries.filter(
    (attendanceEntry) => yearOf(attendanceEntry.date) === academicYear,
  );
  const count = new Map<string, { compareceu: number; total: number }>();

  for (const attendanceEntry of doAno) {
    const atual = count.get(attendanceEntry.studentId) ?? { compareceu: 0, total: 0 };
    atual.total += 1;
    if (attendanceEntry.status !== "falta") atual.compareceu += 1;
    count.set(attendanceEntry.studentId, atual);
  }

  const events: NewEvent[] = [];
  for (const [studentId, { compareceu, total }] of count) {
    if (total < MINIMUM_LESSONS_FOR_MERIT) continue;
    if (compareceu / total <= MERIT_ATTENDANCE_RATE) continue;

    events.push(
      evento({
        subjectKind: "aluno",
        subjectId: studentId,
        ruleKey: "aluno.frequencia_ano",
        academicYear,
        term: null,
        sourceKind: "ano",
        // A chave do ano, e não um id de linha: o ponto é do ano inteiro, e
        // reapurar em dezembro não pode somar de novo o que já foi dado.
        sourceId: String(academicYear),
        occurredAt: instanteDe(`${academicYear}-12-31`),
      }),
    );
  }

  return events;
}

/**
 * Evolução da média entre bimestres consecutivos.
 *
 * Exige nota publicada nos dois: comparar contra bimestre sem nota inventaria
 * uma evolução que ninguém fez. É a mesma leitura que o boletim faz ao manter
 * o aluno em "sem nota" enquanto houver pendência.
 */
export function tallyImprovement(averages: TermAverage[], academicYear: number): NewEvent[] {
  const byStudent = new Map<string, Map<number, number>>();

  for (const linha of averages) {
    if (linha.average === null) continue;
    const ofStudent = byStudent.get(linha.studentId) ?? new Map<number, number>();
    ofStudent.set(linha.term, linha.average);
    byStudent.set(linha.studentId, ofStudent);
  }

  const events: NewEvent[] = [];
  for (const [studentId, bimestres] of byStudent) {
    for (const [term, average] of bimestres) {
      const anterior = bimestres.get(term - 1);
      if (anterior === undefined || average <= anterior) continue;

      events.push(
        evento({
          subjectKind: "aluno",
          subjectId: studentId,
          ruleKey: "aluno.evolucao_bimestre",
          academicYear,
          term,
          sourceKind: "bimestre",
          sourceId: `${academicYear}-${term}`,
          occurredAt: instanteDe(`${academicYear}-12-31`),
        }),
      );
    }
  }

  return events;
}

/**
 * Chamada no prazo e diário preenchido.
 *
 * As duas são sobre **o registro**, nunca sobre o que foi registrado. É o que
 * impede o incentivo cruzado: nada aqui melhora marcando presente quem faltou.
 */
export function tallyLessons(lessons: TalliedLesson[], timeZone?: string): NewEvent[] {
  const events: NewEvent[] = [];

  for (const aula of lessons) {
    if (!aula.attendanceRecordedAt) continue;

    const comum = {
      subjectKind: "professor" as const,
      subjectId: aula.teacherId,
      academicYear: yearOf(aula.date),
      term: null,
      sourceKind: "lesson",
      sourceId: aula.id,
      occurredAt: aula.attendanceRecordedAt,
    };

    // O prazo é o mesmo da tela de chamada: até o fim do dia da aula. Comparar
    // no fuso da escola, e não no relógio do processo, senão a chamada das 21h
    // de um servidor em UTC contaria como do dia seguinte.
    if (toSchoolDate(aula.attendanceRecordedAt, timeZone) <= aula.date) {
      events.push(evento({ ...comum, ruleKey: "professor.chamada_no_prazo" }));
    }

    const temDiario = Boolean(aula.content?.trim()) || Boolean(aula.homework?.trim());
    if (temDiario) {
      events.push(evento({ ...comum, ruleKey: "professor.diario_preenchido" }));
    }
  }

  return events;
}

/** Diferença em dias entre duas datas civis. */
function daysBetween(de: string, ate: string): number {
  return Math.round((instanteDe(ate).getTime() - instanteDe(de).getTime()) / 86_400_000);
}

/**
 * Publicação fechada e devolutiva rápida.
 *
 * O ponto da publicação é por **fechar**, não por publicar: publicar com aluno
 * sem lançamento deixa exatamente o buraco no boletim que a regra do
 * `assessment` proíbe.
 */
export function tallyAssessments(assessments: TalliedAssessment[], timeZone?: string): NewEvent[] {
  const events: NewEvent[] = [];

  for (const avaliacao of assessments) {
    if (avaliacao.status !== "publicada" || !avaliacao.publishedAt) continue;

    const publicadaEm = toSchoolDate(avaliacao.publishedAt, timeZone);
    const comum = {
      subjectKind: "professor" as const,
      subjectId: avaliacao.teacherId,
      academicYear: yearOf(publicadaEm),
      term: avaliacao.term,
      sourceKind: "assessment",
      sourceId: avaliacao.id,
      occurredAt: avaliacao.publishedAt,
    };

    if (avaliacao.semLancamento === 0) {
      events.push(evento({ ...comum, ruleKey: "professor.avaliacao_publicada" }));
    }

    // Sem data de aplicação não dá para medir devolutiva. Não pontua, e não
    // chuta: avaliação sem `appliedOn` é cadastro incompleto, não mérito.
    if (avaliacao.appliedOn && daysBetween(avaliacao.appliedOn, publicadaEm) <= DAYS_FOR_FEEDBACK) {
      events.push(evento({ ...comum, ruleKey: "professor.devolutiva_em_sete_dias" }));
    }
  }

  return events;
}
