import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cifragem de mídia sensível na aplicação.
 *
 * A ameaça que isto endereça é concreta: a `DATABASE_URL` vive num arquivo
 * `.env` e o banco está na nuvem. Cifragem do provedor protege o disco dele,
 * não protege contra uma credencial vazada. Com a chave fora do banco, um dump
 * completo devolve ruído.
 *
 * AES-256-GCM porque além de cifrar ele autentica: a etiqueta detecta se o
 * texto cifrado foi adulterado. Modo sem autenticação deixaria alguém trocar a
 * foto de uma criança pela de outra sem que nada acusasse.
 */

const ALGORITMO = "aes-256-gcm";
const TAMANHO_IV = 12; // 96 bits, o recomendado para GCM
const TAMANHO_CHAVE = 32; // 256 bits

export interface Cifrado {
  cipher: string;
  iv: string;
  authTag: string;
}

/**
 * A chave, lida do ambiente.
 *
 * Falha alto e com instrução quando falta: uma foto gravada sem cifragem por
 * engano é pior que uma tela que não funciona, porque ninguém descobre até ser
 * tarde.
 */
export function parseKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "MEDIA_ENCRYPTION_KEY não está configurada. Gere com `openssl rand -base64 32` " +
        "e declare em apps/web/.env, em packages/env/src/server.ts e no turbo.json.",
    );
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== TAMANHO_CHAVE) {
    throw new Error(
      `MEDIA_ENCRYPTION_KEY precisa ter ${TAMANHO_CHAVE} bytes em base64 (tem ${key.length}).`,
    );
  }

  return key;
}

/** IV novo a cada chamada: reusar IV com a mesma chave quebra o GCM. */
export function encrypt(plaintext: Buffer, key: Buffer): Cifrado {
  const iv = randomBytes(TAMANHO_IV);
  const cipher = createCipheriv(ALGORITMO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/** Lança se a etiqueta não bater — isto é, se alguém mexeu no texto cifrado. */
export function decrypt(data: Cifrado, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITMO, key, Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data.cipher, "base64")), decipher.final()]);
}

/** Tamanho máximo aceito de foto. Acima disso é engano ou abuso. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const TIPOS_ACEITOS = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Lê o `data:` que a câmera produz.
 *
 * Valida tipo e tamanho aqui, e não na tela: a tela é sugestão, o servidor é
 * a regra.
 */
export function parseDataUrl(value: string): { bytes: Buffer; contentType: string } {
  const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(value);
  if (!match) throw new Error("Formato de imagem não reconhecido.");

  const [, contentType, base64] = match as unknown as [string, string, string];
  if (!(TIPOS_ACEITOS as readonly string[]).includes(contentType)) {
    throw new Error("A foto precisa ser JPEG, PNG ou WebP.");
  }

  const bytes = Buffer.from(base64, "base64");
  if (bytes.length === 0) throw new Error("A foto chegou vazia.");
  if (bytes.length > MAX_PHOTO_BYTES) {
    throw new Error("A foto passa de 2 MB. Capture de novo ou use uma imagem menor.");
  }

  return { bytes, contentType };
}

export function toDataUrl(bytes: Buffer, contentType: string): string {
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}
