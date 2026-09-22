import { env } from "@educa-escola/env/server";

import { createMemoryStorage } from "./memory";
import type { ObjectStorage } from "./port";
import { StorageError } from "./port";
import { createR2Storage, type R2Config } from "./r2";

export type StorageDriver = "r2" | "memory";

export interface StorageConfig {
  driver: StorageDriver;
  r2?: Partial<R2Config>;
  /** Para a checagem de produção. Separado do env para ser testável. */
  production?: boolean;
}

const REQUIRED_R2_FIELDS = [
  ["accountId", "R2_ACCOUNT_ID"],
  ["accessKeyId", "R2_ACCESS_KEY_ID"],
  ["secretAccessKey", "R2_SECRET_ACCESS_KEY"],
  ["bucket", "R2_BUCKET"],
] as const;

/**
 * Escolhe o adaptador e confere a configuração.
 *
 * A validação mora aqui, e não no schema do `@educa-escola/env`, porque é
 * cruzada: as quatro variáveis do R2 são obrigatórias **se** o driver for `r2`,
 * e irrelevantes se não for. Schema com `optional()` em tudo deixa o app subir
 * no CI e no `check-types`, que é o que já se faz com `MEDIA_ENCRYPTION_KEY` e
 * `ORBITA_BASE_URL`; a conferência acontece quando alguém de fato vai usar.
 */
export function createStorage(config: StorageConfig): ObjectStorage {
  if (config.driver === "memory") {
    /**
     * Em produção, `memoria` é perda de dado silenciosa.
     *
     * O arquivo é aceito, a tela diz que deu certo, e some no próximo deploy —
     * que num rolling update é toda semana. Falhar alto aqui é o único jeito de
     * isso aparecer antes de um responsável perguntar pelo laudo que enviou.
     */
    if (config.production) {
      throw new StorageError(
        "STORAGE_DRIVER=memory em produção perderia todo arquivo no próximo deploy. " +
          "Configure STORAGE_DRIVER=r2 e as variáveis R2_*.",
      );
    }
    return createMemoryStorage();
  }

  const missing = REQUIRED_R2_FIELDS.filter(([field]) => !config.r2?.[field]).map(
    ([, variable]) => variable,
  );

  if (missing.length > 0) {
    throw new StorageError(
      `STORAGE_DRIVER=r2 exige ${missing.join(", ")}. ` +
        "Crie um token S3 em R2 → Manage API tokens e declare em apps/web/.env, " +
        "em packages/env/src/server.ts e no turbo.json.",
    );
  }

  return createR2Storage(config.r2 as R2Config);
}

let shared: ObjectStorage | undefined;

/**
 * O storage do processo, montado uma vez.
 *
 * Preguiçoso de propósito: o `S3Client` abre um pool de conexões, e construir
 * um por requisição desperdiça o handshake TLS. Preguiçoso também porque, sem
 * consumidor, nenhum boot precisa de R2 configurado — inclusive o do CI, que
 * sobe a imagem contra um Postgres descartável só para provar o `/api/health`.
 */
export function storageFromEnv(): ObjectStorage {
  shared ??= createStorage({
    driver: env.STORAGE_DRIVER,
    production: env.NODE_ENV === "production",
    r2: {
      accountId: env.R2_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
      endpoint: env.R2_ENDPOINT,
    },
  });

  return shared;
}

/** Só para teste: derruba o singleton entre casos. */
export function resetStorageFromEnv(): void {
  shared = undefined;
}

export { createEncryptedStorage } from "./encryption";
export type { BuildKeyInput, FileDomain } from "./keys";
export { buildKey, domainPrefix, entityPrefix, FILE_DOMAINS, schoolPrefix, ulid } from "./keys";
export { createMemoryStorage } from "./memory";
export * from "./port";
export type { R2Config } from "./r2";
export { createTenantStorage } from "./tenant";
