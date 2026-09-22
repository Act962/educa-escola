/**
 * A comparação de rostos. Sem banco, sem rede, sem tela.
 *
 * Mora sozinha porque é a única parte do sistema que pode **identificar uma
 * criança como outra**. Um limiar frouxo libera o irmão parecido; um limiar
 * apertado deixa aluno legítimo na porta. Isso precisa ser exercitável com
 * números na mesa, não descoberto na fila da entrada.
 */

/**
 * Distância euclidiana entre dois descritores.
 *
 * Vetores de tamanhos diferentes **não** são comparáveis: viriam de
 * extratores diferentes, e a conta devolveria um número com aparência de
 * resposta. Por isso é erro, e não um valor grande.
 */
export function distance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Descritores de tamanhos diferentes (${a.length} e ${b.length}) não se comparam.`,
    );
  }

  let soma = 0;
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] as number) - (b[i] as number);
    soma += d * d;
  }
  return Math.sqrt(soma);
}

/**
 * O limiar de aceitação.
 *
 * 0,6 é o valor de referência dos descritores de 128 dimensões no formato mais
 * difundido. **Não é uma constante universal** — trocar de extrator muda a
 * escala, e por isso `extractor` fica gravado junto do molde.
 *
 * DECISÃO-JOÃO: onde calibrar isto.
 * Quebra se: mais frouxo, irmãos parecidos abrem a catraca um do outro;
 *   mais apertado, aluno legítimo fica na porta e a escola desliga o recurso.
 * Fiz assim: valor de referência, num só lugar, com teste nas bordas — dá
 *   para mudar num commit de uma linha depois de medir na escola.
 * Alternativas: por escola, em configuração · por extrator, numa tabela.
 */
export const DEFAULT_THRESHOLD = 0.6;

/**
 * A margem que separa "é ele" de "é parecido com ele".
 *
 * Quando o segundo colocado está quase tão perto quanto o primeiro, a leitura
 * não distingue os dois — e escolher o menor por centésimos é escolher no
 * palite. Nesse caso é melhor não reconhecer: a carteirinha resolve em dois
 * segundos, e liberar a criança errada não se desfaz.
 */
export const MINIMUM_MARGIN = 0.05;

export interface KnownTemplate {
  studentId: string;
  descritor: readonly number[];
}

export type Verdict =
  | { tipo: "reconhecido"; studentId: string; distance: number }
  | { tipo: "ninguem"; melhorDistancia: number | null }
  | { tipo: "ambiguo"; melhorDistancia: number; diferenca: number };

/**
 * Procura o rosto entre os moldes conhecidos.
 *
 * Varredura linear de propósito: são 128 números contra algumas centenas de
 * alunos, o que o processador resolve em menos de um milissegundo. Índice
 * vetorial só passa a valer com dezenas de milhares numa instalação — e aí a
 * assinatura desta função não muda.
 */
export function identify(
  rosto: readonly number[],
  conhecidos: readonly KnownTemplate[],
  limiar = DEFAULT_THRESHOLD,
): Verdict {
  let melhor: { studentId: string; d: number } | null = null;
  let segundo = Number.POSITIVE_INFINITY;

  for (const molde of conhecidos) {
    const d = distance(rosto, molde.descritor);
    if (!melhor || d < melhor.d) {
      segundo = melhor?.d ?? segundo;
      melhor = { studentId: molde.studentId, d };
    } else if (d < segundo) {
      segundo = d;
    }
  }

  if (!melhor || melhor.d > limiar) {
    return { tipo: "ninguem", melhorDistancia: melhor?.d ?? null };
  }

  const diferenca = segundo - melhor.d;
  if (Number.isFinite(segundo) && segundo <= limiar && diferenca < MINIMUM_MARGIN) {
    return { tipo: "ambiguo", melhorDistancia: melhor.d, diferenca };
  }

  return { tipo: "reconhecido", studentId: melhor.studentId, distance: melhor.d };
}
