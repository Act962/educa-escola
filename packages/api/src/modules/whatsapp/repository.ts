import { whatsappAccount, whatsappMessage, whatsappTemplate } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq } from "drizzle-orm";

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
