import { sql } from "drizzle-orm";

import type { DbHandle } from "./types";

/**
 * Confirma que o banco responde a uma consulta.
 *
 * Mora aqui, e não em `packages/api`, porque é query — e o teste de
 * arquitetura da API só admite query dentro de `repository.ts`. Não é
 * consulta de domínio nem toca tabela, então não pende de escola.
 *
 * O prazo existe porque um Postgres travado não recusa a conexão: ele
 * simplesmente não responde. Sem limite, o healthcheck ficaria pendurado até
 * o timeout do orquestrador, e o erro que chega lá é "timeout", não "banco".
 */
export async function pingDatabase(db: DbHandle, timeoutMs = 2000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const prazo = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`banco não respondeu em ${timeoutMs} ms`)),
      timeoutMs,
    );
  });

  try {
    await Promise.race([db.execute(sql`select 1`), prazo]);
  } finally {
    clearTimeout(timer);
  }
}
