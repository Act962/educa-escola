import { randomBytes } from "node:crypto";

import { describe, expect, it } from "vitest";

import { decrypt, encrypt, MAX_PHOTO_BYTES, parseDataUrl, parseKey, toDataUrl } from "./crypto";

const CHAVE = randomBytes(32);
const FOTO = Buffer.from("conteúdo binário de uma foto", "utf8");

describe("encrypt / decrypt", () => {
  it("fecha e abre o mesmo conteúdo", () => {
    const encrypted = encrypt(FOTO, CHAVE);
    expect(decrypt(encrypted, CHAVE).toString("utf8")).toBe(FOTO.toString("utf8"));
  });

  it("o texto cifrado não contém o original", () => {
    const encrypted = encrypt(FOTO, CHAVE);
    expect(encrypted.cipher).not.toContain("foto");
    expect(Buffer.from(encrypted.cipher, "base64").toString("utf8")).not.toContain("foto");
  });

  /** Reusar IV com a mesma chave quebra o GCM — por isso ele é sorteado. */
  it("cifrar duas vezes produz textos diferentes", () => {
    const a = encrypt(FOTO, CHAVE);
    const b = encrypt(FOTO, CHAVE);

    expect(a.iv).not.toBe(b.iv);
    expect(a.cipher).not.toBe(b.cipher);
  });

  it("chave errada não abre", () => {
    const encrypted = encrypt(FOTO, CHAVE);
    expect(() => decrypt(encrypted, randomBytes(32))).toThrow();
  });

  /**
   * É o que GCM traz além de cifrar: adulterar o texto é detectado. Sem isso,
   * trocar a foto de uma criança pela de outra passaria despercebido.
   */
  it("texto cifrado adulterado é recusado", () => {
    const encrypted = encrypt(FOTO, CHAVE);
    const bytes = Buffer.from(encrypted.cipher, "base64");
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;

    expect(() => decrypt({ ...encrypted, cipher: bytes.toString("base64") }, CHAVE)).toThrow();
  });

  it("etiqueta adulterada é recusada", () => {
    const encrypted = encrypt(FOTO, CHAVE);
    expect(() =>
      decrypt({ ...encrypted, authTag: randomBytes(16).toString("base64") }, CHAVE),
    ).toThrow();
  });
});

describe("parseKey", () => {
  it("aceita 32 bytes em base64", () => {
    expect(parseKey(CHAVE.toString("base64"))).toHaveLength(32);
  });

  it("recusa chave ausente, com instrução de como gerar", () => {
    expect(() => parseKey(undefined)).toThrow(/openssl rand -base64 32/);
  });

  it("recusa chave de tamanho errado", () => {
    expect(() => parseKey(randomBytes(16).toString("base64"))).toThrow(/32 bytes/);
  });
});

describe("parseDataUrl", () => {
  const jpeg = `data:image/jpeg;base64,${Buffer.from("abc").toString("base64")}`;

  it("lê o que a câmera produz", () => {
    const { bytes, contentType } = parseDataUrl(jpeg);
    expect(contentType).toBe("image/jpeg");
    expect(bytes.toString("utf8")).toBe("abc");
  });

  it("recusa tipo fora da lista", () => {
    expect(() => parseDataUrl("data:image/svg+xml;base64,YWJj")).toThrow(/JPEG, PNG ou WebP/);
  });

  it("recusa o que não é data url", () => {
    expect(() => parseDataUrl("https://exemplo.com/foto.jpg")).toThrow(/não reconhecido/);
  });

  it("recusa conteúdo vazio", () => {
    expect(() => parseDataUrl("data:image/jpeg;base64,")).toThrow(/não reconhecido/);
  });

  /** A tela é sugestão; o limite de verdade é aqui. */
  it("recusa foto acima do limite", () => {
    const gigante = `data:image/jpeg;base64,${Buffer.alloc(MAX_PHOTO_BYTES + 1024).toString("base64")}`;
    expect(() => parseDataUrl(gigante)).toThrow(/2 MB/);
  });
});

describe("toDataUrl", () => {
  it("volta ao formato que a tag img entende", () => {
    expect(toDataUrl(Buffer.from("abc"), "image/png")).toBe("data:image/png;base64,YWJj");
  });
});
