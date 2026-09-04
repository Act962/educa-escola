import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const SRC = dirname(fileURLToPath(import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return entry.isFile() && entry.name.endsWith(".ts") ? [full] : [];
  });
}

/** Importar isso significa estar montando query. */
const BUILDS_QUERIES = /from\s+"(drizzle-orm(\/[^"]*)?|@educa-escola\/db\/schema)"/;

const isProductionCode = (file: string) =>
  !file.endsWith(".test.ts") && !file.includes(`${sep}testing${sep}`);

const rel = (file: string) => relative(SRC, file).split(sep).join("/");

describe("regras de arquitetura", () => {
  /**
   * O isolamento entre escolas só se sustenta se o acesso ao banco estiver
   * concentrado. Se este teste falhar, alguém consultou o banco fora de um
   * repositório — e essa query provavelmente não filtra por escola.
   */
  it("apenas repository.ts monta query", () => {
    const offenders = sourceFiles(SRC)
      .filter(isProductionCode)
      .filter((file) => !file.endsWith(`${sep}repository.ts`))
      .filter((file) => BUILDS_QUERIES.test(readFileSync(file, "utf8")))
      .map(rel);

    expect(offenders).toEqual([]);
  });

  it("todo repositório de módulo é construído com o tenant", () => {
    const withoutTenant = sourceFiles(join(SRC, "modules"))
      .filter((file) => file.endsWith(`${sep}repository.ts`))
      .filter((file) => !readFileSync(file, "utf8").includes("tenant.schoolId"))
      .map(rel);

    expect(withoutTenant).toEqual([]);
  });

  it("todo módulo expõe repository, service e router", () => {
    const modulesDir = join(SRC, "modules");
    const incomplete = readdirSync(modulesDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const files = readdirSync(join(modulesDir, entry.name));
        return !["repository.ts", "service.ts", "router.ts"].every((f) => files.includes(f));
      })
      .map((entry) => entry.name);

    expect(incomplete).toEqual([]);
  });
});
