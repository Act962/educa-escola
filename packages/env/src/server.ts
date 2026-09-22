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
    /**
     * Onde o Órbita atende.
     *
     * Opcional para o app subir sem ela — o CI não tem, e a aba Apps funciona
     * mostrando catálogo e estado. Sem ela, abrir um app é recusado com
     * instrução, em vez de mandar a pessoa para uma URL inventada.
     */
    ORBITA_BASE_URL: z.url().optional(),
    /**
     * Chave que cifra a credencial do modelo do Astro, 32 bytes em base64.
     *
     * DECISÃO-JOÃO: chave própria, e não a de mídia.
     * Quebra se: reusar `MEDIA_ENCRYPTION_KEY` amarra as duas coisas — girar a
     *   chave por causa de um incidente na foto obrigaria a recadastrar a
     *   credencial do modelo, e vice-versa. São segredos de naturezas e de
     *   ciclos diferentes.
     * Fiz assim: variável própria, opcional, declarada aqui, no `.env.example`
     *   e no `turbo.json`. Sem ela o app sobe e a tela recusa **gravar** a
     *   credencial, com a instrução de como gerar — nunca grava em claro.
     * Alternativas: reusar a de mídia · um cofre externo (Vault, AWS Secrets
     *   Manager), que é o certo quando houver mais de um segredo por escola.
     */
    ASSISTANT_ENCRYPTION_KEY: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
