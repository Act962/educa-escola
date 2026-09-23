import { describe, expect, it } from "vitest";

import { cell, fileName, generateCsv, numberCell, percentCell } from "./csv";

describe("celula", () => {
  it("deixa em paz o que não precisa de aspas", () => {
    expect(cell("Ana Lima")).toBe("Ana Lima");
    expect(cell(42)).toBe("42");
  });

  /** Nome com ponto e vírgula deslocaria todas as colunas seguintes. */
  it("envolve o que contém o separador", () => {
    expect(cell("Lima; Ana")).toBe('"Lima; Ana"');
  });

  it("dobra as aspas e envolve", () => {
    expect(cell('Ana "Aninha" Lima')).toBe('"Ana ""Aninha"" Lima"');
  });

  it("envolve quebra de linha, que existe em endereço", () => {
    expect(cell("Rua A, 10\nApto 2")).toBe('"Rua A, 10\nApto 2"');
  });

  /** Vazio e não "null": a célula fica em branco, como a secretaria espera. */
  it("nulo e indefinido viram célula vazia", () => {
    expect(cell(null)).toBe("");
    expect(cell(undefined)).toBe("");
  });
});

describe("numero", () => {
  /** Com ponto, o Excel em pt-BR lê 8.5 como data ou texto. */
  it("usa vírgula decimal", () => {
    expect(numberCell(8.5)).toBe("8,5");
    expect(numberCell(10, 2)).toBe("10,00");
  });

  it("nulo vira vazio, nunca zero", () => {
    expect(numberCell(null)).toBe("");
    expect(numberCell(undefined)).toBe("");
  });
});

describe("percentual", () => {
  it("converte de 0-1 para porcentagem com vírgula", () => {
    expect(percentCell(0.937)).toBe("93,7%");
  });

  /** Frequência nula é "sem aula registrada", não "0%". */
  it("nulo vira vazio, e não 0%", () => {
    expect(percentCell(null)).toBe("");
  });
});

describe("gerarCsv", () => {
  const columns = [
    { title: "Nome", valor: (l: { name: string; nota: number | null }) => l.name },
    { title: "Nota", valor: (l: { name: string; nota: number | null }) => numberCell(l.nota) },
  ];

  it("monta cabeçalho e linhas com ponto e vírgula", () => {
    const csv = generateCsv(columns, [{ name: "Ana", nota: 8.5 }]);
    const linhas = csv.replace("﻿", "").split("\r\n");

    expect(linhas[0]).toBe("Nome;Nota");
    expect(linhas[1]).toBe("Ana;8,5");
  });

  /**
   * Sem a marca de ordem de byte, o Excel lê UTF-8 como Latin-1 e "Matrícula"
   * vira "MatrÃ­cula". É a causa número um de relatório com caracteres
   * estranhos.
   */
  it("começa com a marca de ordem de byte", () => {
    expect(generateCsv(columns, [])).toMatch(/^﻿/);
  });

  it("gera só o cabeçalho quando não há linha", () => {
    const csv = generateCsv(columns, []);
    expect(csv.replace("﻿", "")).toBe("Nome;Nota");
  });

  it("usa CRLF, que é o que o Excel no Windows espera", () => {
    const csv = generateCsv(columns, [
      { name: "Ana", nota: 1 },
      { name: "Bruno", nota: 2 },
    ]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("nomeDoArquivo", () => {
  it("tira acento e espaço, e carimba ano e data", () => {
    expect(fileName("Frequência por turma", 2026, "2026-09-22")).toBe(
      "frequencia-por-turma-2026-2026-09-22.csv",
    );
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(fileName("  Notas!  ", 2026, "2026-09-22")).toBe("notas-2026-2026-09-22.csv");
  });
});
