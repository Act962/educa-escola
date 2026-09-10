/// <reference types="node" />
// O pacote usa `types: []` para impedir que componente de browser encoste em
// API de Node. Este teste varre o disco, então puxa os tipos só aqui — a
// guarda continua valendo para todo o resto do pacote.
import { type Dirent, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const UI_SRC = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(UI_SRC, "..", "..", "..");

/**
 * Onde a fidelidade com o mockup vaza: componente que escreve cor em vez de
 * consumir token. Varremos os primitivos e as telas.
 */
const SCANNED = [join(UI_SRC, "components"), join(REPO_ROOT, "apps", "web", "src")];

/** `packages/ui/src/styles/` é o único lugar onde valor de cor pode existir. */
const IGNORED = [`${sep}styles${sep}`, "routeTree.gen.ts"];

function sourceFiles(dir: string): string[] {
  let entries: Dirent[];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries.flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const HEX = /#[0-9a-fA-F]{3,8}\b/g;
/** Captura a função de cor e o conteúdo dos parênteses. */
const COLOR_FN = /\b(rgba?|hsla?|oklch|oklab|lab|lch)\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g;

/**
 * Derivar de token é legítimo — `oklch(from var(--primary) …)` e
 * `color-mix(in oklch, var(--muted), …)` não fixam cor nenhuma. O que a regra
 * persegue é o valor cravado, que é o que desalinha a tela do mockup.
 */
function colorLiterals(source: string): string[] {
  const found = [...source.matchAll(HEX)].map((m) => m[0]);

  for (const match of source.matchAll(COLOR_FN)) {
    const [whole, , args = ""] = match;
    if (!args.includes("var(--")) found.push(whole);
  }

  return found;
}

describe("design system", () => {
  /**
   * A defesa que o INTEGRA-EDU-UI-KIT.md pede: um lugar só para os valores
   * (packages/ui/src/styles) e um teste que reprova quem escapar dele. Sem
   * isso a tela nasce parecida com o mockup e se afasta um PR por vez.
   */
  it("componente não escreve cor — consome token", () => {
    const offenders = SCANNED.flatMap(sourceFiles)
      .filter((file) => !IGNORED.some((skip) => file.includes(skip)))
      .flatMap((file) => {
        const literals = colorLiterals(readFileSync(file, "utf8"));
        const name = relative(REPO_ROOT, file).split(sep).join("/");
        return literals.map((literal) => `${name}: ${literal}`);
      });

    expect(offenders).toEqual([]);
  });

  it("reconhece derivação de token como válida", () => {
    expect(colorLiterals("bg-[oklch(from_var(--primary)_0.93_calc(c*0.4)_h)]")).toEqual([]);
    expect(colorLiterals("bg-[color-mix(in_oklch,var(--muted),var(--foreground)_5%)]")).toEqual([]);
  });

  it("reprova valor de cor cravado", () => {
    expect(colorLiterals('color: "#2E93C9"')).toEqual(["#2E93C9"]);
    expect(colorLiterals("background: rgb(46, 147, 201)")).toEqual(["rgb(46, 147, 201)"]);
    expect(colorLiterals("oklch(0.631 0.121 237.1)")).toEqual(["oklch(0.631 0.121 237.1)"]);
  });
});
