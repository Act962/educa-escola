import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { testObjectStorageContract } from "./contract";
import { StorageUnavailableError } from "./port";
import { createR2Storage, type R2Config, r2Endpoint } from "./r2";

/**
 * A suíte contra o R2 de verdade.
 *
 * **Pulada sem segredo, e dizendo por quê.** O CI de pull request não tem
 * credencial — PR vindo de fork nunca recebe —, então aqui roda só o que não
 * depende de rede, e o contrato fica por conta do adaptador em memória. O passo
 * da `main`, com os segredos do repositório, é que exercita este arquivo contra
 * o bucket `orbitaedu-test`.
 *
 * "0 testes de R2" não é "R2 verde". Se o seu caso novo só for coberto aqui,
 * ele não é coberto em pull request nenhum — ponha-o no contrato.
 */

const VARIABLES = {
  R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
  R2_TEST_BUCKET: process.env.R2_TEST_BUCKET,
};

const missing = Object.entries(VARIABLES)
  .filter(([, value]) => !value)
  .map(([name]) => name);

const config: R2Config | null =
  VARIABLES.R2_ACCOUNT_ID &&
  VARIABLES.R2_ACCESS_KEY_ID &&
  VARIABLES.R2_SECRET_ACCESS_KEY &&
  VARIABLES.R2_TEST_BUCKET
    ? {
        accountId: VARIABLES.R2_ACCOUNT_ID,
        accessKeyId: VARIABLES.R2_ACCESS_KEY_ID,
        secretAccessKey: VARIABLES.R2_SECRET_ACCESS_KEY,
        bucket: VARIABLES.R2_TEST_BUCKET,
        // Deixa a suíte apontar para um endpoint compatível com S3 — o bucket
        // com domínio próprio em produção, ou um servidor local durante o
        // desenvolvimento do adaptador.
        endpoint: process.env.R2_ENDPOINT,
        forcePathStyle: process.env.R2_FORCE_PATH_STYLE === "true",
      }
    : null;

if (!config) {
  console.info(
    `[storage] Testes de integração do R2 pulados — falta ${missing.join(", ")}. ` +
      "O contrato roda contra o adaptador em memória.",
  );
}

describe.skipIf(!config)("integração com o R2", () => {
  testObjectStorageContract("R2", async () => {
    const storage = createR2Storage(config as R2Config);
    // Prefixo próprio por execução: dois CIs em paralelo não se atrapalham, e a
    // regra de ciclo de vida do bucket recolhe o que um teste morto deixar.
    const prefix = `escolas/testes-${randomUUID()}/`;

    return { storage, prefix, cleanup: () => storage.deletePrefix(prefix).then(() => undefined) };
  });

  it("credencial errada vira StorageUnavailableError, não erro cru do SDK", async () => {
    const storage = createR2Storage({
      ...(config as R2Config),
      secretAccessKey: "esta-chave-nao-vale-nada",
    });

    await expect(
      storage.put({
        key: `escolas/testes-${randomUUID()}/x`,
        body: Buffer.from("x"),
        contentType: "text/plain",
      }),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});

describe("endereço do R2", () => {
  it("monta o endpoint a partir do id da conta", () => {
    expect(
      r2Endpoint({ accountId: "abc123", accessKeyId: "k", secretAccessKey: "s", bucket: "b" }),
    ).toBe("https://abc123.r2.cloudflarestorage.com");
  });

  it("um endpoint explícito ganha do padrão", () => {
    expect(
      r2Endpoint({
        accountId: "abc123",
        accessKeyId: "k",
        secretAccessKey: "s",
        bucket: "b",
        endpoint: "https://arquivos.orbitaedu.nasaex.com",
      }),
    ).toBe("https://arquivos.orbitaedu.nasaex.com");
  });
});
