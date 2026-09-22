import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { COMANDO_DA_CHAVE } from "./instrucoes";

const AQUI = dirname(fileURLToPath(import.meta.url));

describe("instrucoes", () => {
  /**
   * A regra que dá razão a este arquivo existir separado: a **tela** importa
   * estas constantes, então qualquer import aqui viaja para o navegador junto.
   * Quando o comando morava em `segredo.ts` — que importa `media/crypto`, que
   * importa `node:crypto` — a tela de Configurações quebrou inteira.
   */
  it("não importa nada", () => {
    const fonte = readFileSync(join(AQUI, "instrucoes.ts"), "utf8");

    expect(fonte).not.toMatch(/^\s*import\s/m);
    expect(fonte).not.toMatch(/require\(/);
  });

  /**
   * `echo "…" >> .env` cola a variável no fim da linha anterior quando o
   * arquivo não termina em quebra de linha. As duas ficam inválidas, com o
   * mesmo erro de antes — e quem seguiu a instrução conclui que a instrução é
   * que estava errada.
   */
  it("o comando não usa `echo >>`", () => {
    expect(COMANDO_DA_CHAVE).toContain("printf");
    expect(COMANDO_DA_CHAVE).not.toMatch(/^echo/);
    expect(COMANDO_DA_CHAVE).toContain("\\n");
    expect(COMANDO_DA_CHAVE).toContain("apps/web/.env");
  });
});
