import { randomBytes } from "node:crypto";

import { beforeEach, describe, expect, it } from "vitest";

import { createEncryptedStorage } from "./encryption";
import { createMemoryStorage } from "./memory";
import { MAX_OBJECT_BYTES, type ObjectStorage, ObjectTooLargeError } from "./port";

const SECRET = randomBytes(32).toString("base64");
const KEY = "escolas/escola-a/alunos/x/01A";

describe("storage cifrado", () => {
  let raw: ObjectStorage;
  let encrypted: ObjectStorage;

  beforeEach(() => {
    raw = createMemoryStorage();
    encrypted = createEncryptedStorage(raw, SECRET);
  });

  it("grava e lê de volta o mesmo conteúdo", async () => {
    const body = Buffer.from("laudo da criança", "utf8");
    await encrypted.put({ key: KEY, body, contentType: "application/pdf" });

    const found = await encrypted.get(KEY);
    expect(found.body.equals(body)).toBe(true);
    expect(found.contentType).toBe("application/pdf");
  });

  /** É a razão de tudo isto existir: um bucket copiado sem a chave é ruído. */
  it("o que está no armazenamento de baixo não contém o texto claro", async () => {
    const plain = "CPF 000.000.000-00";
    await encrypted.put({ key: KEY, body: Buffer.from(plain, "utf8"), contentType: "text/plain" });

    const stored = await raw.get(KEY);
    expect(stored.body.toString("utf8")).not.toContain(plain);
    expect(stored.body.toString("latin1")).not.toContain(plain);
  });

  /**
   * GCM e não CBC: a etiqueta acusa adulteração. Num modo sem autenticação,
   * trocar a foto de uma criança pela de outra seria silencioso.
   */
  it("adulterar um byte faz a leitura falhar", async () => {
    await encrypted.put({
      key: KEY,
      body: Buffer.from("conteúdo original"),
      contentType: "text/plain",
    });

    const stored = await raw.get(KEY);
    const tampered = Buffer.from(stored.body);
    // O último byte é do texto cifrado, depois do IV e da etiqueta.
    const last = tampered.length - 1;
    tampered.writeUInt8(tampered.readUInt8(last) ^ 0x01, last);
    await raw.put({ key: KEY, body: tampered, contentType: "text/plain" });

    await expect(encrypted.get(KEY)).rejects.toThrow();
  });

  it("um envelope curto demais para ter IV e etiqueta é recusado", async () => {
    await raw.put({ key: KEY, body: Buffer.from("curto"), contentType: "text/plain" });
    await expect(encrypted.get(KEY)).rejects.toThrow(/truncado/i);
  });

  it("IV novo a cada gravação: o mesmo conteúdo não produz o mesmo objeto", async () => {
    const body = Buffer.from("mesmo conteúdo");
    await encrypted.put({ key: `${KEY}-1`, body, contentType: "text/plain" });
    await encrypted.put({ key: `${KEY}-2`, body, contentType: "text/plain" });

    const [one, two] = await Promise.all([raw.get(`${KEY}-1`), raw.get(`${KEY}-2`)]);
    expect(one.body.equals(two.body)).toBe(false);
  });

  describe("tamanho", () => {
    it("gravar devolve o tamanho do arquivo, não o do envelope", async () => {
      const body = Buffer.from("dez bytes!");
      const stored = await encrypted.put({ key: KEY, body, contentType: "text/plain" });
      expect(stored.size).toBe(body.length);
    });

    it("head desconta o envelope", async () => {
      const body = Buffer.from("dez bytes!");
      await encrypted.put({ key: KEY, body, contentType: "text/plain" });

      expect((await encrypted.head(KEY))?.size).toBe(body.length);
      // O de baixo enxerga o objeto inteiro, com IV e etiqueta.
      expect((await raw.head(KEY))?.size).toBe(body.length + 28);
    });

    /**
     * O arquivo no limite exato precisa passar.
     *
     * É o caso que justifica os dois tetos: com um só, este arquivo passaria
     * pela validação de cima e seria recusado pela de baixo, com uma mensagem
     * sobre um tamanho que o usuário não escolheu.
     */
    it("arquivo no limite exato é aceito", async () => {
      const stored = await encrypted.put({
        key: KEY,
        body: Buffer.alloc(MAX_OBJECT_BYTES, 7),
        contentType: "application/pdf",
      });
      expect(stored.size).toBe(MAX_OBJECT_BYTES);
    });

    it("um byte acima do limite é recusado", async () => {
      await expect(
        encrypted.put({
          key: KEY,
          body: Buffer.alloc(MAX_OBJECT_BYTES + 1),
          contentType: "application/pdf",
        }),
      ).rejects.toBeInstanceOf(ObjectTooLargeError);
    });
  });

  describe("sem chave configurada", () => {
    it("recusa gravar, com a instrução de como gerar", async () => {
      const withoutKey = createEncryptedStorage(createMemoryStorage(), undefined);

      await expect(
        withoutKey.put({ key: KEY, body: Buffer.from("x"), contentType: "text/plain" }),
      ).rejects.toThrow(/MEDIA_ENCRYPTION_KEY/);
    });

    /** Montar o serviço não pode falhar: só quem usa é que recebe o aviso. */
    it("construir não lança", () => {
      expect(() => createEncryptedStorage(createMemoryStorage(), undefined)).not.toThrow();
    });

    it("nada chegou ao armazenamento de baixo", async () => {
      const below = createMemoryStorage();
      const withoutKey = createEncryptedStorage(below, undefined);

      await expect(
        withoutKey.put({ key: KEY, body: Buffer.from("x"), contentType: "text/plain" }),
      ).rejects.toThrow();

      expect(await below.head(KEY)).toBeNull();
    });
  });

  it("as operações que não tocam no corpo passam direto", async () => {
    await encrypted.put({ key: KEY, body: Buffer.from("x"), contentType: "text/plain" });

    expect((await encrypted.list("escolas/escola-a/")).keys).toEqual([KEY]);
    expect(await encrypted.delete(KEY)).toEqual({ deleted: true });
    expect(await encrypted.deletePrefix("escolas/escola-a/")).toEqual({ deleted: 0 });
  });
});
