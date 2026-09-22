import { orbitaAppInstall, orbitaEvent, orbitaWorkspace } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export type WorkspaceRow = typeof orbitaWorkspace.$inferSelect;
export type InstallRow = typeof orbitaAppInstall.$inferSelect;
export type OrbitaEventType = (typeof orbitaEvent.$inferSelect)["type"];

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createOrbitaRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(orbitaAppInstall.schoolId, tenant.schoolId);

  return {
    async workspace() {
      const [row] = await db
        .select()
        .from(orbitaWorkspace)
        .where(eq(orbitaWorkspace.schoolId, tenant.schoolId))
        .limit(1);
      return row ?? null;
    },

    async connectWorkspace(data: { orbitaOrganizationId: string; userId: string; now: Date }) {
      const [row] = await db
        .insert(orbitaWorkspace)
        .values({
          schoolId: tenant.schoolId,
          orbitaOrganizationId: data.orbitaOrganizationId,
          status: "ativo",
          connectedAt: data.now,
          connectedByUserId: data.userId,
        })
        .onConflictDoUpdate({
          target: orbitaWorkspace.schoolId,
          set: {
            orbitaOrganizationId: data.orbitaOrganizationId,
            status: "ativo",
            connectedAt: data.now,
            connectedByUserId: data.userId,
          },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async listInstalls() {
      return db.select().from(orbitaAppInstall).where(withinSchool);
    },

    async findInstall(appKey: string) {
      const [row] = await db
        .select()
        .from(orbitaAppInstall)
        .where(and(withinSchool, eq(orbitaAppInstall.appKey, appKey)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Reinstalar reaproveita a linha em vez de acumular.
     *
     * Um app por escola é o que o índice único garante; sem o `onConflict` a
     * segunda instalação estouraria em vez de retomar.
     */
    async upsertInstall(data: Omit<typeof orbitaAppInstall.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(orbitaAppInstall)
        .values({ ...data, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: [orbitaAppInstall.schoolId, orbitaAppInstall.appKey],
          set: {
            status: data.status,
            setupCostSnapshot: data.setupCostSnapshot,
            monthlyCostSnapshot: data.monthlyCostSnapshot,
            installedAt: data.installedAt,
            installedByUserId: data.installedByUserId,
            removedAt: data.removedAt ?? null,
            lastError: data.lastError ?? null,
          },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async updateInstall(appKey: string, data: Partial<typeof orbitaAppInstall.$inferInsert>) {
      const [row] = await db
        .update(orbitaAppInstall)
        .set(data)
        .where(and(withinSchool, eq(orbitaAppInstall.appKey, appKey)))
        .returning();
      return row ?? null;
    },

    /** Append-only: não existe update nem delete de evento, de propósito. */
    async appendEvent(data: Omit<typeof orbitaEvent.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(orbitaEvent)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async listEvents(limit = 50) {
      return db
        .select()
        .from(orbitaEvent)
        .where(eq(orbitaEvent.schoolId, tenant.schoolId))
        .orderBy(desc(orbitaEvent.occurredAt))
        .limit(limit);
    },
  };
}

export type OrbitaRepository = ReturnType<typeof createOrbitaRepository>;
