import { describe, expect, it } from "vitest";

import { indicatorsFor, MAXIMUM_SCORE, ratio, type SchoolCounts } from "./indicators";

const vazia: SchoolCounts = {
  aulasComChamada: 0,
  aulasNoPrazo: 0,
  avaliacoesPublicadas: 0,
  avaliacoesSemPendencia: 0,
  comparecimentos: 0,
  registrosDeChamada: 0,
};

describe("proporcao", () => {
  /**
   * Zero e não cem. Escola sem chamada nenhuma não tem 100% no prazo — o
   * contrário premiaria quem não usa o sistema.
   */
  it("sem denominador vale zero", () => {
    expect(ratio(0, 0)).toBe(0);
    expect(ratio(5, 0)).toBe(0);
  });

  it("arredonda para inteiro", () => {
    expect(ratio(1, 3)).toBe(33);
    expect(ratio(2, 3)).toBe(67);
  });

  /** Dado incoerente não pode gerar nota acima do máximo. */
  it("não passa de cem mesmo com contagem inconsistente", () => {
    expect(ratio(12, 10)).toBe(100);
  });
});

describe("indicadoresDe", () => {
  it("soma os três indicadores", () => {
    const resultado = indicatorsFor({
      aulasComChamada: 100,
      aulasNoPrazo: 90,
      avaliacoesPublicadas: 10,
      avaliacoesSemPendencia: 8,
      comparecimentos: 950,
      registrosDeChamada: 1000,
    });

    expect(resultado).toEqual({
      chamadaNoPrazo: 90,
      notasSemPendencia: 80,
      frequenciaMedia: 95,
      points: 265,
    });
  });

  /**
   * O ponto inteiro do desenho: o placar mede proporção, não tamanho. Uma
   * escola dez vezes maior com o mesmo desempenho tira exatamente a mesma
   * nota — senão o placar mediria matrícula, e a escola pequena não teria
   * caminho nenhum para subir.
   */
  it("escola grande e escola pequena com o mesmo desempenho empatam", () => {
    const pequena = indicatorsFor({
      aulasComChamada: 50,
      aulasNoPrazo: 45,
      avaliacoesPublicadas: 5,
      avaliacoesSemPendencia: 4,
      comparecimentos: 190,
      registrosDeChamada: 200,
    });
    const grande = indicatorsFor({
      aulasComChamada: 500,
      aulasNoPrazo: 450,
      avaliacoesPublicadas: 50,
      avaliacoesSemPendencia: 40,
      comparecimentos: 1900,
      registrosDeChamada: 2000,
    });

    expect(pequena).toEqual(grande);
  });

  it("escola sem movimento fica em zero, não no topo", () => {
    expect(indicatorsFor(vazia).points).toBe(0);
  });

  it("escola impecável chega ao máximo", () => {
    const perfeita = indicatorsFor({
      aulasComChamada: 10,
      aulasNoPrazo: 10,
      avaliacoesPublicadas: 4,
      avaliacoesSemPendencia: 4,
      comparecimentos: 80,
      registrosDeChamada: 80,
    });
    expect(perfeita.points).toBe(MAXIMUM_SCORE);
  });
});
