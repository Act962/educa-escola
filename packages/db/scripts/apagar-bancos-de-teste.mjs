/**
 * Apaga os bancos de teste descartáveis desta máquina.
 *
 * Existe porque `psql` não está instalado — usa o `pg` que o monorepo já traz.
 * Mora aqui, e não na raiz, porque o pnpm isola as dependências por pacote:
 * `pg` só resolve de dentro deste workspace.
 * Só toca em bancos com sufixo conhecido de teste; o banco de desenvolvimento
 * de `DATABASE_URL` nunca entra na lista.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const env = readFileSync(new URL("../../../apps/web/.env", import.meta.url), "utf8");
const base = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!base) throw new Error("DATABASE_URL não encontrada em apps/web/.env");

const url = new URL(base);
const dev = decodeURIComponent(url.pathname.slice(1));
const alvos = [`${dev}_test`, `${dev}_renum`, `${dev}_renum2`, `${dev}_renum3`];

url.pathname = "/postgres";
const client = new Client({ connectionString: url.toString() });
await client.connect();

for (const nome of alvos) {
  if (nome === dev) continue; // cinto de segurança: nunca o banco de trabalho
  const { rowCount } = await client.query("select 1 from pg_database where datname = $1", [nome]);
  if (!rowCount) {
    console.log(`—  ${nome} (não existe)`);
    continue;
  }
  await client.query(`DROP DATABASE "${nome}" WITH (FORCE)`);
  console.log(`✓  ${nome} apagado`);
}

await client.end();
console.log("\nO próximo `pnpm run test` recria o banco de teste do zero.");
