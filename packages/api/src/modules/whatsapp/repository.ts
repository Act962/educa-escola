import { whatsappAccount, whatsappMessage, whatsappTemplate } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq, gte, ne, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createWhatsAppRepository(db: DbHandle, tenant: TenantContext) {
  const contaDaEscola = eq(whatsappAccount.schoolId, tenant.schoolId);
  const modeloDaEscola = eq(whatsappTemplate.schoolId, tenant.schoolId);

  return {
    async listAccounts() {
      return db
        .select()
        .from(whatsappAccount)
        .where(contaDaEscola)
        .orderBy(desc(whatsappAccount.isDefault), whatsappAccount.createdAt);
    },

    async findAccount(id: string) {
      const [row] = await db
        .select()
        .from(whatsappAccount)
        .where(and(contaDaEscola, eq(whatsappAccount.id, id)))
        .limit(1);
      return row ?? null;
    },

    /**
     * O número que o resto do sistema usa quando ninguém escolhe.
     *
     * Sem principal marcado, devolve o mais antigo em vez de `null`: escola que
     * cadastrou um número só nunca marcou nada, e exigir o clique faria a
     * integração parecer quebrada logo depois de configurada.
     */
    async defaultAccount() {
      const [row] = await db
        .select()
        .from(whatsappAccount)
        .where(contaDaEscola)
        .orderBy(desc(whatsappAccount.isDefault), whatsappAccount.createdAt)
        .limit(1);
      return row ?? null;
    },

    async insertAccount(values: Omit<typeof whatsappAccount.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(whatsappAccount)
        .values({ ...values, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * O `where` carrega o tenant **no update também**.
     *
     * Não é zelo: sem ele, um id de outra escola encontraria linha e a
     * escreveria. É a mesma regra do repositório de turma, e o lugar onde ela
     * é mais fácil de esquecer.
     */
    async updateAccount(id: string, patch: Partial<typeof whatsappAccount.$inferInsert>) {
      const [row] = await db
        .update(whatsappAccount)
        .set(patch)
        .where(and(contaDaEscola, eq(whatsappAccount.id, id)))
        .returning();
      return row ?? null;
    },

    /** Tira o principal de todos os outros. Roda antes de marcar o novo. */
    async clearDefault() {
      await db.update(whatsappAccount).set({ isDefault: false }).where(contaDaEscola);
    },

    async deleteAccount(id: string) {
      const [row] = await db
        .delete(whatsappAccount)
        .where(and(contaDaEscola, eq(whatsappAccount.id, id)))
        .returning({ id: whatsappAccount.id });
      return row ?? null;
    },

    async listTemplates() {
      return db
        .select()
        .from(whatsappTemplate)
        .where(modeloDaEscola)
        .orderBy(desc(whatsappTemplate.updatedAt));
    },

    async findTemplate(id: string) {
      const [row] = await db
        .select()
        .from(whatsappTemplate)
        .where(and(modeloDaEscola, eq(whatsappTemplate.id, id)))
        .limit(1);
      return row ?? null;
    },

    async insertTemplate(values: Omit<typeof whatsappTemplate.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(whatsappTemplate)
        .values({ ...values, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async updateTemplate(id: string, patch: Partial<typeof whatsappTemplate.$inferInsert>) {
      const [row] = await db
        .update(whatsappTemplate)
        .set(patch)
        .where(and(modeloDaEscola, eq(whatsappTemplate.id, id)))
        .returning();
      return row ?? null;
    },

    async deleteTemplate(id: string) {
      const [row] = await db
        .delete(whatsappTemplate)
        .where(and(modeloDaEscola, eq(whatsappTemplate.id, id)))
        .returning({ id: whatsappTemplate.id });
      return row ?? null;
    },

    async insertMessage(values: Omit<typeof whatsappMessage.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(whatsappMessage)
        .values({ ...values, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * O último envio de serviço para este número, nesta conta.
     *
     * É o que responde "a janela de 24 horas ainda está aberta?" — a pergunta
     * que decide se a mensagem consome uma conversa da cota gratuita. Roda
     * antes de **todo** envio de texto livre, e por isso tem índice próprio.
     *
     * O que falhou não conta: mensagem recusada pela Meta não abriu janela
     * nenhuma, e tratá-la como se tivesse aberto faria a seguinte pegar carona
     * numa conversa que não existe.
     */
    async lastServiceSendTo(accountId: string, phone: string) {
      const [row] = await db
        .select({ sentAt: whatsappMessage.sentAt })
        .from(whatsappMessage)
        .where(
          and(
            eq(whatsappMessage.schoolId, tenant.schoolId),
            eq(whatsappMessage.accountId, accountId),
            eq(whatsappMessage.toPhoneE164, phone),
            eq(whatsappMessage.billingCategory, "servico"),
            ne(whatsappMessage.status, "falhou"),
          ),
        )
        .orderBy(desc(whatsappMessage.sentAt))
        .limit(1);

      return row?.sentAt ?? null;
    },

    /**
     * O consumo da conta desde um instante: conversas abertas e mensagens por
     * modelo.
     *
     * Os dois saem da mesma varredura porque são a mesma linha — dois `select`
     * sobre o mesmo intervalo pagariam o índice duas vezes para responder à
     * mesma pergunta. Mesmo arranjo de `assistant_usage`.
     *
     * Conta **conversas**, não mensagens: é a unidade que a Meta cobra. Cinco
     * mensagens para a mesma família em duas horas são uma conversa lá, e
     * contá-las como cinco faria o painel acusar um consumo que não houve.
     */
    async countBillingSince(accountId: string, desde: Date) {
      const [row] = await db
        .select({
          conversas: sql<number>`count(*) filter (where ${whatsappMessage.openedConversation})::int`,
          mensagensPorModelo: sql<number>`count(*) filter (where ${whatsappMessage.billingCategory} = 'modelo')::int`,
        })
        .from(whatsappMessage)
        .where(
          and(
            eq(whatsappMessage.schoolId, tenant.schoolId),
            eq(whatsappMessage.accountId, accountId),
            ne(whatsappMessage.status, "falhou"),
            gte(whatsappMessage.createdAt, desde),
          ),
        );

      return row ?? { conversas: 0, mensagensPorModelo: 0 };
    },

    /** As últimas do histórico. A aba mostra as recentes, não o ano inteiro. */
    async listMessages(limite = 30) {
      return db
        .select()
        .from(whatsappMessage)
        .where(eq(whatsappMessage.schoolId, tenant.schoolId))
        .orderBy(desc(whatsappMessage.createdAt))
        .limit(limite);
    },
  };
}

export type WhatsAppRepository = ReturnType<typeof createWhatsAppRepository>;
