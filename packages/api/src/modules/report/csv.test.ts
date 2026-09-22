import { describe, expect, it } from "vitest";

import { celula, gerarCsv, nomeDoArquivo, numero, percentual } from "./csv";

describe("celula", () => {
  it("deixa em paz o que não precisa de aspas", () => {
    expect(celula("Ana Lima")).toBe("Ana Lima");
    expect(celula(42)).toBe("42");
  });

  /** Nome com ponto e vírgula deslocaria todas as colunas seguintes. */
  it("envolve o que contém o separador", () => {
    expect(celula("Lima; Ana")).toBe('"Lima; Ana"');
  });

  it("dobra as aspas e envolve", () => {
    expect(celula('Ana "Aninha" Lima')).toBe('"Ana ""Aninha"" Lima"');
  });

  it("envolve quebra de linha, que existe em endereço", () => {
    expect(celula("Rua A, 10\nApto 2")).toBe('"Rua A, 10\nApto 2"');
  });

  /** Vazio e não "null": a célula fica em branco, como a secretaria espera. */
  it("nulo e indefinido viram célula vazia", () => {
    expect(celula(null)).toBe("");
    expect(celula(undefined)).toBe("");
  });
});

describe("numero", () => {
  /** Com ponto, o Excel em pt-BR lê 8.5 como data ou texto. */
  it("usa vírgula decimal", () => {
    expect(numero(8.5)).toBe("8,5");
    expect(numero(10, 2)).toBe("10,00");
  });

  it("nulo vira vazio, nunca zero", () => {
    expect(numero(null)).toBe("");
    expect(numero(undefined)).toBe("");
  });
});

describe("percentual", () => {
  it("converte de 0-1 para porcentagem com vírgula", () => {
    expect(percentual(0.937)).toBe("93,7%");
  });

  /** Frequência nula é "sem aula registrada", não "0%". */
  it("nulo vira vazio, e não 0%", () => {
    expect(percentual(null)).toBe("");
  });
});

describe("gerarCsv", () => {
  const colunas = [
    { titulo: "Nome", valor: (l: { nome: string; nota: number | null }) => l.nome },
    { titulo: "Nota", valor: (l: { nome: string; nota: number | null }) => numero(l.nota) },
  ];

  it("monta cabeçalho e linhas com ponto e vírgula", () => {
    const csv = gerarCsv(colunas, [{ nome: "Ana", nota: 8.5 }]);
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
    expect(gerarCsv(colunas, [])).toMatch(/^﻿/);
  });

  it("gera só o cabeçalho quando não há linha", () => {
    const csv = gerarCsv(colunas, []);
    expect(csv.replace("﻿", "")).toBe("Nome;Nota");
  });

  it("usa CRLF, que é o que o Excel no Windows espera", () => {
    const csv = gerarCsv(colunas, [
      { nome: "Ana", nota: 1 },
      { nome: "Bruno", nota: 2 },
    ]);
    expect(csv.split("\r\n")).toHaveLength(3);
  });
});

describe("nomeDoArquivo", () => {
  it("tira acento e espaço, e carimba ano e data", () => {
    expect(nomeDoArquivo("Frequência por turma", 2026, "2026-09-22")).toBe(
      "frequencia-por-turma-2026-2026-09-22.csv",
    );
  });

  it("não deixa hífen sobrando nas pontas", () => {
    expect(nomeDoArquivo("  Notas!  ", 2026, "2026-09-22")).toBe("notas-2026-2026-09-22.csv");
  });
});
