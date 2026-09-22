/**
 * A faixa do medidor: quanto do teto já foi gasto.
 *
 * Cinco degraus, do claro ao quente, como medidor de combustível — a cor
 * comunica sem legenda. **Não é escala de estado**: 30% não é "aviso" nem
 * "erro", é só trinta por cento, e por isso os tokens são `medidor-*` e não
 * `warning`/`danger`.
 *
 * Função pura e testada porque é a regra que decide a cor de um anel que a
 * direção vai olhar de longe: errar a borda de uma faixa faz o medidor mentir
 * exatamente no ponto em que ele deveria chamar atenção.
 */
export type UsageBand = 1 | 2 | 3 | 4 | 5;

/** Os tetos de cada faixa, em porcentagem. O último cobre tudo acima. */
const CAPS: { ate: number; faixa: UsageBand }[] = [
  { ate: 25, faixa: 1 },
  { ate: 50, faixa: 2 },
  { ate: 75, faixa: 3 },
  { ate: 85, faixa: 4 },
];

export function usageBand(porcentagem: number): UsageBand {
  for (const { ate, faixa } of CAPS) {
    if (porcentagem <= ate) return faixa;
  }
  return 5;
}

/** A classe de cor do traço, por faixa. */
export const BAND_COLOR: Record<UsageBand, string> = {
  1: "stroke-medidor-1",
  2: "stroke-medidor-2",
  3: "stroke-medidor-3",
  4: "stroke-medidor-4",
  5: "stroke-medidor-5",
};

/**
 * Quanto do teto foi usado, de 0 a 100.
 *
 * `null` quando não há teto declarado: sem ele não existe porcentagem, e
 * desenhar um anel vazio sugeriria folga que ninguém mediu. Passar do teto é
 * possível — uma resposta cara custa mais do que sobrava —, e o anel para em
 * 100 porque volta inteira não comunica nada.
 */
export function percentOfCap(used: number, teto: number | null | undefined): number | null {
  if (!teto || teto <= 0) return null;
  return Math.min(100, Math.round((used / teto) * 100));
}
