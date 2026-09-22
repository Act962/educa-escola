import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "pg";
import { afterEach, describe, expect, it } from "vitest";

import { runMigrations } from "./migrate";
import { testDatabaseUrl } from "./testing";

/**
 * Cada teste migra um banco vazio e próprio.
 *
 * O banco `_test` já chega migrado pelo globalSetup, então não serve para ver
 * a migração acontecer; e bancos nomeados ao acaso não colidem com os outros
 * arquivos que rodam em paralelo.
 */
const criados: string[] = [];
const pastas: string[] = [];

function adminUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = "/postgres";
  return url.toString();
}

async function comAdmin<T>(fn: (admin: Client) => Promise<T>): Promise<T> {
  const admin = new Client({ connectionString: adminUrl() });
  await admin.connect();
  try {
    return await fn(admin);
  } finally {
    await admin.end();
  }
}

async function bancoVazio(): Promise<string> {
  const name = `migrate_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  await comAdmin((admin) => admin.query(`create database "${name}"`));
  criados.push(name);

  const url = new URL(testDatabaseUrl());
  url.pathname = `/${name}`;
  return url.toString();
}

async function consultar<T>(url: string, sql: string): Promise<T | undefined> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const { rows } = await client.query(sql);
    return rows[0] as T | undefined;
  } finally {
    await client.end();
  }
}

/** Uma pasta de migrations no formato do drizzle-kit, com o SQL que o teste quiser. */
function pastaDeMigrations(migrations: Record<string, string>): string {
  const pasta = mkdtempSync(join(tmpdir(), "integra-migrate-"));
  pastas.push(pasta);
  mkdirSync(join(pasta, "meta"));

  const entries = Object.entries(migrations).map(([tag, conteudo], idx) => {
    writeFileSync(join(pasta, `${tag}.sql`), conteudo);
    return { idx, version: "7", when: 1_700_000_000_000 + idx, tag, breakpoints: true };
  });
  writeFileSync(
    join(pasta, "meta", "_journal.json"),
    JSON.stringify({ version: "7", dialect: "postgresql", entries }),
  );
  return pasta;
}

afterEach(async () => {
  await comAdmin(async (admin) => {
    for (const name of criados.splice(0)) {
      await admin.query(`drop database if exists "${name}" with (force)`);
    }
  });
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

describe("runMigrations", () => {
  it("aplica as migrations do projeto num banco vazio, e na segunda vez não faz nada", async () => {
    const url = await bancoVazio();

    const primeira = await runMigrations(url);
    expect(primeira.aplicadas).toBeGreaterThan(0);
    expect(primeira.aplicadas).toBe(primeira.total);

    const segunda = await runMigrations(url);
    expect(segunda).toEqual({ aplicadas: 0, total: primeira.total });

    // Prova de que o schema chegou, não só a contabilidade.
    const escola = await consultar<{ existe: string | null }>(
      url,
      "select to_regclass('public.school')::text as existe",
    );
    expect(escola?.existe).toBe("school");
  });

  it("devolve o erro do Postgres e não deixa nada do lote aplicado", async () => {
    const url = await bancoVazio();
    const pasta = pastaDeMigrations({
      "0000_boa": "create table ok_antes_da_falha (id int);",
      "0001_quebrada": "alter table tabela_que_nao_existe add column x int;",
    });

    await expect(runMigrations(url, pasta)).rejects.toMatchObject({
      cause: { message: expect.stringContaining("tabela_que_nao_existe") },
    });

    // A primeira migration não sobreviveu à falha da segunda: é um lote só.
    const tabela = await consultar<{ existe: string | null }>(
      url,
      "select to_regclass('public.ok_antes_da_falha')::text as existe",
    );
    expect(tabela?.existe).toBeNull();
  });

  it("serializa execuções simultâneas sem falhar nenhuma", async () => {
    const url = await bancoVazio();

    const [a, b] = await Promise.all([runMigrations(url), runMigrations(url)]);

    // Uma aplica tudo; a outra espera o lock e encontra tudo pronto.
    expect([a.aplicadas, b.aplicadas].sort((x, y) => x - y)).toEqual([0, a.total]);
  });
});
