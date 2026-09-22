import { assistantSettings, assistantUsage } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, eq, gte, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createAssistantRepository(db: DbHandle, tenant: TenantContext) {
  const naEscola = eq(assistantSettings.schoolId, tenant.schoolId);

  return {
    async find() {
      const [row] = await db.select().from(assistantSettings).where(naEscola).limit(1);
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

    /** Quantas perguntas a escola fez desde um instante. Alimenta o teto. */
    async countUsageSince(desde: Date) {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(assistantUsage)
        .where(
          and(eq(assistantUsage.schoolId, tenant.schoolId), gte(assistantUsage.askedAt, desde)),
        );
      return row?.total ?? 0;
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
