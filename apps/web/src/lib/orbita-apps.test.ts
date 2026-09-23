import { APP_KEYS } from "@educa-escola/api/modules/orbita/schema";
import { describe, expect, it } from "vitest";

import { ORBITA_APPS, orbitaAppFor } from "./orbita-apps";

/**
 * A lista da tela e a do servidor têm de coincidir, menos as exceções abaixo.
 *
 * O tipo já impede acrescentar aqui uma chave que o servidor não conhece. O
 * contrário — chave no servidor sem card na tela — passa pelo compilador e
 * viraria um app que existe, cobra e ninguém enxerga. Daí este teste.
 *
 * `astro` é a exceção, e fica nomeada para não virar esquecimento: ele era o
 * décimo terceiro card e virou tela nativa. A chave continua no servidor
 * porque escola que instalou o app antes desta mudança tem linha em
 * `orbita_app_install` apontando para ela — mas card na aba Apps ofereceria
 * instalar, com custo em Stars, algo que já está aqui.
 */
const NATIVOS = ["astro"];

describe("catálogo de apps do Órbita", () => {
  it("cobre todas as chaves do servidor, menos as que viraram tela nativa", () => {
    const naTela = ORBITA_APPS.map((app) => app.key).sort();
    const esperadas = [...APP_KEYS].filter((key) => !NATIVOS.includes(key)).sort();

    expect(naTela).toEqual(esperadas);
  });

  it("nenhum app nativo aparece no catálogo", () => {
    for (const nativo of NATIVOS) {
      expect(orbitaAppFor(nativo)).toBeNull();
    }
  });

  it("não repete chave", () => {
    const keys = ORBITA_APPS.map((app) => app.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("todo app tem nome, resumo e descrição em português", () => {
    for (const app of ORBITA_APPS) {
      expect(app.name.length).toBeGreaterThan(0);
      expect(app.summary.length).toBeGreaterThan(0);
      // Descrição é o que a direção lê para decidir se vale o custo — uma
      // frase de verdade, não um rótulo repetido.
      expect(app.descricao.length).toBeGreaterThan(20);
      expect(app.descricao).not.toBe(app.summary);
    }
  });

  it("acha por chave e devolve nulo para o que não existe", () => {
    expect(orbitaAppFor("linnker")?.name).toBe("Linnker");
    expect(orbitaAppFor("nao-existe")).toBeNull();
  });
});
