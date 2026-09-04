import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { loadEnvFile } from "@educa-escola/env/load";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

import * as schema from "./schema";

loadEnvFile();

const MIGRATIONS_FOLDER = join(dirname(fileURLToPath(import.meta.url)), "migrations");
const SAFE_DB_NAME = /^[A-Za-z0-9_-]+$/;

/**
 * Banco dedicado aos testes, separado do banco de desenvolvimento.
 *
 * Por padrão deriva de `DATABASE_URL` com o sufixo `_test`, para que rodar a
 * suíte nunca apague dados com que você estava trabalhando. `TEST_DATABASE_URL`
 * sobrescreve (usado no CI).
 */
export function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const base = process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      [
        "Testes de banco exigem DATABASE_URL (ou TEST_DATABASE_URL).",
        "Local: rode `pnpm run db:start` e confira apps/web/.env.",
        "CI: a variável precisa estar declarada em `tasks.test.env` no turbo.json —",
        "o Turbo roda em envMode strict e apaga o que não for declarado.",
      ].join(" "),
    );
  }

  const url = new URL(base);
  url.pathname = `${url.pathname}_test`;
  return url.toString();
}

function databaseNameOf(url: URL): string {
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!SAFE_DB_NAME.test(name)) {
    throw new Error(`Nome de banco de teste inválido: ${name}`);
  }
  return name;
}

/**
 * Cria o banco de teste caso não exista e aplica todas as migrations.
 * Roda uma vez por execução da suíte (globalSetup do Vitest).
 */
export async function ensureTestDatabase(): Promise<void> {
  const url = new URL(testDatabaseUrl());
  const name = databaseNameOf(url);

  const adminUrl = new URL(url);
  adminUrl.pathname = "/postgres";

  const admin = new Pool({ connectionString: adminUrl.toString() });
  try {
    const existing = await admin.query("select 1 from pg_database where datname = $1", [name]);
    if (existing.rowCount === 0) {
      await admin.query(`create database "${name}"`);
    }
  } finally {
    await admin.end();
  }

  const pool = new Pool({ connectionString: url.toString() });
  try {
    await migrate(drizzle(pool, { schema }), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
}

let pool: Pool | undefined;

export function createTestDb() {
  pool ??= new Pool({ connectionString: testDatabaseUrl(), max: 5 });
  return drizzle(pool, { schema });
}

export async function closeTestDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export type TestDatabase = ReturnType<typeof createTestDb>;
export type TestTransaction = Parameters<Parameters<TestDatabase["transaction"]>[0]>[0];

class Rollback extends Error {
  constructor(readonly value: unknown) {
    super("rollback");
  }
}

/**
 * Roda o corpo do teste dentro de uma transação que SEMPRE sofre rollback.
 *
 * Cada teste começa do mesmo estado sem precisar truncar tabelas, e os testes
 * podem rodar contra um banco real sem sujar um ao outro. Passe a `tx` adiante
 * para os repositórios — nada escrito aqui sobrevive ao fim do teste.
 */
export async function withRollback<T>(fn: (tx: TestTransaction) => Promise<T>): Promise<T> {
  const db = createTestDb();

  try {
    await db.transaction(async (tx) => {
      throw new Rollback(await fn(tx));
    });
  } catch (error) {
    if (error instanceof Rollback) return error.value as T;
    throw error;
  }

  /* c8 ignore next */
  throw new Error("withRollback: transação encerrou sem rollback");
}
