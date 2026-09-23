import { assistantSettings, assistantUsage } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, eq, gte, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createAssistantRepository(db: DbHandle, tenant: TenantContext) {
  const atSchool = eq(assistantSettings.schoolId, tenant.schoolId);

  return {
    async find() {
      const [row] = await db.select().from(assistantSettings).where(atSchool).limit(1);
      return row ?? null;
    },

    /**
     * Grava a configuração. A linha nasce na primeira edição.
     *
     * O `set` recebe só o que veio: mandar `undefined` numa coluna de chave
     * deixaria a chave anterior intacta, que é exatamente o comportamento que
     * a tela promete quando a direção salva sem redigitar a credencial.
     */
    async save(patch: Partial<typeof assistantSettings.$inferInsert>) {
      const [row] = await db
        .insert(assistantSettings)
        .values({ ...patch, schoolId: tenant.schoolId })
        .onConflictDoUpdate({ target: assistantSettings.schoolId, set: patch })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * O consumo da escola desde um instante: perguntas, tokens e o que não foi
     * contado.
     *
     * Os três saem da mesma varredura porque são a mesma linha — dois
     * `select` sobre o mesmo intervalo pagariam o índice duas vezes para
     * responder à mesma pergunta.
     *
     * `semContagem` existe porque `tokens` é anulável: provedor que não
     * devolve `usage` não avança o orçamento, e um orçamento que parece
     * intacto sem estar é pior que orçamento nenhum. A tela nomeia quantas
     * respostas ficaram de fora em vez de deixar a conta parecer exata.
     */
    async usageSince(desde: Date) {
      const [row] = await db
        .select({
          perguntas: sql<number>`count(*)::int`,
          tokens: sql<number>`coalesce(sum(${assistantUsage.tokens}), 0)::int`,
          withoutCount: sql<number>`count(*) filter (where ${assistantUsage.tokens} is null)::int`,
        })
        .from(assistantUsage)
        .where(
          and(eq(assistantUsage.schoolId, tenant.schoolId), gte(assistantUsage.askedAt, desde)),
        );
      return row ?? { perguntas: 0, tokens: 0, withoutCount: 0 };
    },

    async recordUsage(data: { userId: string; role: string; tokens: number | null }) {
      const [row] = await db
        .insert(assistantUsage)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning({ id: assistantUsage.id });
      return row as { id: string };
    },
  };
}

export type AssistantRepository = ReturnType<typeof createAssistantRepository>;
