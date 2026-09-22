import { member, organization, school, user } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, eq, inArray } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/** Papéis que enxergam a escola inteira. É o que a tela chama de "acesso total". */
export const PAPEIS_DE_GESTAO = ["owner", "admin"] as const;

/**
 * Único lugar do módulo que monta query.
 *
 * A escola vive em duas tabelas e isso é deliberado: `organization` é da auth
 * (nome, identificador) e `school` é do domínio (INEP, fuso). A leitura junta
 * as duas; a **escrita daqui toca só `school`** — mexer em `organization` por
 * fora do Better Auth passaria ao largo das permissões e dos hooks dele.
 */
export function createSettingsRepository(db: DbHandle, tenant: TenantContext) {
  return {
    async find() {
      const [row] = await db
        .select({
          id: school.id,
          name: organization.name,
          slug: organization.slug,
          inepCode: school.inepCode,
          timezone: school.timezone,
          criadaEm: organization.createdAt,
        })
        .from(school)
        .innerJoin(organization, eq(organization.id, school.id))
        .where(eq(school.id, tenant.schoolId))
        .limit(1);

      return row ?? null;
    },

    async update(patch: { inepCode: string | null }) {
      const [row] = await db
        .update(school)
        .set(patch)
        .where(eq(school.id, tenant.schoolId))
        .returning({ id: school.id, inepCode: school.inepCode });

      return row ?? null;
    },

    /** Quantas pessoas por papel. Alimenta a conferência de acessos da tela. */
    async countByRole() {
      return db
        .select({ role: member.role, total: count() })
        .from(member)
        .where(eq(member.organizationId, tenant.schoolId))
        .groupBy(member.role);
    },

    /**
     * Nome e e-mail de quem tem acesso total.
     *
     * É a única lista nominal desta tela, e existe porque "quem pode mexer em
     * tudo aqui?" é pergunta de segurança que hoje só o banco responde.
     */
    async administrators() {
      return db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          role: member.role,
          desde: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, tenant.schoolId),
            inArray(member.role, [...PAPEIS_DE_GESTAO]),
          ),
        )
        .orderBy(asc(member.role), asc(user.name));
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
