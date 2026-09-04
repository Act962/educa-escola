import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

/**
 * O monorepo mantém um único arquivo de ambiente: `apps/web/.env`.
 *
 * `import "dotenv/config"` resolve `.env` a partir do cwd, então só funcionaria
 * quando o processo roda dentro de `apps/web` — testes, drizzle-kit e scripts
 * disparados da raiz ou de outro pacote ficariam sem env. Aqui subimos até a
 * raiz do workspace (marcada por `pnpm-workspace.yaml`) e carregamos o arquivo
 * pelo caminho absoluto, de modo que qualquer cwd enxergue o mesmo ambiente.
 *
 * Variáveis já presentes no ambiente têm precedência: dotenv não sobrescreve.
 */
export function findWorkspaceRoot(from = dirname(fileURLToPath(import.meta.url))): string | null {
  let dir = from;
  for (let depth = 0; depth < 10; depth += 1) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

let loaded = false;

export function loadEnvFile(): void {
  if (loaded) return;
  loaded = true;

  const root = findWorkspaceRoot();
  const envPath = root ? join(root, "apps", "web", ".env") : null;

  if (envPath && existsSync(envPath)) {
    dotenv.config({ path: envPath, quiet: true });
    return;
  }

  // Em container/CI não existe arquivo: as variáveis já vêm do ambiente.
  dotenv.config({ quiet: true });
}
