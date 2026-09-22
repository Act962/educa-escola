import { APP_KEYS } from "@educa-escola/api/modules/orbita/schema";
import { describe, expect, it } from "vitest";

import { APPS_ORBITA, appOrbitaDe } from "./orbita-apps";

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
    const naTela = APPS_ORBITA.map((app) => app.key).sort();
    const esperadas = [...APP_KEYS].filter((chave) => !NATIVOS.includes(chave)).sort();

    expect(naTela).toEqual(esperadas);
  });

  it("nenhum app nativo aparece no catálogo", () => {
    for (const nativo of NATIVOS) {
      expect(appOrbitaDe(nativo)).toBeNull();
    }
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
