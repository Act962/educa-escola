import { describe, expect, it } from "vitest";

import {
  EXTRATOR_AUSENTE,
  extratorDeRosto,
  NOME_DO_EXTRATOR,
  quadroPronto,
} from "./extrator-de-rosto";

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

/**
 * A guarda que derrubou a captura.
 *
 * Extrair do `<video>` depois de mostrar a prévia desmonta o vídeo, e o
 * elemento solto fica com `videoWidth` zero. A leitura desistia aqui, em
 * silêncio, e a tela acusava a foto — nítida, de frente, bem iluminada — de
 * não ter rosto. Ler do canvas é o que fecha esse buraco.
 */
describe("quadroPronto", () => {
  const video = (readyState: number, videoWidth: number) =>
    ({ readyState, videoWidth }) as HTMLVideoElement;

  it("aceita vídeo com quadro disponível", () => {
    expect(quadroPronto(video(2, 720))).toBe(true);
    expect(quadroPronto(video(4, 1280))).toBe(true);
  });

  it("recusa vídeo que ainda não tem quadro", () => {
    expect(quadroPronto(video(0, 0))).toBe(false);
    expect(quadroPronto(video(1, 720))).toBe(false);
  });

  /** Vídeo desmontado: é exatamente o estado em que a captura falhava. */
  it("recusa vídeo já solto da tela", () => {
    expect(quadroPronto(video(4, 0))).toBe(false);
  });

  it("aceita canvas com tamanho, que é um quadro já congelado", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 720;
    canvas.height = 720;
    expect(quadroPronto(canvas)).toBe(true);
  });

  it("recusa canvas vazio", () => {
    const canvas = document.createElement("canvas");
    canvas.width = 0;
    canvas.height = 0;
    expect(quadroPronto(canvas)).toBe(false);
  });
});
