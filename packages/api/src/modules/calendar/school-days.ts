/**
 * Contagem de dias letivos e o mínimo legal.
 *
 * É a irmã da regra dos 75% de frequência: a LDB (art. 24, I) exige **200 dias
 * letivos** de efetivo trabalho escolar, e uma escola que fecha o ano abaixo
 * disso tem problema com a secretaria de educação, não com o software. Por
 * isso a conta vive num lugar só, é pura, e a tela apenas a mostra.
 *
 * Funções puras sobre datas civis em texto ("2026-02-05"). Nada de `Date` com
 * fuso no meio: o dia letivo é civil e local à escola, e converter para
 * instante só abriria a porta para a aula de 31 de dezembro virar 1º de
 * janeiro.
 */

/** Sábado e domingo não são letivos por padrão. Reposição pode reverter. */
const FIM_DE_SEMANA = new Set([0, 6]);

export interface DayAffectingEvent {
  startsOn: string;
  endsOn: string;
  dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
}

export interface SchoolDayCount {
  /** Dias úteis no período, antes de qualquer evento. */
  weekdays: number;
  /** Dias úteis perdidos para feriado, recesso ou férias. */
  perdidos: number;
  /** Dias não úteis recuperados por reposição. */
  repostos: number;
  /** O número que vale: úteis − perdidos + repostos. */
  letivos: number;
  minimo: number;
  /** Quantos faltam para o mínimo. Zero quando já cumpriu. */
  faltam: number;
  cumpreOMinimo: boolean;
}

/** "2026-02-05" -> dia da semana (0 domingo). Meio-dia UTC: nunca vira o dia. */
export function dayOfWeek(data: string): number {
  const [year, mes, day] = data.split("-").map(Number);
  return new Date(Date.UTC(year ?? 1970, (mes ?? 1) - 1, day ?? 1, 12)).getUTCDay();
}

/** Percorre o intervalo, com as duas pontas incluídas. */
export function* daysBetween(start: string, end: string): Generator<string> {
  const [a, m, d] = start.split("-").map(Number);
  const atual = new Date(Date.UTC(a ?? 1970, (m ?? 1) - 1, d ?? 1, 12));
  const limite = (() => {
    const [fa, fm, fd] = end.split("-").map(Number);
    return new Date(Date.UTC(fa ?? 1970, (fm ?? 1) - 1, fd ?? 1, 12));
  })();

  while (atual.getTime() <= limite.getTime()) {
    yield atual.toISOString().slice(0, 10);
    atual.setUTCDate(atual.getUTCDate() + 1);
  }
}

export function isWeekday(data: string): boolean {
  return !FIM_DE_SEMANA.has(dayOfWeek(data));
}

/**
 * Conta os dias letivos do período.
 *
 * **Um dia perdido conta uma vez só.** Feriado e recesso que se sobrepõem —
 * acontece no fim de ano — tirariam o mesmo dia duas vezes se a conta somasse
 * durações de evento em vez de marcar dias num conjunto. O erro daria um total
 * menor que o real e mandaria a escola repor aula que não devia.
 */
export function countSchoolDays(input: {
  startsOn: string;
  endsOn: string;
  minimo: number;
  events: DayAffectingEvent[];
}): SchoolDayCount {
  const naoLetivos = new Set<string>();
  const extras = new Set<string>();

  for (const evento of input.events) {
    if (evento.dayEffect === "nenhum") continue;
    const destino = evento.dayEffect === "nao_letivo" ? naoLetivos : extras;
    for (const day of daysBetween(evento.startsOn, evento.endsOn)) destino.add(day);
  }

  let weekdays = 0;
  let perdidos = 0;
  let repostos = 0;

  for (const day of daysBetween(input.startsOn, input.endsOn)) {
    const util = isWeekday(day);
    if (util) weekdays += 1;

    // Reposição vence o feriado: se a escola marcou aula naquele dia, houve
    // aula. É a mesma leitura que o `attendanceRecordedAt` faz da chamada.
    if (extras.has(day)) {
      if (!util) repostos += 1;
      continue;
    }
    if (util && naoLetivos.has(day)) perdidos += 1;
  }

  const letivos = weekdays - perdidos + repostos;

  return {
    weekdays,
    perdidos,
    repostos,
    letivos,
    minimo: input.minimo,
    faltam: Math.max(0, input.minimo - letivos),
    cumpreOMinimo: letivos >= input.minimo,
  };
}
