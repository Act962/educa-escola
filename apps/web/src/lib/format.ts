import type { BadgeTone } from "@educa-escola/ui/components/badge";

/**
 * Formatação para leitura em pt-BR.
 *
 * Fica separado das telas porque nota com ponto ("7.8") e frequência sem sinal
 * de porcentagem são erros que passam despercebidos numa revisão de PR e
 * saltam aos olhos na apresentação.
 */

/** 7.8 -> "7,8"; `null` -> "—". Traço, e não "0", que seria nota de verdade. */
export function nota(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1).replace(".", ",");
}

/** 0.9312 -> "93,1%". */
export function percentual(rate: number | null | undefined, casas = 1): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(casas).replace(".", ",")}%`;
}

/** 0.94 -> "94%", para os números grandes de cartão. */
export function percentualCurto(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function inteiro(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const TURNOS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export function turno(value: string): string {
  return TURNOS[value] ?? value;
}

const SITUACOES_MATRICULA: Record<string, { label: string; tone: BadgeTone }> = {
  ativo: { label: "Ativo", tone: "success" },
  documentacao_pendente: { label: "Doc. pendente", tone: "warning" },
  transferido: { label: "Transferido", tone: "neutral" },
  inativo: { label: "Inativo", tone: "neutral" },
};

export function situacaoMatricula(value: string) {
  return SITUACOES_MATRICULA[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

const SITUACOES_NOTA: Record<string, { label: string; tone: BadgeTone }> = {
  aprovado: { label: "Aprovado", tone: "success" },
  recuperacao: { label: "Recuperação", tone: "danger" },
  reprovado: { label: "Reprovado", tone: "danger" },
  sem_nota: { label: "Sem nota", tone: "warning" },
};

export function situacaoNota(value: string) {
  return SITUACOES_NOTA[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

/** Saudação pelo horário local de quem está lendo. */
export function saudacao(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "Ana Clara Souza Lima" -> "Ana Clara". */
export function primeiroNome(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
}
