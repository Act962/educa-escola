import {
  enrollment,
  enrollmentConsent,
  enrollmentInvite,
  organization,
  student,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, eq, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/**
 * A ÚNICA consulta do sistema que não filtra por escola.
 *
 * Não há sessão no fluxo público — o responsável não tem conta —, então não
 * existe de onde tirar a escola antes de resolver o token. O próprio token é o
 * escopo: 256 bits aleatórios, guardados só como hash, únicos globalmente.
 *
 * O `schoolId` da linha encontrada é o que vira o `TenantContext` de todo o
 * resto da requisição: daqui em diante nada mais roda sem filtro de escola.
 * Copiar este padrão para qualquer outro lugar é quase certamente um erro.
 */
export function createInviteLookup(db: DbHandle) {
  return {
    async byTokenHash(tokenHash: string) {
      const [row] = await db
        .select({
          invite: enrollmentInvite,
          enrollment,
          studentName: student.name,
          studentBirthDate: student.birthDate,
          schoolName: organization.name,
        })
        .from(enrollmentInvite)
        .innerJoin(enrollment, eq(enrollment.id, enrollmentInvite.enrollmentId))
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .innerJoin(organization, eq(organization.id, enrollmentInvite.schoolId))
        .where(eq(enrollmentInvite.tokenHash, tokenHash))
        .limit(1);
      return row ?? null;
    },
  };
}

export type InviteLookup = ReturnType<typeof createInviteLookup>;

/** Tudo que acontece DEPOIS de o token ter resolvido a escola. */
function createBaseLinkRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(enrollmentInvite.schoolId, tenant.schoolId);

  return {
    async registerFailedAttempt(inviteId: string, now: Date, lock: boolean) {
      const [row] = await db
        .update(enrollmentInvite)
        .set({
          attempts: sql`${enrollmentInvite.attempts} + 1`,
          lastAttemptAt: now,
          lockedAt: lock ? now : null,
        })
        .where(and(withinSchool, eq(enrollmentInvite.id, inviteId)))
        .returning({ attempts: enrollmentInvite.attempts });
      return row ?? null;
    },

    async markVerified(inviteId: string, now: Date) {
      const [row] = await db
        .update(enrollmentInvite)
        .set({ verifiedAt: now, attempts: 0, lastAttemptAt: now })
        .where(and(withinSchool, eq(enrollmentInvite.id, inviteId)))
        .returning();
      return row ?? null;
    },

    /**
     * Uso único, gravado na mesma transação do aceite.
     *
     * O `where` exige `consumed_at is null`: se dois envios chegarem juntos,
     * só um encontra linha e o outro não grava nada.
     */
    async markConsumed(inviteId: string, now: Date) {
      const [row] = await db
        .update(enrollmentInvite)
        .set({ consumedAt: now })
        .where(
          and(
            withinSchool,
            eq(enrollmentInvite.id, inviteId),
            sql`${enrollmentInvite.consumedAt} is null`,
          ),
        )
        .returning({ id: enrollmentInvite.id });
      return row ?? null;
    },

    async recordConsents(rows: Omit<typeof enrollmentConsent.$inferInsert, "schoolId">[]) {
      if (rows.length === 0) return [];
      return db
        .insert(enrollmentConsent)
        .values(rows.map((row) => ({ ...row, schoolId: tenant.schoolId })))
        .returning({ id: enrollmentConsent.id });
    },
  };
}

/** Mesmo motivo do módulo de matrícula: `transaction` devolve o próprio tipo. */
export type EnrollmentLinkRepository = ReturnType<typeof createBaseLinkRepository> & {
  transaction<T>(fn: (repo: EnrollmentLinkRepository) => Promise<T>): Promise<T>;
};

export function createEnrollmentLinkRepository(
  db: DbHandle,
  tenant: TenantContext,
): EnrollmentLinkRepository {
  return {
    ...createBaseLinkRepository(db, tenant),
    transaction<T>(fn: (repo: EnrollmentLinkRepository) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(createEnrollmentLinkRepository(tx, tenant)));
    },
  };
}
