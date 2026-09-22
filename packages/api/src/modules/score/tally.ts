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
  media: number | null;
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
  const [ano, mes, dia] = date.split("-").map(Number);
  return new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, dia ?? 1, 12));
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
export function tallyAttendance(presencas: TalliedAttendance[]): NewEvent[] {
  const eventos: NewEvent[] = [];
  const porAluno = new Map<string, TalliedAttendance[]>();

  for (const presenca of presencas) {
    const lista = porAluno.get(presenca.studentId);
    if (lista) lista.push(presenca);
    else porAluno.set(presenca.studentId, [presenca]);
  }

  for (const [studentId, lista] of porAluno) {
    const ordenadas = [...lista].sort((a, b) => a.date.localeCompare(b.date));
    let seguidas = 0;

    for (const presenca of ordenadas) {
      const comum = {
        subjectKind: "aluno" as const,
        subjectId: studentId,
        academicYear: yearOf(presenca.date),
        term: null,
        sourceKind: "attendance",
        sourceId: presenca.id,
        occurredAt: instanteDe(presenca.date),
      };

      if (presenca.status === "presente") {
        eventos.push(evento({ ...comum, ruleKey: "aluno.presenca" }));
      } else if (presenca.status === "atraso") {
        eventos.push(evento({ ...comum, ruleKey: "aluno.atraso" }));
      }

      // Atraso não quebra a sequência: quem chegou assistiu à aula, que é a
      // mesma leitura que a frequência faz.
      if (presenca.status === "falta") {
        seguidas = 0;
        continue;
      }

      seguidas += 1;
      if (seguidas === LESSONS_FOR_STREAK) {
        eventos.push(evento({ ...comum, ruleKey: "aluno.sequencia_10" }));
        // Zera para que vinte aulas seguidas valham dois pontos de constância,
        // e não um só nem um a cada aula a partir da décima.
        seguidas = 0;
      }
    }
  }

  return eventos;
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
  presencas: TalliedAttendance[],
  academicYear: number,
): NewEvent[] {
  const doAno = presencas.filter((presenca) => yearOf(presenca.date) === academicYear);
  const contagem = new Map<string, { compareceu: number; total: number }>();

  for (const presenca of doAno) {
    const atual = contagem.get(presenca.studentId) ?? { compareceu: 0, total: 0 };
    atual.total += 1;
    if (presenca.status !== "falta") atual.compareceu += 1;
    contagem.set(presenca.studentId, atual);
  }

  const eventos: NewEvent[] = [];
  for (const [studentId, { compareceu, total }] of contagem) {
    if (total < MINIMUM_LESSONS_FOR_MERIT) continue;
    if (compareceu / total <= MERIT_ATTENDANCE_RATE) continue;

    eventos.push(
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

  return eventos;
}

/**
 * Evolução da média entre bimestres consecutivos.
 *
 * Exige nota publicada nos dois: comparar contra bimestre sem nota inventaria
 * uma evolução que ninguém fez. É a mesma leitura que o boletim faz ao manter
 * o aluno em "sem nota" enquanto houver pendência.
 */
export function tallyImprovement(medias: TermAverage[], academicYear: number): NewEvent[] {
  const porAluno = new Map<string, Map<number, number>>();

  for (const linha of medias) {
    if (linha.media === null) continue;
    const doAluno = porAluno.get(linha.studentId) ?? new Map<number, number>();
    doAluno.set(linha.term, linha.media);
    porAluno.set(linha.studentId, doAluno);
  }

  const eventos: NewEvent[] = [];
  for (const [studentId, bimestres] of porAluno) {
    for (const [term, media] of bimestres) {
      const anterior = bimestres.get(term - 1);
      if (anterior === undefined || media <= anterior) continue;

      eventos.push(
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

  return eventos;
}

/**
 * Chamada no prazo e diário preenchido.
 *
 * As duas são sobre **o registro**, nunca sobre o que foi registrado. É o que
 * impede o incentivo cruzado: nada aqui melhora marcando presente quem faltou.
 */
export function tallyLessons(aulas: TalliedLesson[], timeZone?: string): NewEvent[] {
  const eventos: NewEvent[] = [];

  for (const aula of aulas) {
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
      eventos.push(evento({ ...comum, ruleKey: "professor.chamada_no_prazo" }));
    }

    const temDiario = Boolean(aula.content?.trim()) || Boolean(aula.homework?.trim());
    if (temDiario) {
      eventos.push(evento({ ...comum, ruleKey: "professor.diario_preenchido" }));
    }
  }

  return eventos;
}

/** Diferença em dias entre duas datas civis. */
function diasEntre(de: string, ate: string): number {
  return Math.round((instanteDe(ate).getTime() - instanteDe(de).getTime()) / 86_400_000);
}

/**
 * Publicação fechada e devolutiva rápida.
 *
 * O ponto da publicação é por **fechar**, não por publicar: publicar com aluno
 * sem lançamento deixa exatamente o buraco no boletim que a regra do
 * `assessment` proíbe.
 */
export function tallyAssessments(avaliacoes: TalliedAssessment[], timeZone?: string): NewEvent[] {
  const eventos: NewEvent[] = [];

  for (const avaliacao of avaliacoes) {
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
      eventos.push(evento({ ...comum, ruleKey: "professor.avaliacao_publicada" }));
    }

    // Sem data de aplicação não dá para medir devolutiva. Não pontua, e não
    // chuta: avaliação sem `appliedOn` é cadastro incompleto, não mérito.
    if (avaliacao.appliedOn && diasEntre(avaliacao.appliedOn, publicadaEm) <= DAYS_FOR_FEEDBACK) {
      eventos.push(evento({ ...comum, ruleKey: "professor.devolutiva_em_sete_dias" }));
    }
  }

  return eventos;
}
