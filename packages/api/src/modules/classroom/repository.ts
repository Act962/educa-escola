import { classroom } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, eq } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export interface CreateClassroomData {
  name: string;
  academicYear: number;
}

/**
 * Único lugar do módulo que monta query.
 *
 * O `tenant` é exigido na construção e o filtro `withinSchool` entra em todas
 * as operações — inclusive update e delete, para que um id de outra escola
 * simplesmente não encontre linha. O `schoolId` da criação vem sempre do
 * tenant, nunca da entrada do usuário.
 */
export function createClassroomRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(classroom.schoolId, tenant.schoolId);

  return {
    // `async` de propósito: sem ele o retorno seria o query builder do Drizzle,
    // vazando tipos do ORM para dentro do service.
    async list() {
      return db
        .select()
        .from(classroom)
        .where(withinSchool)
        .orderBy(asc(classroom.academicYear), asc(classroom.name));
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(classroom)
        .where(and(withinSchool, eq(classroom.id, id)))
        .limit(1);
      return row ?? null;
    },

    async findByNameAndYear(name: string, year: number) {
      const [row] = await db
        .select()
        .from(classroom)
        .where(and(withinSchool, eq(classroom.name, name), eq(classroom.academicYear, year)))
        .limit(1);
      return row ?? null;
    },

    async create(data: CreateClassroomData) {
      const [row] = await db
        .insert(classroom)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async rename(id: string, name: string) {
      const [row] = await db
        .update(classroom)
        .set({ name })
        .where(and(withinSchool, eq(classroom.id, id)))
        .returning();
      return row ?? null;
    },

    async remove(id: string) {
      const [row] = await db
        .delete(classroom)
        .where(and(withinSchool, eq(classroom.id, id)))
        .returning({ id: classroom.id });
      return row ?? null;
    },
  };
}

export type ClassroomRepository = ReturnType<typeof createClassroomRepository>;
