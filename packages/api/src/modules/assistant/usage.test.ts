import { describe, expect, it } from "vitest";

import { usageLevel, usagePercent, worstLevel } from "./usage";

describe("nivelDeUso", () => {
  it("sobe de faixa em 80% e em 95%", () => {
    expect(usageLevel(0, 200)).toBe("ok");
    expect(usageLevel(159, 200)).toBe("ok");
    expect(usageLevel(160, 200)).toBe("atencao");
    expect(usageLevel(189, 200)).toBe("atencao");
    expect(usageLevel(190, 200)).toBe("critico");
    expect(usageLevel(199, 200)).toBe("critico");
  });

  it("chama de esgotado ao alcançar o teto, não ao passar dele", () => {
    expect(usageLevel(200, 200)).toBe("esgotado");
    expect(usageLevel(240, 200)).toBe("esgotado");
  });

  /**
   * Teto nulo é "a escola não disse quanto aceita gastar". Pintar isso de
   * vermelho inventaria um limite que ninguém escolheu.
   */
  it("sem teto declarado não alerta nada", () => {
    for (const teto of [null, undefined, 0]) {
      expect(usageLevel(999_999, teto)).toBe("ok");
      expect(usagePercent(999_999, teto)).toBeNull();
    }
  });
});

describe("nivelMaisGrave", () => {
  it("devolve o pior dos dois, em qualquer ordem", () => {
    expect(worstLevel("ok", "critico")).toBe("critico");
    expect(worstLevel("critico", "ok")).toBe("critico");
    expect(worstLevel("esgotado", "atencao")).toBe("esgotado");
    expect(worstLevel("ok", "ok")).toBe("ok");
  });
});

describe("porcentagemDeUso", () => {
  it("arredonda e para em 100", () => {
    expect(usagePercent(50, 200)).toBe(25);
    expect(usagePercent(1, 3)).toBe(33);
    expect(usagePercent(400, 200)).toBe(100);
  });
});
