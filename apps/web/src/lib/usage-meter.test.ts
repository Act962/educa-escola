import { describe, expect, it } from "vitest";

import { faixaDeUso, porcentagemDoTeto } from "./usage-meter";

/**
 * As bordas são o teste. Errar uma faz o medidor mudar de cor no lugar errado
 * — e o anel existe justamente para ser lido de longe, sem ninguém conferir o
 * número.
 */
describe("faixaDeUso", () => {
  it("respeita as cinco faixas, inclusive nas bordas", () => {
    expect(faixaDeUso(0)).toBe(1);
    expect(faixaDeUso(25)).toBe(1);
    expect(faixaDeUso(25.1)).toBe(2);
    expect(faixaDeUso(50)).toBe(2);
    expect(faixaDeUso(51)).toBe(3);
    expect(faixaDeUso(75)).toBe(3);
    expect(faixaDeUso(76)).toBe(4);
    expect(faixaDeUso(85)).toBe(4);
    expect(faixaDeUso(86)).toBe(5);
    expect(faixaDeUso(100)).toBe(5);
  });

  /** Estourar o teto é possível, e continua sendo a faixa mais quente. */
  it("acima de 100 continua na última faixa", () => {
    expect(faixaDeUso(140)).toBe(5);
  });
});

describe("porcentagemDoTeto", () => {
  it("arredonda e para em 100", () => {
    expect(porcentagemDoTeto(50, 200)).toBe(25);
    expect(porcentagemDoTeto(1, 3)).toBe(33);
    expect(porcentagemDoTeto(400, 200)).toBe(100);
  });

  /** Sem teto não há porcentagem: anel vazio sugeriria folga não medida. */
  it("sem teto declarado não devolve porcentagem", () => {
    for (const teto of [null, undefined, 0]) {
      expect(porcentagemDoTeto(999, teto)).toBeNull();
    }
  });
});
