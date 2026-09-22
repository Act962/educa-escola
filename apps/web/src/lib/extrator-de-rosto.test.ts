import { describe, expect, it } from "vitest";

import { EXTRATOR_AUSENTE, extratorDeRosto, rostoDisponivel } from "./extrator-de-rosto";

/**
 * A portaria tem de subir e atender pela carteirinha mesmo sem biblioteca de
 * reconhecimento. Um extrator que lança derrubaria o quiosque inteiro por uma
 * dependência que ainda é decisão em aberto.
 */
describe("extrator sem biblioteca escolhida", () => {
  it("não lança ao preparar nem ao extrair", async () => {
    await expect(EXTRATOR_AUSENTE.preparar()).resolves.toBeUndefined();
    await expect(EXTRATOR_AUSENTE.extrair({} as HTMLVideoElement)).resolves.toBeNull();
  });

  it("se anuncia como indisponível, para a tela não prometer o que não tem", () => {
    expect(rostoDisponivel()).toBe(false);
    expect(extratorDeRosto.nome).toBe("nenhum");
  });
});
