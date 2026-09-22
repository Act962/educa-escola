import { beforeEach, describe, expect, it } from "vitest";

import { createMemoryStorage } from "./memory";
import { KeyOutsideTenantError, type ObjectStorage } from "./port";
import { createTenantStorage } from "./tenant";

/**
 * O isolamento entre escolas aplicado a objeto.
 *
 * Testa cada operação uma a uma, e não só `put` e `get`, porque é em `list` e
 * `deletePrefix` que o descuido deixa de ser um objeto errado e passa a ser o
 * bucket inteiro.
 */
describe("storage preso ao tenant", () => {
  let raw: ObjectStorage;
  let schoolA: ObjectStorage;

  const fromA = "escolas/escola-a/alunos/x/01A";
  const fromB = "escolas/escola-b/alunos/x/01B";

  beforeEach(async () => {
    raw = createMemoryStorage();
    schoolA = createTenantStorage(raw, { schoolId: "escola-a" });

    for (const key of [fromA, fromB]) {
      await raw.put({ key, body: Buffer.from(key), contentType: "text/plain" });
    }
  });

  it("deixa passar o que é da escola ativa", async () => {
    expect((await schoolA.get(fromA)).body.toString()).toBe(fromA);
  });

  it.each([
    [
      "put",
      (s: ObjectStorage) =>
        s.put({ key: fromB, body: Buffer.from("x"), contentType: "text/plain" }),
    ],
    ["get", (s: ObjectStorage) => s.get(fromB)],
    ["head", (s: ObjectStorage) => s.head(fromB)],
    ["delete", (s: ObjectStorage) => s.delete(fromB)],
    ["list", (s: ObjectStorage) => s.list("escolas/escola-b/")],
    ["deletePrefix", (s: ObjectStorage) => s.deletePrefix("escolas/escola-b/")],
  ])("recusa %s numa chave de outra escola", async (_operation, run) => {
    await expect(run(schoolA)).rejects.toBeInstanceOf(KeyOutsideTenantError);
  });

  it("a recusa acontece antes de tocar no armazenamento", async () => {
    await expect(schoolA.deletePrefix("escolas/escola-b/")).rejects.toBeInstanceOf(
      KeyOutsideTenantError,
    );
    // O objeto da outra escola continua lá: a conferência barrou antes.
    expect(await raw.head(fromB)).not.toBeNull();
  });

  it("recusa prefixo que enxergaria o bucket inteiro", async () => {
    await expect(schoolA.list("escolas/")).rejects.toBeInstanceOf(KeyOutsideTenantError);
  });

  /**
   * O caso que a barra final resolve: `escola-a` e `escola-a2` começam igual, e
   * sem a barra o prefixo de uma alcançaria a outra.
   */
  it("recusa escola cujo id apenas começa igual", async () => {
    await expect(schoolA.get("escolas/escola-a2/alunos/x/01C")).rejects.toBeInstanceOf(
      KeyOutsideTenantError,
    );
  });

  it("listar da própria escola não enxerga a vizinha", async () => {
    expect((await schoolA.list("escolas/escola-a/")).keys).toEqual([fromA]);
  });
});
