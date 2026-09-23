import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../errors";
import { MINIMUM_ATTENDANCE_RATE } from "../student/service";
import type { SettingsRepository } from "./repository";
import { createSettingsService, regrasEmVigor } from "./service";

const ESCOLA = {
  id: "e1",
  name: "Dom Pedro II",
  slug: "dom-pedro-ii",
  inepCode: "22004561",
  timezone: "America/Sao_Paulo",
  criadaEm: new Date("2026-01-10T12:00:00Z"),
};

function repositorioFalso(overrides: Partial<SettingsRepository> = {}): SettingsRepository {
  return {
    find: async () => ESCOLA,
    update: async (patch) => ({ id: ESCOLA.id, inepCode: patch.inepCode }),
    countByRole: async () => [{ role: "owner", total: 1 }],
    administrators: async () => [],
    ...overrides,
  };
}

describe("createSettingsService", () => {
  it("recusa quando a escola não existe", async () => {
    const service = createSettingsService(repositorioFalso({ find: async () => null }));

    await expect(service.overview()).rejects.toBeInstanceOf(NotFoundError);
  });

  /**
   * Campo em branco precisa virar `null`, não string vazia: "" numa coluna de
   * identificador passa por preenchido num relatório e não casa com nada.
   */
  it("apaga o código INEP quando o campo chega vazio", async () => {
    const gravados: (string | null)[] = [];
    const service = createSettingsService(
      repositorioFalso({
        update: async (patch) => {
          gravados.push(patch.inepCode);
          return { id: ESCOLA.id, inepCode: patch.inepCode };
        },
      }),
    );

    await service.updateSchool({ inepCode: "" });
    await service.updateSchool({ inepCode: "   " });
    await service.updateSchool({ inepCode: null });
    await service.updateSchool({});

    expect(gravados).toEqual([null, null, null, null]);
  });

  it("guarda o código sem os espaços em volta", async () => {
    const service = createSettingsService(repositorioFalso());

    expect(await service.updateSchool({ inepCode: " 22004561 " })).toEqual({
      id: "e1",
      inepCode: "22004561",
    });
  });
});

describe("regras em vigor", () => {
  /**
   * O ponto desta lista é não ter uma segunda cópia do número. Se alguém
   * escrever "75%" à mão aqui, o dia em que o limiar mudar a tela passa a
   * mentir — e este teste é o que impede.
   */
  it("lê a frequência mínima da mesma constante que o boletim usa", () => {
    const regra = regrasEmVigor().find((r) => r.key === "frequencia_minima");

    expect(regra?.valor).toBe(`${Math.round(MINIMUM_ATTENDANCE_RATE * 100)}% das aulas dadas`);
  });

  it("não repete chave", () => {
    const keys = regrasEmVigor().map((r) => r.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  /** Toda regra precisa dizer onde mora, senão a tela vira folclore. */
  it("toda regra aponta o arquivo que a define", () => {
    for (const regra of regrasEmVigor()) {
      expect(regra.onde).toMatch(/\.ts$/);
      expect(regra.porque.length).toBeGreaterThan(20);
    }
  });
});
