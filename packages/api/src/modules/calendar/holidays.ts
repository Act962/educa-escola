import type { DayEffect, EventType } from "./schema";

/**
 * O calendário brasileiro de um ano letivo.
 *
 * Existe porque digitar isto à mão erra: metade das datas **muda todo ano**.
 * Carnaval, Sexta-feira Santa e Corpus Christi derivam da Páscoa, e a Páscoa
 * é uma conta — não uma tabela que alguém atualiza em dezembro e esquece no
 * ano seguinte.
 *
 * As datas fixas vêm da lei, com a lei citada. As comemorativas vêm do
 * calendário escolar brasileiro e **não tiram dia letivo**: são gancho de
 * projeto e de aula, não folga.
 */

export interface CalendarDate {
  title: string;
  /** "2026-09-07" */
  startsOn: string;
  endsOn: string;
  type: EventType;
  dayEffect: DayEffect;
  /** De onde vem. Aparece na tela: data sem origem é data que ninguém confere. */
  fonte: string;
}

/**
 * Domingo de Páscoa pelo algoritmo de Meeus/Jones/Butcher (calendário
 * gregoriano).
 *
 * É daqui que saem Carnaval, Sexta-feira Santa e Corpus Christi. Vale de 1583
 * a 4099, o que cobre qualquer ano letivo que este sistema vá ver.
 */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return iso(year, mes, day);
}

function iso(year: number, mes: number, day: number): string {
  return `${year}-${String(mes).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Soma dias a uma data civil. Meio-dia UTC: o dia nunca vira por fuso. */
export function addDays(data: string, days: number): string {
  const [year, mes, day] = data.split("-").map(Number);
  const d = new Date(Date.UTC(year ?? 1970, (mes ?? 1) - 1, day ?? 1, 12));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const umDia = (
  title: string,
  startsOn: string,
  type: EventType,
  dayEffect: DayEffect,
  fonte: string,
): CalendarDate => ({ title, startsOn, endsOn: startsOn, type, dayEffect, fonte });

/**
 * Feriados nacionais — os que a lei federal manda fechar.
 *
 * **20 de novembro entra desde 2024**: a Lei 14.759/2023 tornou o Dia da
 * Consciência Negra feriado nacional. Muitos calendários ainda o trazem como
 * facultativo, e é o erro mais comum desta lista.
 */
export function nationalHolidays(year: number): CalendarDate[] {
  const pascoa = easterSunday(year);

  const fixos: CalendarDate[] = [
    umDia("Confraternização Universal", iso(year, 1, 1), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia("Tiradentes", iso(year, 4, 21), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia("Dia do Trabalho", iso(year, 5, 1), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia("Independência do Brasil", iso(year, 9, 7), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia("Nossa Senhora Aparecida", iso(year, 10, 12), "feriado", "nao_letivo", "Lei 6.802/1980"),
    umDia("Finados", iso(year, 11, 2), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia("Proclamação da República", iso(year, 11, 15), "feriado", "nao_letivo", "Lei 662/1949"),
    umDia(
      "Dia Nacional de Zumbi e da Consciência Negra",
      iso(year, 11, 20),
      "feriado",
      "nao_letivo",
      "Lei 14.759/2023 — feriado nacional desde 2024",
    ),
    umDia("Natal", iso(year, 12, 25), "feriado", "nao_letivo", "Lei 662/1949"),
  ];

  const movel = umDia(
    "Sexta-feira Santa",
    addDays(pascoa, -2),
    "feriado",
    "nao_letivo",
    "Lei 9.093/1995 — móvel, deriva da Páscoa",
  );

  return [...fixos, movel].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/**
 * Carnaval e Corpus Christi.
 *
 * **Não são feriados nacionais por lei federal** — são ponto facultativo. Mas
 * escola brasileira não tem aula neles, então entram como dia não letivo e a
 * origem diz o que são. Escola que der aula na quarta de cinzas apaga a linha.
 */
export function optionalHolidays(year: number): CalendarDate[] {
  const pascoa = easterSunday(year);

  return [
    {
      title: "Carnaval",
      startsOn: addDays(pascoa, -48),
      endsOn: addDays(pascoa, -47),
      type: "recesso",
      dayEffect: "nao_letivo",
      fonte: "Ponto facultativo — móvel, deriva da Páscoa",
    },
    umDia(
      "Quarta-feira de Cinzas",
      addDays(pascoa, -46),
      "recesso",
      "nao_letivo",
      "Ponto facultativo até as 14h — móvel",
    ),
    umDia(
      "Corpus Christi",
      addDays(pascoa, 60),
      "recesso",
      "nao_letivo",
      "Ponto facultativo — móvel, deriva da Páscoa",
    ),
  ];
}

/**
 * Datas comemorativas da cultura e da história do Brasil.
 *
 * **Nenhuma tira dia letivo** — tem aula, e é justamente esse o ponto: são
 * gancho de projeto, de mural e de aula. Entram no calendário para a escola
 * planejar com antecedência em vez de lembrar na véspera.
 *
 * "Dia dos Povos Indígenas" é o nome oficial desde a Lei 14.402/2022, que
 * substituiu "Dia do Índio". O termo anterior é pejorativo e a lei é recente
 * o bastante para muita agenda ainda trazer o antigo.
 */
export function commemorativeDates(year: number): CalendarDate[] {
  const comemorativa = (title: string, mes: number, day: number, fonte: string) =>
    umDia(title, iso(year, mes, day), "evento", "nenhum", fonte);

  return [
    comemorativa("Dia Internacional da Mulher", 3, 8, "Data comemorativa"),
    comemorativa("Dia Mundial da Água", 3, 22, "Data comemorativa"),
    comemorativa(
      "Dia dos Povos Indígenas",
      4,
      19,
      "Lei 14.402/2022 — renomeou o antigo “Dia do Índio”",
    ),
    comemorativa("Descobrimento do Brasil", 4, 22, "Data histórica"),
    comemorativa("Dia das Mães", 5, 10, "Segundo domingo de maio — data aproximada"),
    comemorativa("Abolição da escravatura", 5, 13, "Lei Áurea, 1888 — data histórica"),
    comemorativa("Dia do Meio Ambiente", 6, 5, "Data comemorativa"),
    comemorativa("Festas juninas — São João", 6, 24, "Tradição popular"),
    comemorativa("Dia dos Pais", 8, 9, "Segundo domingo de agosto — data aproximada"),
    comemorativa("Dia do Estudante", 8, 11, "Data comemorativa"),
    comemorativa("Dia do Folclore", 8, 22, "Data comemorativa"),
    comemorativa("Dia da Amazônia", 9, 5, "Data comemorativa"),
    comemorativa("Dia da Árvore", 9, 21, "Data comemorativa"),
    comemorativa("Dia das Crianças", 10, 12, "Lei 4.117/1962"),
    comemorativa("Dia do Professor", 10, 15, "Decreto 52.682/1963"),
    comemorativa("Dia da Bandeira", 11, 19, "Data cívica"),
  ].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

/**
 * O recesso de julho.
 *
 * Duas semanas no meio do ano é o desenho mais comum da escola brasileira,
 * mas **cada rede define o seu** — por isso vem como sugestão editável e não
 * como verdade. Começa na primeira segunda-feira de julho.
 */
export function julyBreak(year: number): CalendarDate {
  let day = iso(year, 7, 1);
  while (new Date(`${day}T12:00:00Z`).getUTCDay() !== 1) day = addDays(day, 1);

  return {
    title: "Recesso escolar de julho",
    startsOn: day,
    endsOn: addDays(day, 11),
    type: "recesso",
    dayEffect: "nao_letivo",
    fonte: "Sugestão — cada rede define o próprio recesso",
  };
}

/** Tudo que o sistema sabe sugerir para um ano letivo. */
export function brazilianCalendar(year: number): CalendarDate[] {
  return [
    ...nationalHolidays(year),
    ...optionalHolidays(year),
    ...commemorativeDates(year),
    julyBreak(year),
  ].sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}
