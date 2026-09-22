import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";

export const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/**
 * Chave do lock advisory da migração de deploy.
 *
 * Diferente da `SETUP_LOCK_KEY` dos testes: são bancos diferentes, mas o lock
 * advisory vale para o servidor inteiro, e um não deve esperar pelo outro.
 */
const MIGRATION_LOCK_KEY = 20260922;

export type MigrationResult = { aplicadas: number; total: number };

/**
 * Aplica as migrations pendentes e devolve quantas foram aplicadas.
 *
 * Existe em vez de `drizzle-kit migrate` porque o CLI engole a mensagem do
 * Postgres e sai só com exit 1 — num deploy, isso é um log que não diz nada.
 * Aqui o erro sobe inteiro, com a causa.
 *
 * O migrator do Drizzle aplica o lote pendente numa transação só: se uma
 * falhar, nenhuma fica aplicada, e o banco segue no schema da versão anterior.
 *
 * O lock advisory serializa containers que sobem ao mesmo tempo (réplica,
 * rolling update): o segundo espera e encontra tudo aplicado. Ele vive na
 * sessão, por isso um `Client` dedicado e não um `Pool` — num pool, lock e
 * unlock poderiam cair em conexões diferentes.
 */
export async function runMigrations(
  databaseUrl: string,
  migrationsFolder = MIGRATIONS_FOLDER,
): Promise<MigrationResult> {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query("select pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
    try {
      const antes = await countApplied(client);
      await migrate(drizzle(client), { migrationsFolder });
      const total = await countApplied(client);
      return { aplicadas: total - antes, total };
    } finally {
      await client.query("select pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]);
    }
  } finally {
    await client.end();
  }
}

/**
 * Banco novo ainda não tem a tabela de controle: conta zero.
 *
 * Em duas consultas, e não num `case`: o Postgres resolve os nomes da
 * subconsulta ao planejar, então ela falha mesmo no ramo que não executaria.
 */
async function countApplied(client: Client): Promise<number> {
  const existe = await client.query<{ tabela: string | null }>(
    "select to_regclass('drizzle.__drizzle_migrations')::text as tabela",
  );
  if (!existe.rows[0]?.tabela) return 0;

  const { rows } = await client.query<{ total: number }>(
    "select count(*)::int as total from drizzle.__drizzle_migrations",
  );
  return rows[0]?.total ?? 0;
}
