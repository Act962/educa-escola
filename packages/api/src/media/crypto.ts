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

const ALGORITHM = "aes-256-gcm";
const IV_SIZE = 12; // 96 bits, o recomendado para GCM
const KEY_SIZE = 32; // 256 bits

export interface Encrypted {
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
  if (key.length !== KEY_SIZE) {
    throw new Error(
      `MEDIA_ENCRYPTION_KEY precisa ter ${KEY_SIZE} bytes em base64 (tem ${key.length}).`,
    );
  }

  return key;
}

/** IV novo a cada chamada: reusar IV com a mesma chave quebra o GCM. */
export function encrypt(plaintext: Buffer, key: Buffer): Encrypted {
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);

  return {
    cipher: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

/** Lança se a etiqueta não bater — isto é, se alguém mexeu no texto cifrado. */
export function decrypt(data: Encrypted, key: Buffer): Buffer {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(data.iv, "base64"));
  decipher.setAuthTag(Buffer.from(data.authTag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data.cipher, "base64")), decipher.final()]);
}

const TAG_SIZE = 16;

/** IV mais etiqueta: o que o envelope acrescenta ao tamanho do arquivo. */
export const ENVELOPE_SIZE = IV_SIZE + TAG_SIZE;

/**
 * O mesmo AES-256-GCM, num binário só: `iv ‖ etiqueta ‖ texto cifrado`.
 *
 * Existe ao lado de `encrypt` porque o destino é outro. Nas colunas do banco os
 * três pedaços cabem em três campos de texto; num objeto de bucket não há três
 * campos — e pendurar o IV e a etiqueta nos metadados do S3 seria pior do que
 * parece: metadado não é coberto pela etiqueta, some numa cópia entre buckets e
 * aparece em log de ferramenta. Dentro do corpo, o objeto é autossuficiente:
 * ou abre inteiro, ou não abre.
 */
export function encryptToEnvelope(plaintext: Buffer, key: Buffer): Buffer {
  const iv = randomBytes(IV_SIZE);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

/** Lança se a etiqueta não bater, ou se o envelope for curto demais para ter uma. */
export function decryptEnvelope(envelope: Buffer, key: Buffer): Buffer {
  if (envelope.length <= ENVELOPE_SIZE) {
    throw new Error("Envelope cifrado truncado: não cabe IV, etiqueta e conteúdo.");
  }

  const iv = envelope.subarray(0, IV_SIZE);
  const tag = envelope.subarray(IV_SIZE, ENVELOPE_SIZE);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(envelope.subarray(ENVELOPE_SIZE)), decipher.final()]);
}

/** Tamanho máximo aceito de foto. Acima disso é engano ou abuso. */
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

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
  if (!(ACCEPTED_TYPES as readonly string[]).includes(contentType)) {
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
