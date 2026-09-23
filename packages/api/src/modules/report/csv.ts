/**
 * Geração de CSV para a secretaria abrir no Excel.
 *
 * Parece trivial e não é. Três coisas quebram um CSV brasileiro, e as três
 * estão resolvidas aqui porque o arquivo é o que a escola manda para a
 * secretaria de educação — sair errado custa retrabalho de gente, não de
 * código.
 */

/**
 * Ponto e vírgula, não vírgula.
 *
 * No Windows em português, o separador de lista do sistema é `;`, e o Excel
 * respeita isso: um CSV separado por vírgula abre com tudo numa coluna só.
 * Quem precisar de vírgula está exportando para outro sistema, não para a
 * secretaria.
 */
export const SEPARATOR = ";";

/**
 * Marca de ordem de byte no começo do arquivo.
 *
 * Sem ela o Excel lê UTF-8 como Latin-1 e "Matrícula" vira "MatrÃ­cula". É a
 * causa número um de "o relatório veio com caracteres estranhos".
 */
const BOM = "﻿";

/**
 * Escapa um valor de célula.
 *
 * Aspas viram aspas dobradas e o campo inteiro é envolvido quando contém
 * separador, aspas ou quebra de linha — nome de aluno com vírgula e endereço
 * com quebra existem, e sem isso deslocam todas as colunas seguintes.
 */
export function cell(valor: unknown): string {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);
  if (!texto.includes(SEPARATOR) && !texto.includes('"') && !/[\r\n]/.test(texto)) {
    return texto;
  }
  return `"${texto.replaceAll('"', '""')}"`;
}

/**
 * Número no formato brasileiro: vírgula decimal.
 *
 * `8.5` escrito assim é lido como data ou como texto pelo Excel em pt-BR. Com
 * vírgula, ele vira número e soma.
 */
export function numberCell(valor: number | null | undefined, casas = 1): string {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return "";
  return valor.toFixed(casas).replace(".", ",");
}

/** Percentual de 0 a 1 vira "93,7%". `null` vira vazio, nunca "0%". */
export function percentCell(rate: number | null | undefined, casas = 1): string {
  if (rate === null || rate === undefined) return "";
  return `${numberCell(rate * 100, casas)}%`;
}

export interface Column<T> {
  title: string;
  valor: (linha: T) => unknown;
}

export function generateCsv<T>(columns: Column<T>[], linhas: T[]): string {
  const cabecalho = columns.map((coluna) => cell(coluna.title)).join(SEPARATOR);
  const corpo = linhas.map((linha) =>
    columns.map((coluna) => cell(coluna.valor(linha))).join(SEPARATOR),
  );

  // `\r\n` é o que o Excel espera; `\n` sozinho funciona no LibreOffice e
  // deixa linhas grudadas em versões antigas do Excel no Windows.
  return BOM + [cabecalho, ...corpo].join("\r\n");
}

/** Nome de arquivo seguro: sem acento, sem espaço, com data. */
export function fileName(base: string, year: number, hoje: string): string {
  const limpo = base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  return `${limpo}-${year}-${hoje}.csv`;
}
