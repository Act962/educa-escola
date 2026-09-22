import { describe, expect, it } from "vitest";

import { NIVEIS, nivelDe, pontosDe, proximoNivel, REGRAS, regraDe } from "./rules";

describe("catálogo de regras", () => {
  it("não repete chave", () => {
    const chaves = REGRAS.map((regra) => regra.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  /** Regra com zero ponto é regra que não existe; negativa é punição, e não temos. */
  it("toda regra vale pontos positivos", () => {
    for (const regra of REGRAS) {
      expect(regra.points).toBeGreaterThan(0);
    }
  });

  /** O `rationale` é o que sustenta a regra na revisão — rótulo repetido não sustenta. */
  it("toda regra explica por que existe", () => {
    for (const regra of REGRAS) {
      expect(regra.rationale.length).toBeGreaterThan(30);
      expect(regra.rationale).not.toBe(regra.label);
    }
  });

  it("acha por chave e devolve nulo para o que não existe", () => {
    expect(regraDe("aluno.presenca")?.points).toBe(2);
    expect(regraDe("aluno.inventada")).toBeNull();
  });

  it("falha alto ao pedir pontos de regra que não existe", () => {
    // @ts-expect-error — a união protege em compilação; isto cobre a chamada crua.
    expect(() => pontosDe("aluno.inventada")).toThrow(/desconhecida/);
  });

  /**
   * A presença tem de valer mais que o atraso, senão chegar na hora não
   * significa nada.
   */
  it("mantém a ordem de valor entre presença e atraso", () => {
    expect(pontosDe("aluno.presenca")).toBeGreaterThan(pontosDe("aluno.atraso"));
  });
});

describe("níveis", () => {
  it("são crescentes e começam em zero", () => {
    expect(NIVEIS[0]?.minimo).toBe(0);
    for (let i = 1; i < NIVEIS.length; i++) {
      expect(NIVEIS[i]?.minimo).toBeGreaterThan(NIVEIS[i - 1]?.minimo ?? 0);
    }
  });

  it("acerta as bordas", () => {
    expect(nivelDe(0).ordem).toBe(1);
    expect(nivelDe(149).ordem).toBe(1);
    expect(nivelDe(150).ordem).toBe(2);
    expect(nivelDe(1500).ordem).toBe(NIVEIS.length);
    expect(nivelDe(999_999).ordem).toBe(NIVEIS.length);
  });

  /** Ponto negativo não acontece, mas a tela não pode quebrar se acontecer. */
  it("não quebra com pontuação negativa", () => {
    expect(nivelDe(-10).ordem).toBe(1);
  });

  it("diz quanto falta para o próximo, e nada no último", () => {
    expect(proximoNivel(100)).toMatchObject({ faltam: 50 });
    expect(proximoNivel(1500)).toBeNull();
  });
});
