/**
 * Quão perto do teto a escola está — e quando isso vira alerta.
 *
 * Fica fora do serviço porque é a parte que a tela repete: o painel da barra
 * lateral pinta a barra por este nível, e o serviço recusa a pergunta pelo
 * mesmo. Duas implementações do mesmo limiar divergiriam no dia em que
 * alguém mudasse um dos dois — e a divergência apareceria como "a barra está
 * vermelha mas ele ainda responde".
 */

/** Alerta aos 80%: ainda dá para decidir sem pressa. */
export const LIMIAR_ATENCAO = 0.8;

/**
 * Crítico aos 95%.
 *
 * Não 100%, porque no dia em que bater 100% não há mais o que decidir — o
 * Astro já parou. O alerta precisa chegar enquanto ainda existe escolha entre
 * aumentar o teto e deixar acabar.
 */
export const LIMIAR_CRITICO = 0.95;

export type NivelDeUso = "ok" | "atencao" | "critico" | "esgotado";

/**
 * Sem teto declarado não há nível: devolve `ok`.
 *
 * Um teto nulo é "a escola não disse quanto aceita gastar", e pintar isso de
 * vermelho seria inventar um limite que ninguém escolheu.
 */
export function nivelDeUso(usado: number, teto: number | null | undefined): NivelDeUso {
  if (!teto || teto <= 0) return "ok";
  if (usado >= teto) return "esgotado";

  const fracao = usado / teto;
  if (fracao >= LIMIAR_CRITICO) return "critico";
  if (fracao >= LIMIAR_ATENCAO) return "atencao";
  return "ok";
}

/** O pior dos dois. A barra lateral mostra um alerta só, não uma lista. */
export function nivelMaisGrave(a: NivelDeUso, b: NivelDeUso): NivelDeUso {
  const ordem: NivelDeUso[] = ["ok", "atencao", "critico", "esgotado"];
  return ordem.indexOf(a) >= ordem.indexOf(b) ? a : b;
}

/**
 * A porcentagem para a barra, limitada a 100.
 *
 * Estourar o teto é possível — uma resposta cara passa do que sobrava —, e
 * barra além do trilho quebra o desenho em vez de comunicar o excesso. O
 * excesso aparece no número ao lado, que não é limitado.
 */
export function porcentagemDeUso(usado: number, teto: number | null | undefined): number | null {
  if (!teto || teto <= 0) return null;
  return Math.min(100, Math.round((usado / teto) * 100));
}
