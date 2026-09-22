import { afterAll, describe, expect, it } from "vitest";

import { pingDatabase } from "./health";
import { closeTestDb, createTestDb } from "./testing";

afterAll(async () => {
  await closeTestDb();
});

describe("pingDatabase", () => {
  it("resolve contra um Postgres de verdade", async () => {
    await expect(pingDatabase(createTestDb())).resolves.toBeUndefined();
  });

  it("recusa quando o banco não responde dentro do prazo", async () => {
    // Um banco travado não recusa: ele só não responde. O dublê imita isso.
    const travado = { execute: () => new Promise(() => {}) } as unknown as Parameters<
      typeof pingDatabase
    >[0];

    await expect(pingDatabase(travado, 20)).rejects.toThrow("não respondeu em 20 ms");
  });
});
