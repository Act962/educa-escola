import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";

import { permitted, router } from "../../index";
import { criarCanal, emSimulacao } from "../../messaging/whatsapp";
import type { TenantContext } from "../../trpc/tenant";
import { createWhatsAppRepository } from "./repository";
import {
  accountId,
  saveAccountInput,
  saveTemplateInput,
  sendTestInput,
  sendTextInput,
  templateId,
} from "./schema";
import { createWhatsAppService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createWhatsAppService(createWhatsAppRepository(ctx.db, ctx.tenant), {
    key: env.WHATSAPP_ENCRYPTION_KEY,
    canal: criarCanal,
    now: () => new Date(),
    // Lido aqui, uma vez por requisição: o service não conhece o ambiente, do
    // mesmo jeito que não conhece o Drizzle.
    simulacao: emSimulacao("cloud"),
  });
}

/**
 * A integração com o WhatsApp. **Toda a aba é da gestão.**
 *
 * `whatsapp: ["manage"]` na leitura também, e não só na escrita: a aba mostra
 * a credencial, o número da escola e a lista de para quem foi mandada
 * mensagem — que é mapa de contato de família. Professor e aluno têm
 * `whatsapp: []`, então a porta fecha para os dois sem recurso novo no RBAC.
 *
 * `send` é separado de `manage` porque as consequências são diferentes:
 * configurar errado se conserta na tela, mandar mensagem para a família não se
 * desfaz — e a Meta cobra por conversa iniciada.
 */
export const whatsappRouter = router({
  visao: permitted({ whatsapp: ["manage"] }).query(({ ctx }) => serviceFor(ctx).visao()),

  /**
   * A cota gratuita do mês, sozinha.
   *
   * `visao` já a traz; esta existe para quem precisa só do número — a fila de
   * disparo em massa da fase seguinte vai conferi-la antes de cada lote, e
   * puxar modelos e histórico junto seria pagar por dado que ninguém lê.
   */
  consumo: permitted({ whatsapp: ["manage"] })
    .input(accountId.partial())
    .query(({ ctx, input }) => serviceFor(ctx).consumo(input.id)),

  salvarConta: permitted({ whatsapp: ["manage"] })
    .input(saveAccountInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).salvarConta(input, ctx.membership.userId)),

  definirPrincipal: permitted({ whatsapp: ["manage"] })
    .input(accountId)
    .mutation(({ ctx, input }) => serviceFor(ctx).definirPrincipal(input.id)),

  removerConta: permitted({ whatsapp: ["manage"] })
    .input(accountId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removerConta(input.id)),

  /**
   * Mutation e não query: bate na rede da Meta a cada chamada, e cache de
   * query esconderia isso de quem clicou em "testar conexão".
   */
  testarConexao: permitted({ whatsapp: ["manage"] })
    .input(accountId.partial())
    .mutation(({ ctx, input }) => serviceFor(ctx).testarConexao(input.id)),

  salvarModelo: permitted({ whatsapp: ["manage"] })
    .input(saveTemplateInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).salvarModelo(input, ctx.membership.userId)),

  enviarParaAprovacao: permitted({ whatsapp: ["manage"] })
    .input(templateId)
    .mutation(({ ctx, input }) => serviceFor(ctx).enviarParaAprovacao(input.id)),

  sincronizar: permitted({ whatsapp: ["manage"] })
    .input(accountId.partial())
    .mutation(({ ctx, input }) => serviceFor(ctx).sincronizar(input.id)),

  removerModelo: permitted({ whatsapp: ["manage"] })
    .input(templateId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removerModelo(input.id)),

  /** Daqui para baixo, `send`: é o que de fato sai do número da escola. */
  enviarTeste: permitted({ whatsapp: ["send"] })
    .input(sendTestInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).enviarTeste(input, ctx.membership.userId)),

  enviarTexto: permitted({ whatsapp: ["send"] })
    .input(sendTextInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).enviarTexto(input, ctx.membership.userId)),
});
