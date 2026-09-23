import type { BadgeTone } from "@educa-escola/ui/components/badge";

/**
 * Formatação para leitura em pt-BR.
 *
 * Fica separado das telas porque nota com ponto ("7.8") e frequência sem sinal
 * de porcentagem são erros que passam despercebidos numa revisão de PR e
 * saltam aos olhos na apresentação.
 */

/** 7.8 -> "7,8"; `null` -> "—". Traço, e não "0", que seria nota de verdade. */
export function gradeText(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value.toFixed(1).replace(".", ",");
}

/** 0.9312 -> "93,1%". */
export function percentText(rate: number | null | undefined, casas = 1): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(casas).replace(".", ",")}%`;
}

/** 0.94 -> "94%", para os números grandes de cartão. */
export function shortPercentText(rate: number | null | undefined): string {
  if (rate === null || rate === undefined) return "—";
  return `${Math.round(rate * 100)}%`;
}

export function integerText(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

const TURNOS: Record<string, string> = {
  manha: "Manhã",
  tarde: "Tarde",
  noite: "Noite",
};

export function shiftText(value: string): string {
  return TURNOS[value] ?? value;
}

const STUDENT_STATUS_BADGES: Record<string, { label: string; tone: BadgeTone }> = {
  ativo: { label: "Ativo", tone: "success" },
  documentacao_pendente: { label: "Doc. pendente", tone: "warning" },
  transferido: { label: "Transferido", tone: "neutral" },
  inativo: { label: "Inativo", tone: "neutral" },
};

export function studentStatusBadge(value: string) {
  return STUDENT_STATUS_BADGES[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

const GRADE_SITUATION_BADGES: Record<string, { label: string; tone: BadgeTone }> = {
  aprovado: { label: "Aprovado", tone: "success" },
  recuperacao: { label: "Recuperação", tone: "danger" },
  reprovado: { label: "Reprovado", tone: "danger" },
  sem_nota: { label: "Sem nota", tone: "warning" },
};

export function gradeSituationBadge(value: string) {
  return GRADE_SITUATION_BADGES[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

/** Saudação pelo horário local de quem está lendo. */
export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** "Ana Clara Souza Lima" -> "Ana Clara". */
export function firstName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(0, 2).join(" ");
}

const SITUACOES_ENROLLMENT: Record<string, { label: string; tone: BadgeTone }> = {
  pendente: { label: "Pendente", tone: "warning" },
  ativa: { label: "Ativa", tone: "success" },
  suspensa: { label: "Suspensa", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "neutral" },
  transferida: { label: "Transferida", tone: "neutral" },
  concluida: { label: "Concluída", tone: "info" },
};

export function enrollmentStatusBadge(value: string) {
  return SITUACOES_ENROLLMENT[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

/**
 * Situação do link, derivada do convite — nunca digitada.
 *
 * É a coluna que responde "de quem estou esperando o quê" sem abrir a ficha.
 */
const SITUACOES_LINK: Record<string, { label: string; tone: BadgeTone }> = {
  nao_enviado: { label: "Link não enviado", tone: "neutral" },
  aguardando: { label: "Aguardando família", tone: "warning" },
  ficha_entregue: { label: "Ficha entregue", tone: "info" },
  vencido: { label: "Vencido", tone: "danger" },
  bloqueado: { label: "Bloqueado", tone: "danger" },
  revogado: { label: "Revogado", tone: "neutral" },
};

export function linkStatusBadge(value: string) {
  return SITUACOES_LINK[value] ?? { label: value, tone: "neutral" as BadgeTone };
}

const PARENTESCOS: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  avo: "Avó ou avô",
  responsavel_legal: "Responsável legal",
  outro: "Outro",
};

export function relationshipText(value: string): string {
  return PARENTESCOS[value] ?? value;
}

const MOTIVOS_CANCELAMENTO: Record<string, string> = {
  transferencia_outra_escola: "Transferência para outra escola",
  mudanca_de_cidade: "Mudança de cidade",
  desistencia: "Desistência",
  dados_incorretos: "Dados incorretos",
  prazo_expirado: "Prazo de confirmação expirado",
  outro: "Outro",
};

export function cancelReasonText(value: string): string {
  return MOTIVOS_CANCELAMENTO[value] ?? value;
}

/**
 * "+5586998122039" -> "(86) ••••-2039".
 *
 * Listagem não precisa do número inteiro para a secretaria reconhecer de quem
 * se trata, e a §24.3 pede mascaramento parcial quando o dado completo não é
 * necessário na tela.
 */
export function maskedPhoneText(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 6) return "—";
  const nacional = digits.startsWith("55") ? digits.slice(2) : digits;
  const ddd = nacional.slice(0, 2);
  return `(${ddd}) ••••-${nacional.slice(-4)}`;
}

/** "+5586998122039" -> "(86) 99812-2039". Só no detalhe, nunca em listagem. */
export function phoneText(value: string | null | undefined): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  const nacional = digits.startsWith("55") ? digits.slice(2) : digits;
  if (nacional.length < 10) return value;
  const ddd = nacional.slice(0, 2);
  const resto = nacional.slice(2);
  return `(${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

/** "2015-03-14" -> "14/03/2015". Data civil não passa por fuso. */
export function civilDateText(value: string | null | undefined): string {
  if (!value) return "—";
  const [year, mes, day] = value.split("-");
  return `${day}/${mes}/${year}`;
}

/** Instante -> "21/09 às 14h32", no fuso de quem lê. */
export function dateTimeText(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const day = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${day} às ${time.replace(":", "h")}`;
}

/**
 * Instante -> "21/09/2025", no fuso de quem lê.
 *
 * Existe separado de `dateTimeText` porque aquele omite o ano de propósito — serve
 * a evento recente, onde "21/09 às 14h32" basta. Em data de cadastro o ano é
 * justamente a informação: "na escola desde 21/09" não diz nada.
 */
export function instantDateText(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR");
}

/**
 * Instante -> "01/10/2026", lido **em UTC**.
 *
 * Existe para as bordas do mês de cobrança da Meta, que são meia-noite UTC.
 * Com `instantDateText`, `2026-10-01T00:00:00Z` vira "30/09" no fuso de São
 * Paulo — e o painel diria que a cota renova um dia antes do que renova.
 * Fora desse caso, use `instantDateText`: data de escola é local.
 */
export function utcDateText(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

/** "vence hoje", "em 4 dias", "vencido" — o que a fila precisa dizer. */
export function deadlineText(value: Date | string | null | undefined, agora = new Date()): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const days = Math.ceil((date.getTime() - agora.getTime()) / 86_400_000);
  if (days < 0) return "vencido";
  if (days === 0) return "vence hoje";
  if (days === 1) return "1 dia";
  return `${days} dias`;
}
