import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

import { loadEnvFile } from "./load";

loadEnvFile();

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    /**
     * Chave da cifragem de mídia sensível (foto do aluno), 32 bytes em base64.
     *
     * Opcional para o app subir sem ela — o CI não tem segredo de produção e
     * a suíte não precisa dela. Quem tentar gravar foto sem a chave recebe
     * erro com a instrução de como gerar, em vez de gravar em claro.
     */
    MEDIA_ENCRYPTION_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
