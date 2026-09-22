import { describe, expect, it } from "vitest";

import { createStorage } from "./index";
import { StorageError } from "./port";

const FULL_R2 = {
  accountId: "conta",
  accessKeyId: "chave",
  secretAccessKey: "segredo",
  bucket: "orbitaedu-test",
};

describe("escolha do adaptador", () => {
  it("driver memory devolve um storage utilizável", async () => {
    const storage = createStorage({ driver: "memory" });
    await storage.put({ key: "escolas/a/x", body: Buffer.from("x"), contentType: "text/plain" });
    expect((await storage.get("escolas/a/x")).body.toString()).toBe("x");
  });

  it("driver r2 com tudo configurado constrói sem ir à rede", () => {
    expect(() => createStorage({ driver: "r2", r2: FULL_R2 })).not.toThrow();
  });

  it.each([
    ["accountId", "R2_ACCOUNT_ID"],
    ["accessKeyId", "R2_ACCESS_KEY_ID"],
    ["secretAccessKey", "R2_SECRET_ACCESS_KEY"],
    ["bucket", "R2_BUCKET"],
  ])("driver r2 sem %s diz qual variável falta", (field, variable) => {
    expect(() => createStorage({ driver: "r2", r2: { ...FULL_R2, [field]: undefined } })).toThrow(
      new RegExp(variable),
    );
  });

  it("lista todas as variáveis que faltam de uma vez", () => {
    expect(() => createStorage({ driver: "r2", r2: {} })).toThrow(
      /R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET/,
    );
  });

  /**
   * Em produção, `memory` seria perda de dado silenciosa: o arquivo é aceito, a
   * tela diz que deu certo, e some no próximo deploy. Falhar alto é o único
   * jeito de isso aparecer antes de um responsável perguntar pelo laudo.
   */
  it("recusa memory em produção", () => {
    expect(() => createStorage({ driver: "memory", production: true })).toThrow(StorageError);
    expect(() => createStorage({ driver: "memory", production: true })).toThrow(/próximo deploy/);
  });

  it("aceita r2 em produção", () => {
    expect(() => createStorage({ driver: "r2", production: true, r2: FULL_R2 })).not.toThrow();
  });
});
