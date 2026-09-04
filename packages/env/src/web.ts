import { createEnv } from "@t3-oss/env-core";

/**
 * Variáveis disponíveis no browser.
 *
 * Só chega ao bundle o que tiver o prefixo `VITE_` **e** uma entrada em
 * `client` — declarar aqui é o passo que torna a variável utilizável.
 */
export const env = createEnv({
  clientPrefix: "VITE_",
  client: {},
  runtimeEnv: (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env,
  emptyStringAsUndefined: true,
});
