import { describe, expect, it } from "vitest";

import { EXTRATOR_AUSENTE, extratorDeRosto, NOME_DO_EXTRATOR } from "./extrator-de-rosto";

/**
 * A portaria tem de subir e atender pela carteirinha mesmo sem biblioteca de
 * reconhecimento. Um extrator que lança derrubaria o quiosque inteiro.
 */
describe("extrator sem biblioteca", () => {
  it("não lança ao preparar nem ao extrair", async () => {
    await expect(EXTRATOR_AUSENTE.preparar()).resolves.toBeUndefined();
    await expect(EXTRATOR_AUSENTE.extrair({} as HTMLVideoElement)).resolves.toBeNull();
  });

  it("se anuncia como indisponível, para a tela não prometer o que não tem", () => {
    expect(EXTRATOR_AUSENTE.disponivel).toBe(false);
  });
});

describe("extrator em uso", () => {
  /**
   * O nome vai gravado em cada molde, e molde de extratores diferentes não se
   * compara. Mudar de modelo sem mudar o nome faria a portaria comparar
   * vetores incomparáveis — e devolver distância com cara de resposta.
   */
  it("carrega a versão no nome do extrator", () => {
    expect(extratorDeRosto.nome).toBe(NOME_DO_EXTRATOR);
    expect(NOME_DO_EXTRATOR).toMatch(/\d+\.\d+\.\d+/);
  });

  /** Vídeo sem quadro devolveria tensor vazio e estouraria dentro do laço. */
  it("devolve nulo para vídeo que ainda não tem quadro", async () => {
    const semQuadro = { readyState: 0, videoWidth: 0 } as HTMLVideoElement;
    await expect(extratorDeRosto.extrair(semQuadro)).resolves.toBeNull();
  });
});
