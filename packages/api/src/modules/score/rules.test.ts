import { describe, expect, it } from "vitest";

import { LEVELS, levelOf, nextLevel, pointsFor, RULES, ruleFor } from "./rules";

describe("catálogo de regras", () => {
  it("não repete chave", () => {
    const chaves = RULES.map((regra) => regra.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  /** Regra com zero ponto é regra que não existe; negativa é punição, e não temos. */
  it("toda regra vale pontos positivos", () => {
    for (const regra of RULES) {
      expect(regra.points).toBeGreaterThan(0);
    }
  });

  /** O `rationale` é o que sustenta a regra na revisão — rótulo repetido não sustenta. */
  it("toda regra explica por que existe", () => {
    for (const regra of RULES) {
      expect(regra.rationale.length).toBeGreaterThan(30);
      expect(regra.rationale).not.toBe(regra.label);
    }
  });

  it("acha por chave e devolve nulo para o que não existe", () => {
    expect(ruleFor("aluno.presenca")?.points).toBe(2);
    expect(ruleFor("aluno.inventada")).toBeNull();
  });

  it("falha alto ao pedir pontos de regra que não existe", () => {
    // @ts-expect-error — a união protege em compilação; isto cobre a chamada crua.
    expect(() => pointsFor("aluno.inventada")).toThrow(/desconhecida/);
  });

  /**
   * A presença tem de valer mais que o atraso, senão chegar na hora não
   * significa nada.
   */
  it("mantém a ordem de valor entre presença e atraso", () => {
    expect(pointsFor("aluno.presenca")).toBeGreaterThan(pointsFor("aluno.atraso"));
  });
});

describe("níveis", () => {
  it("são crescentes e começam em zero", () => {
    expect(LEVELS[0]?.minimo).toBe(0);
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i]?.minimo).toBeGreaterThan(LEVELS[i - 1]?.minimo ?? 0);
    }
  });

  it("acerta as bordas", () => {
    expect(levelOf(0).ordem).toBe(1);
    expect(levelOf(149).ordem).toBe(1);
    expect(levelOf(150).ordem).toBe(2);
    expect(levelOf(1500).ordem).toBe(LEVELS.length);
    expect(levelOf(999_999).ordem).toBe(LEVELS.length);
  });

  /** Ponto negativo não acontece, mas a tela não pode quebrar se acontecer. */
  it("não quebra com pontuação negativa", () => {
    expect(levelOf(-10).ordem).toBe(1);
  });

  it("diz quanto falta para o próximo, e nada no último", () => {
    expect(nextLevel(100)).toMatchObject({ faltam: 50 });
    expect(nextLevel(1500)).toBeNull();
  });
});
