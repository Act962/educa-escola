/**
 * Máscaras de digitação.
 *
 * Separadas das telas porque são o tipo de código que parece trivial e erra em
 * silêncio: data que aceita 31/02, celular que engole o nono dígito, campo que
 * trava quando a pessoa apaga um caractere no meio.
 *
 * Todas trabalham sobre os dígitos e reconstroem o formato, em vez de inserir
 * separadores no texto que já está lá — assim apagar, colar e digitar no meio
 * se comportam igual.
 */

/** "86998122039" -> "(86) 99812-2039"; 10 dígitos -> "(86) 9812-2039". */
export function mascararCelular(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 11);
  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);
  // O corte fica a 4 do fim: serve para 8 e para 9 dígitos sem ramificar.
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  return `(${ddd}) ${resto.slice(0, resto.length - 4)}-${resto.slice(-4)}`;
}

/** "14032015" -> "14/03/2015". Aceita entrada parcial enquanto se digita. */
export function mascararData(valor: string): string {
  const digitos = valor.replace(/\D/g, "").slice(0, 8);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`;
}

/**
 * "14/03/2015" -> "2015-03-14"; entrada incompleta ou impossível -> `null`.
 *
 * A checagem de volta (`getDate` etc.) é o que recusa 31/02: o `Date` do
 * JavaScript não reclama, ele rola para 03/03 silenciosamente.
 */
export function dataParaISO(valor: string): string | null {
  const digitos = valor.replace(/\D/g, "");
  if (digitos.length !== 8) return null;

  const dia = Number(digitos.slice(0, 2));
  const mes = Number(digitos.slice(2, 4));
  const ano = Number(digitos.slice(4));

  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }

  const dois = (n: number) => String(n).padStart(2, "0");
  return `${ano}-${dois(mes)}-${dois(dia)}`;
}

/** "2015-03-14" -> "14/03/2015", para pré-preencher o campo mascarado. */
export function isoParaData(valor: string | null | undefined): string {
  if (!valor) return "";
  const [ano, mes, dia] = valor.split("-");
  if (!ano || !mes || !dia) return "";
  return `${dia}/${mes}/${ano}`;
}

/**
 * Idade completa na data de referência.
 *
 * Mostrada ao lado do campo enquanto se digita: é a confirmação de que o ano
 * saiu certo. Digitar 2051 no lugar de 2015 é o erro comum, e ele salta aos
 * olhos como "idade -25" muito antes de virar uma matrícula errada.
 */
export function idadeEm(iso: string | null, hoje = new Date()): number | null {
  if (!iso) return null;
  const [ano, mes, dia] = iso.split("-").map(Number);
  if (!ano || !mes || !dia) return null;

  let idade = hoje.getFullYear() - ano;
  const aniversarioPassou =
    hoje.getMonth() + 1 > mes || (hoje.getMonth() + 1 === mes && hoje.getDate() >= dia);
  if (!aniversarioPassou) idade -= 1;

  return idade;
}
