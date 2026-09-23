import { loadEnvFile } from "@educa-escola/env/load";

import { runMigrations } from "./migrate";

/**
 * Uso:
 *   pnpm --filter @educa-escola/db run db:migrate:deploy
 *
 * No container de produção roda antes do servidor (ver `apps/web/Dockerfile`).
 * Saída diferente de zero impede o servidor de subir — e o Coolify mantém o
 * container anterior no ar, em vez de promover um app com schema pela metade.
 */
loadEnvFile();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL não definida.");
  process.exit(1);
}

try {
  const { aplicadas, total } = await runMigrations(url);
  console.log(
    aplicadas === 0
      ? `[migrate] Nada a aplicar: ${total} migrations já estavam no banco.`
      : `[migrate] ${aplicadas} migration(s) aplicada(s); ${total} no total.`,
  );
} catch (error) {
  // O objeto inteiro, não só a mensagem: a causa do Postgres (código, detalhe,
  // posição) está no `cause`, e é ela que diz o que corrigir.
  console.error("[migrate] Falhou. Nenhuma migration deste lote ficou aplicada.");
  console.error(error);
  process.exit(1);
}
