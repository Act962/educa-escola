import { z } from "zod";

/**
 * Os treze apps do ecossistema, como chave.
 *
 * Espelho em Zod da lista da tela: o teste de arquitetura proíbe este arquivo
 * de importar `@educa-escola/db/schema`, e `app_key` é `text` no banco de
 * propósito — app novo no Órbita não deve exigir migration aqui.
 */
export const APP_KEYS = [
  "crm-tracking",
  "chat",
  "agendas",
  "forms",
  "workspace",
  "payment",
  "nbox",
  "disparo",
  "linnker",
  "pages",
  "route",
  "trafego",
  "astro",
] as const;

export const appKey = z.enum(APP_KEYS);

export const installAppInput = z.object({
  appKey,
  /**
   * O custo que a tela mostrou quando a pessoa clicou.
   *
   * Vem junto para o service recusar quando o preço mudou no Órbita entre o
   * carregamento e o clique — confirmar um valor e pagar outro é o defeito
   * que este campo existe para impedir.
   */
  expectedSetupCost: z.number().int().min(0),
});

export const removeAppInput = z.object({ appKey });

export const openAppInput = z.object({
  appKey,
  /** `true` pede ao Órbita o layout sem a navegação dele, para o embutido. */
  embedded: z.boolean().default(false),
});

export type AppKey = (typeof APP_KEYS)[number];
export type InstallAppInput = z.infer<typeof installAppInput>;
export type RemoveAppInput = z.infer<typeof removeAppInput>;
export type OpenAppInput = z.infer<typeof openAppInput>;
