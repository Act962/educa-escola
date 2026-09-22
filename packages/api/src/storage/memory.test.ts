import { describe, expect, it } from "vitest";

import { testObjectStorageContract } from "./contract";
import { createMemoryStorage } from "./memory";

testObjectStorageContract("memória", async () => ({
  storage: createMemoryStorage(),
  prefix: "escolas/contrato-em-memoria/",
  cleanup: async () => {},
}));

describe("adaptador em memória", () => {
  it("guarda uma cópia: alterar o buffer depois não altera o objeto", async () => {
    const storage = createMemoryStorage();
    const body = Buffer.from("original");

    await storage.put({ key: "escolas/a/x", body, contentType: "text/plain" });
    body.write("alterado");

    expect((await storage.get("escolas/a/x")).body.toString()).toBe("original");
  });

  it("devolve uma cópia: alterar o que foi lido não altera o objeto", async () => {
    const storage = createMemoryStorage();
    await storage.put({
      key: "escolas/a/x",
      body: Buffer.from("original"),
      contentType: "text/plain",
    });

    const found = await storage.get("escolas/a/x");
    found.body.write("alterado");

    expect((await storage.get("escolas/a/x")).body.toString()).toBe("original");
  });

  it("não deixa listar o bucket inteiro com prefixo vazio", async () => {
    const storage = createMemoryStorage();
    await expect(storage.list("")).rejects.toThrow(/Prefixo vazio/);
  });
});
