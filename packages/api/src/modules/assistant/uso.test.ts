import { describe, expect, it } from "vitest";

import { nivelDeUso, nivelMaisGrave, porcentagemDeUso } from "./uso";

describe("nivelDeUso", () => {
  it("sobe de faixa em 80% e em 95%", () => {
    expect(nivelDeUso(0, 200)).toBe("ok");
    expect(nivelDeUso(159, 200)).toBe("ok");
    expect(nivelDeUso(160, 200)).toBe("atencao");
    expect(nivelDeUso(189, 200)).toBe("atencao");
    expect(nivelDeUso(190, 200)).toBe("critico");
    expect(nivelDeUso(199, 200)).toBe("critico");
  });

  it("chama de esgotado ao alcançar o teto, não ao passar dele", () => {
    expect(nivelDeUso(200, 200)).toBe("esgotado");
    expect(nivelDeUso(240, 200)).toBe("esgotado");
  });

  /**
   * Teto nulo é "a escola não disse quanto aceita gastar". Pintar isso de
   * vermelho inventaria um limite que ninguém escolheu.
   */
  it("sem teto declarado não alerta nada", () => {
    for (const teto of [null, undefined, 0]) {
      expect(nivelDeUso(999_999, teto)).toBe("ok");
      expect(porcentagemDeUso(999_999, teto)).toBeNull();
    }
  });
});

describe("nivelMaisGrave", () => {
  it("devolve o pior dos dois, em qualquer ordem", () => {
    expect(nivelMaisGrave("ok", "critico")).toBe("critico");
    expect(nivelMaisGrave("critico", "ok")).toBe("critico");
    expect(nivelMaisGrave("esgotado", "atencao")).toBe("esgotado");
    expect(nivelMaisGrave("ok", "ok")).toBe("ok");
  });
});

describe("porcentagemDeUso", () => {
  it("arredonda e para em 100", () => {
    expect(porcentagemDeUso(50, 200)).toBe(25);
    expect(porcentagemDeUso(1, 3)).toBe(33);
    expect(porcentagemDeUso(400, 200)).toBe(100);
  });
});
