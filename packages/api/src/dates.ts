/**
 * Datas do dia letivo.
 *
 * O dia letivo é civil e local à escola: uma aula de 9 de setembro é de 9 de
 * setembro em São Paulo, não em UTC. Rodando o servidor em UTC, `toISOString`
 * jogaria a aula das 21h para o dia seguinte — por isso a formatação passa
 * pelo fuso, e não pelo relógio do processo.
 */

/** Fuso padrão. Vive em `school.timezone` quando a escola for de outro estado. */
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

/** `Date` -> "2026-09-09" no fuso da escola. */
export function toSchoolDate(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
  return parts;
}

const WEEKDAYS = [
  "domingo",
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
] as const;

const MONTHS = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** "2026-09-09" -> "quarta-feira, 9 de setembro". */
export function longDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  // Meio-dia UTC: longe o bastante das bordas para o dia da semana não virar.
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay()];
  return `${weekday}, ${day} de ${MONTHS[month - 1]}`;
}

/** "2026-09-09" -> "09/09". */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split("-");
  return month && day ? `${day}/${month}` : isoDate;
}

/** Dias inteiros entre duas datas civis. Negativo quando `to` já passou. */
export function daysBetween(from: string, to: string): number {
  const asUtc = (iso: string) => {
    const [year, month, day] = iso.split("-").map(Number);
    return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  };
  return Math.round((asUtc(to) - asUtc(from)) / 86_400_000);
}

/** `Date` -> "07:30" no fuso da escola. */
export function toSchoolTime(instant: Date, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(instant);
}
