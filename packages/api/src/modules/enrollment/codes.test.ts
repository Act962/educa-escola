import { describe, expect, it } from "vitest";

import { classCodeOf } from "./codes";

describe("classCodeOf", () => {
  it("junta série e turno", () => {
    expect(classCodeOf("6º A", "manha").code).toBe("6M");
    expect(classCodeOf("7º C", "tarde").code).toBe("7T");
    expect(classCodeOf("9º B", "noite").code).toBe("9N");
  });

  it("a letra da turma não entra: o agrupamento é por série e turno", () => {
    expect(classCodeOf("6º A", "manha").code).toBe(classCodeOf("6º B", "manha").code);
  });

  it("descreve por extenso, para quem lê com leitor de tela", () => {
    expect(classCodeOf("6º A", "manha").label).toBe("6º ano · manhã");
    expect(classCodeOf("7º C", "tarde").label).toBe("7º ano · tarde");
  });

  it("sem turma definida não inventa código", () => {
    expect(classCodeOf(null, "manha").code).toBeNull();
    expect(classCodeOf(null, "manha").label).toBe("Turma a definir");
  });

  /**
   * Leitura de texto é frágil por natureza: `classroom` não guarda série. Vale
   * devolver nulo e a tela não mostrar nada — "0M" seria pior que o silêncio.
   */
  it("turma sem número no nome não produz código", () => {
    expect(classCodeOf("Berçário II", "manha").code).toBeNull();
    expect(classCodeOf("Berçário II", "manha").grade).toBeNull();
    expect(classCodeOf("Berçário II", "manha").label).toBe("Berçário II");
  });

  it("turno desconhecido não produz código", () => {
    expect(classCodeOf("6º A", "integral").code).toBeNull();
    expect(classCodeOf("6º A", null).code).toBeNull();
  });

  /**
   * É o ponto da decisão: o código é derivado, então avançar de série o muda
   * sozinho. Se ele morasse dentro do número de matrícula, ficaria congelado
   * no 6º ano enquanto o aluno cursa o 7º.
   */
  it("acompanha o aluno quando a turma muda", () => {
    expect(classCodeOf("6º A", "manha").code).toBe("6M");
    expect(classCodeOf("7º A", "manha").code).toBe("7M");
    expect(classCodeOf("7º A", "tarde").code).toBe("7T");
  });
});
