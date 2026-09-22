/**
 * O código de indicação.
 *
 * Ele é ditado por telefone e copiado de um papel colado no portão da escola,
 * então o alfabeto exclui o que se confunde na fala e na letra cursiva: `0` e
 * `O`, `1` e `I`, `5` e `S`. Sobram 27 símbolos — com seis posições, dá 387
 * milhões de combinações, o que é folgado para o universo de uma escola.
 *
 * Não é segredo: quem adivinhar um código alheio ganha, no máximo, atribuir a
 * própria matrícula à indicação de outra família — que a secretaria vê na
 * tela e desfaz. Por isso não vale a complexidade de um token assinado; o que
 * vale é ser fácil de ditar.
 */
const ALFABETO = "ABCDEFGHJKLMNPQRTUVWXYZ2346789";

const COMPRIMENTO = 6;

/** Duas letras do nome, para a família reconhecer o próprio código. */
function prefixoDe(nome: string): string {
  const letras = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");

  const usaveis = [...letras].filter((letra) => ALFABETO.includes(letra));
  return usaveis.slice(0, 2).join("");
}

function sorteia(tamanho: number, aleatorio: () => number): string {
  let saida = "";
  for (let i = 0; i < tamanho; i += 1) {
    saida += ALFABETO[Math.floor(aleatorio() * ALFABETO.length)] ?? "A";
  }
  return saida;
}

/**
 * Gera um código livre.
 *
 * `emUso` vem do banco e é conferido aqui em vez de confiar no índice único:
 * colidir e deixar o `insert` falhar daria erro 500 numa ação que a secretaria
 * entende como "criar link". Depois de vinte tentativas desiste do prefixo e
 * sorteia o código inteiro — com a escola cheia de "MA", o prefixo é
 * justamente o que aperta o espaço.
 */
export function gerarCodigo(
  nome: string,
  emUso: ReadonlySet<string>,
  aleatorio: () => number = Math.random,
): string {
  const prefixo = prefixoDe(nome);

  for (let tentativa = 0; tentativa < 20; tentativa += 1) {
    const candidato = prefixo + sorteia(COMPRIMENTO - prefixo.length, aleatorio);
    if (!emUso.has(candidato)) return candidato;
  }

  for (let tentativa = 0; tentativa < 100; tentativa += 1) {
    const candidato = sorteia(COMPRIMENTO, aleatorio);
    if (!emUso.has(candidato)) return candidato;
  }

  throw new Error("Não foi possível gerar um código de indicação livre.");
}

/** "  ma-4k2z " -> "MA4K2Z". O código chega copiado, com o que vier junto. */
export function normalizarCodigo(bruto: string): string {
  return bruto
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 24);
}
