import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { organization } from "./schema";
import { closeTestDb, createTestDb, withRollback } from "./testing";

afterAll(async () => {
  await closeTestDb();
});

/**
 * Valida a própria ferramenta de teste. Se o rollback falhar em silêncio,
 * toda a suíte passa a sujar o banco e os testes viram falso-positivo.
 */
describe("withRollback", () => {
  it("devolve o valor produzido dentro da transação", async () => {
    const result = await withRollback(async () => 42);
    expect(result).toBe(42);
  });

  it("desfaz o que foi escrito quando a transação termina", async () => {
    const id = crypto.randomUUID();

    await withRollback(async (tx) => {
      await tx.insert(organization).values({
        id,
        name: "Some Escola",
        slug: `some-${id.slice(0, 8)}`,
        createdAt: new Date(),
      });

      const inside = await tx.select().from(organization).where(sql`id = ${id}`);
      expect(inside).toHaveLength(1);
    });

    const db = createTestDb();
    const after = await db.select().from(organization).where(sql`id = ${id}`);
    expect(after).toHaveLength(0);
  });

  it("propaga o erro do teste em vez de engoli-lo", async () => {
    await expect(
      withRollback(async () => {
        throw new Error("falha proposital");
      }),
    ).rejects.toThrow("falha proposital");
  });
});
