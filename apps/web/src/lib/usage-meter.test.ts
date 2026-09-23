import { describe, expect, it } from "vitest";

import { percentOfCap, usageBand } from "./usage-meter";

/**
 * As bordas são o teste. Errar uma faz o medidor mudar de cor no lugar errado
 * — e o anel existe justamente para ser lido de longe, sem ninguém conferir o
 * número.
 */
describe("faixaDeUso", () => {
  it("respeita as cinco faixas, inclusive nas bordas", () => {
    expect(usageBand(0)).toBe(1);
    expect(usageBand(25)).toBe(1);
    expect(usageBand(25.1)).toBe(2);
    expect(usageBand(50)).toBe(2);
    expect(usageBand(51)).toBe(3);
    expect(usageBand(75)).toBe(3);
    expect(usageBand(76)).toBe(4);
    expect(usageBand(85)).toBe(4);
    expect(usageBand(86)).toBe(5);
    expect(usageBand(100)).toBe(5);
  });

  /** Estourar o teto é possível, e continua sendo a faixa mais quente. */
  it("acima de 100 continua na última faixa", () => {
    expect(usageBand(140)).toBe(5);
  });
});

describe("porcentagemDoTeto", () => {
  it("arredonda e para em 100", () => {
    expect(percentOfCap(50, 200)).toBe(25);
    expect(percentOfCap(1, 3)).toBe(33);
    expect(percentOfCap(400, 200)).toBe(100);
  });

  /** Sem teto não há porcentagem: anel vazio sugeriria folga não medida. */
  it("sem teto declarado não devolve porcentagem", () => {
    for (const teto of [null, undefined, 0]) {
      expect(percentOfCap(999, teto)).toBeNull();
    }
  });
});
