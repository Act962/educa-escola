import { APP_KEYS } from "@educa-escola/api/modules/orbita/schema";
import { describe, expect, it } from "vitest";

import { APPS_ORBITA, appOrbitaDe } from "./apps-orbita";

/**
 * A lista da tela e a do servidor têm de coincidir.
 *
 * O tipo já impede acrescentar aqui uma chave que o servidor não conhece. O
 * contrário — chave no servidor sem card na tela — passa pelo compilador e
 * viraria um app que existe, cobra e ninguém enxerga. Daí este teste.
 */
describe("catálogo de apps do Órbita", () => {
  it("cobre exatamente as chaves que o servidor conhece", () => {
    const naTela = APPS_ORBITA.map((app) => app.key).sort();
    const noServidor = [...APP_KEYS].sort();

    expect(naTela).toEqual(noServidor);
  });

  it("não repete chave", () => {
    const chaves = APPS_ORBITA.map((app) => app.key);
    expect(new Set(chaves).size).toBe(chaves.length);
  });

  it("todo app tem nome, resumo e descrição em português", () => {
    for (const app of APPS_ORBITA) {
      expect(app.nome.length).toBeGreaterThan(0);
      expect(app.resumo.length).toBeGreaterThan(0);
      // Descrição é o que a direção lê para decidir se vale o custo — uma
      // frase de verdade, não um rótulo repetido.
      expect(app.descricao.length).toBeGreaterThan(20);
      expect(app.descricao).not.toBe(app.resumo);
    }
  });

  it("acha por chave e devolve nulo para o que não existe", () => {
    expect(appOrbitaDe("linnker")?.nome).toBe("Linnker");
    expect(appOrbitaDe("nao-existe")).toBeNull();
  });
});
