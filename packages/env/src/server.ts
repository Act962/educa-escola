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
    /**
     * Chave que cifra o token e o app secret do WhatsApp, 32 bytes em base64.
     *
     * Chave própria, e não a do Astro nem a de mídia, pela razão já registrada
     * lá: são segredos de ciclos diferentes, e girar um por incidente não deve
     * obrigar a recadastrar os outros. Opcional para o app subir sem ela — sem
     * a chave a tela recusa **gravar** a credencial, com instrução, e nunca
     * grava em claro.
     */
    WHATSAPP_ENCRYPTION_KEY: z.string().min(1).optional(),
    /**
     * A versão da Graph API. Parâmetro, e não constante no código, porque a
     * Meta aposenta versão sozinha — subir de v21 para v23 não deve ser deploy
     * de código.
     */
    WHATSAPP_API_VERSION: z.string().min(2).default("v21.0"),
    /**
     * `memoria` força o dublê, mesmo com credencial real gravada.
     *
     * É o que permite apresentar o fluxo inteiro sem mandar mensagem para
     * família nenhuma. Ao contrário de `STORAGE_DRIVER=memory`, não é recusado
     * em produção: aqui ele não perde dado em silêncio — ele não envia, que é
     * falha visível na hora e reversível tirando a variável.
     */
    WHATSAPP_DRIVER: z.enum(["cloud", "memoria"]).default("cloud"),
    /**
     * Onde os arquivos ficam: `r2` em produção, `memory` no CI e no local.
     *
     * O padrão é `memory` porque o CI não tem segredo do R2 e PR vindo de fork
     * nunca recebe — com `r2` no padrão, todo pull request derrubaria o boot.
     * Em produção `memory` é recusado por `createStorage`: ali ele seria perda
     * de dado silenciosa, sumindo no deploy seguinte.
     */
    STORAGE_DRIVER: z.enum(["r2", "memory"]).default("memory"),
    /**
     * Credencial S3 do bucket do R2.
     *
     * Opcionais aqui, e conferidas em `createStorage`, porque a
     * obrigatoriedade é cruzada: valem se `STORAGE_DRIVER=r2` e são
     * irrelevantes se não. Schema não expressa isso sem derrubar o boot de
     * quem não usa storage — mesmo arranjo de `MEDIA_ENCRYPTION_KEY`.
     */
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_BUCKET: z.string().min(1).optional(),
    /** Sobrescreve `https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com`. */
    R2_ENDPOINT: z.url().optional(),
    /**
     * O bucket da suíte de integração. **Nunca o de produção.**
     *
     * Presente, os testes de `storage/r2.test.ts` rodam contra o R2 de verdade;
     * ausente, são pulados com aviso e o contrato fica por conta do adaptador
     * em memória.
     */
    R2_TEST_BUCKET: z.string().min(1).optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
