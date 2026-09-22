import { describe, expect, it } from "vitest";

import { DEFAULT_THRESHOLD, distance, identify, MINIMUM_MARGIN } from "./recognition";

/** Vetor pequeno: a regra é a mesma em 3 ou em 128 dimensões. */
const molde = (studentId: string, descriptor: number[]) => ({ studentId, descriptor });

describe("distancia", () => {
  it("é zero para o mesmo vetor", () => {
    expect(distance([1, 2, 3], [1, 2, 3])).toBe(0);
  });

  it("mede o que deve medir", () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  /**
   * Tamanhos diferentes vêm de extratores diferentes. A conta devolveria um
   * número com cara de resposta, e alguém compararia com o limiar.
   */
  it("recusa comparar vetores de tamanhos diferentes", () => {
    expect(() => distance([1, 2], [1, 2, 3])).toThrow(/tamanhos diferentes/);
  });
});

describe("identificar", () => {
  const conhecidos = [molde("ana", [0, 0, 0]), molde("bruno", [10, 10, 10])];

  it("acha quem está perto", () => {
    expect(identify([0.1, 0, 0], conhecidos)).toEqual({
      tipo: "reconhecido",
      studentId: "ana",
      distance: expect.closeTo(0.1, 5),
    });
  });

  /** Quem não está cadastrado não pode virar o cadastrado mais próximo. */
  it("não reconhece ninguém quando o mais perto está além do limiar", () => {
    const verdict = identify([5, 5, 5], conhecidos);
    expect(verdict.tipo).toBe("ninguem");
  });

  it("sem molde nenhum, não reconhece", () => {
    expect(identify([1, 2, 3], [])).toEqual({ tipo: "ninguem", bestDistance: null });
  });

  /**
   * O caso que existe de verdade numa escola: irmãos. Dois moldes quase à
   * mesma distância não distinguem ninguém — escolher o menor por centésimos
   * é escolher no palpite, e liberar a criança errada não se desfaz.
   */
  it("recusa quando dois alunos estão quase igualmente perto", () => {
    const irmaos = [molde("carla", [0, 0, 0]), molde("clara", [0.02, 0, 0])];
    const verdict = identify([0.01, 0, 0], irmaos);

    expect(verdict.tipo).toBe("ambiguo");
  });

  /** Ambíguo é só entre candidatos aceitáveis: longe demais não disputa nada. */
  it("não chama de ambíguo quando o segundo está fora do limiar", () => {
    const verdict = identify([0, 0, 0], [molde("ana", [0, 0, 0]), molde("bruno", [9, 9, 9])]);
    expect(verdict).toEqual({ tipo: "reconhecido", studentId: "ana", distance: 0 });
  });

  it("respeita a borda do limiar", () => {
    const quaseNoLimite = [DEFAULT_THRESHOLD - 0.001, 0, 0];
    const passouDoLimite = [DEFAULT_THRESHOLD + 0.001, 0, 0];
    const so = [molde("ana", [0, 0, 0])];

    expect(identify(quaseNoLimite, so).tipo).toBe("reconhecido");
    expect(identify(passouDoLimite, so).tipo).toBe("ninguem");
  });

  it("a margem mínima é o que separa reconhecer de adivinhar", () => {
    const so = [molde("ana", [0, 0, 0]), molde("bia", [MINIMUM_MARGIN * 2, 0, 0])];
    // Encostado na Ana: a diferença para a Bia é justamente a margem.
    expect(identify([0, 0, 0], so).tipo).toBe("reconhecido");
    // No meio das duas: nenhuma distinção possível.
    expect(identify([MINIMUM_MARGIN, 0, 0], so).tipo).toBe("ambiguo");
  });
});
