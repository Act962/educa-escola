import { describe, expect, it } from "vitest";

import { gerarCodigo, normalizarCodigo } from "./codigo";

/** Sorteio determinístico: sempre a primeira letra do alfabeto. */
const sempreZero = () => 0;

describe("gerarCodigo", () => {
  it("começa com duas letras do nome, para a família se reconhecer", () => {
    expect(gerarCodigo("Maria Clara", new Set(), sempreZero)).toMatch(/^MA/);
  });

  /**
   * O código é ditado por telefone e copiado de um papel. `0` e `O`, `1` e
   * `I`, `5` e `S` se confundem na fala e na letra cursiva — e um código que
   * a família digita errado vira ligação para a secretaria.
   */
  it("nunca usa símbolo ambíguo", () => {
    const proibidos = /[01I5SO]/;
    for (let i = 0; i < 300; i += 1) {
      expect(gerarCodigo("Ana Sofia", new Set())).not.toMatch(proibidos);
    }
  });

  it("tem sempre seis posições", () => {
    for (const nome of ["Ana", "Zé", "Weydson Lima Pereira", "Ítalo", "6º ano"]) {
      expect(gerarCodigo(nome, new Set())).toHaveLength(6);
    }
  });

  /** Nome sem letra usável — só acento e número — ainda precisa de código. */
  it("gera código mesmo sem prefixo possível", () => {
    expect(gerarCodigo("123", new Set(), sempreZero)).toHaveLength(6);
  });

  it("não devolve código já em uso", () => {
    const emUso = new Set(["MAAAAA"]);
    const codigo = gerarCodigo("Maria", emUso, sempreZero);

    expect(codigo).not.toBe("MAAAAA");
    expect(codigo).toHaveLength(6);
  });

  /**
   * Com a escola inteira cheia de "MA", é o prefixo que aperta o espaço. Aí
   * ele é abandonado — melhor um código sem as iniciais que erro na tela.
   */
  it("abandona o prefixo quando ele está esgotado", () => {
    const emUso = new Set<string>();
    // Todo código que o sorteio determinístico produziria com prefixo.
    emUso.add("MAAAAA");
    let sorteios = 0;
    const quaseSempreZero = () => (sorteios++ < 40 ? 0 : 0.5);

    const codigo = gerarCodigo("Maria", emUso, quaseSempreZero);
    expect(emUso.has(codigo)).toBe(false);
  });
});

describe("normalizarCodigo", () => {
  /** Ele chega ditado, copiado do WhatsApp e com hífen inventado pelo caminho. */
  it("aceita o que a pessoa digitou de verdade", () => {
    expect(normalizarCodigo("  ma-4k2z ")).toBe("MA4K2Z");
    expect(normalizarCodigo("MA 4K 2Z")).toBe("MA4K2Z");
    expect(normalizarCodigo("ma4k2z")).toBe("MA4K2Z");
  });

  it("não deixa entrada gigante virar consulta gigante", () => {
    expect(normalizarCodigo("A".repeat(500))).toHaveLength(24);
  });
});
