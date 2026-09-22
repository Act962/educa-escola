/**
 * Reconcilia `drizzle.__drizzle_migrations` com os arquivos renumerados.
 *
 * **Por que é preciso.** O Drizzle guarda o sha256 do conteúdo de cada
 * migration, mas **não decide por ele**: ele aplica toda entrada do journal
 * cujo `when` seja maior que o `created_at` do último registro do banco.
 *
 * A renumeração regerou 0005, 0006 e 0007 com conteúdo idêntico — mesmo hash,
 * `when` novo. No banco ficou o `created_at` antigo. Resultado: o migrate
 * considera as três inéditas e tenta reaplicá-las, falhando com "type already
 * exists" — e o `drizzle-kit migrate` engole a mensagem e devolve só exit 1.
 *
 * **O que faz.** Acerta o `created_at` das migrations cujo hash já está no
 * banco, e registra as que já têm o DDL aplicado mas nenhum registro. Não roda
 * DDL nenhum, não apaga nada: só conserta a contabilidade, para o `migrate`
 * seguinte aplicar apenas o que de fato falta.
 *
 * Use quando `drizzle-kit migrate` sair com erro depois de uma renumeração.
 * Banco novo não precisa disto.
 *
 * Mora em `packages/db/scripts/` e não na raiz porque o pnpm isola as
 * dependências por pacote: `pg` só resolve de dentro deste workspace.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";

const raiz = new URL("../src/migrations/", import.meta.url);
const journal = JSON.parse(readFileSync(new URL("meta/_journal.json", raiz), "utf8"));

const env = readFileSync(new URL("../../../apps/web/.env", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) throw new Error("DATABASE_URL não encontrada em apps/web/.env");

const client = new Client({ connectionString: url });
await client.connect();

const { rows: aplicadas } = await client.query(
  "select hash, created_at from drizzle.__drizzle_migrations",
);
const porHash = new Map(aplicadas.map((r) => [r.hash, Number(r.created_at)]));

/** Uma migration já aplicada é a que criou alguma coisa que existe. */
async function jaEstaNoBanco(tag) {
  const sql = readFileSync(new URL(`${tag}.sql`, raiz), "utf8");
  const objetos = [...sql.matchAll(/CREATE TABLE "([^"]+)"/g)].map((m) => m[1]);
  if (objetos.length === 0) return false;

  const { rows } = await client.query(
    "select count(*)::int as n from information_schema.tables where table_name = any($1)",
    [objetos],
  );
  return rows[0].n === objetos.length;
}

let consertadas = 0;
for (const entrada of journal.entries) {
  const sql = readFileSync(new URL(`${entrada.tag}.sql`, raiz), "utf8");
  const hash = createHash("sha256").update(sql).digest("hex");

  const registrada = porHash.get(hash);

  if (registrada === entrada.when) {
    console.log(`—  ${entrada.tag} (em dia)`);
    continue;
  }

  if (registrada !== undefined) {
    // Mesmo conteúdo, carimbo antigo: é a marca da renumeração. Acertar o
    // `created_at` é o que impede o migrate de tentar aplicá-la de novo.
    await client.query("update drizzle.__drizzle_migrations set created_at = $1 where hash = $2", [
      entrada.when,
      hash,
    ]);
    console.log(`✓  ${entrada.tag} carimbo corrigido (${registrada} → ${entrada.when})`);
    consertadas += 1;
    continue;
  }

  if (!(await jaEstaNoBanco(entrada.tag))) {
    console.log(`▸  ${entrada.tag} falta de verdade — o migrate vai aplicá-la`);
    continue;
  }

  await client.query(
    "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
    [hash, entrada.when],
  );
  console.log(`✓  ${entrada.tag} registrada (o DDL já estava no banco)`);
  consertadas += 1;
}

await client.end();
console.log(
  consertadas === 0
    ? "\nNada a reconciliar."
    : `\n${consertadas} registro(s) reconciliado(s). Rode \`pnpm run db:migrate\` agora.`,
);
