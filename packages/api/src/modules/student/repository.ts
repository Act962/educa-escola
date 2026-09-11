import { attendance, classroom, student } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import { ENROLLED_STATUSES } from "./schema";

export interface StudentFilters {
  search?: string;
  status?: (typeof student.$inferSelect)["status"];
  shift?: (typeof student.$inferSelect)["shift"];
  classroomId?: string;
  limit: number;
  offset: number;
}

export interface CreateStudentData {
  name: string;
  registration: string;
  classroomId?: string | null;
  shift: (typeof student.$inferSelect)["shift"];
  guardianName?: string | null;
}

/**
 * Contagem de presença vinda do banco em vez de calculada aqui: a regra
 * "atraso conta como presença" fica no service, que é testável sem Postgres.
 */
const presenceCounts = {
  presentCount: sql<number>`count(*) filter (where ${attendance.status} = 'presente')`.mapWith(
    Number,
  ),
  lateCount: sql<number>`count(*) filter (where ${attendance.status} = 'atraso')`.mapWith(Number),
  absentCount: sql<number>`count(*) filter (where ${attendance.status} = 'falta')`.mapWith(Number),
};

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createStudentRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(student.schoolId, tenant.schoolId);

  function filtersToSql(filters: Partial<StudentFilters>) {
    const clauses = [withinSchool];

    if (filters.status) clauses.push(eq(student.status, filters.status));
    if (filters.shift) clauses.push(eq(student.shift, filters.shift));
    if (filters.classroomId) clauses.push(eq(student.classroomId, filters.classroomId));
    if (filters.search) {
      const term = `%${filters.search}%`;
      const match = or(
        ilike(student.name, term),
        ilike(student.registration, term),
        ilike(student.guardianName, term),
      );
      if (match) clauses.push(match);
    }

    return and(...clauses);
  }

  return {
    async list(filters: StudentFilters) {
      return db
        .select({
          id: student.id,
          name: student.name,
          registration: student.registration,
          shift: student.shift,
          status: student.status,
          guardianName: student.guardianName,
          classroomId: student.classroomId,
          classroomName: classroom.name,
          ...presenceCounts,
        })
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .leftJoin(attendance, eq(attendance.studentId, student.id))
        .where(filtersToSql(filters))
        .groupBy(student.id, classroom.name)
        .orderBy(asc(student.name))
        .limit(filters.limit)
        .offset(filters.offset);
    },

    async countMatching(filters: Partial<StudentFilters>) {
      const [row] = await db.select({ total: count() }).from(student).where(filtersToSql(filters));
      return row?.total ?? 0;
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(student)
        .where(and(withinSchool, eq(student.id, id)))
        .limit(1);
      return row ?? null;
    },

    async findByRegistration(value: string) {
      const [row] = await db
        .select()
        .from(student)
        .where(and(withinSchool, eq(student.registration, value)))
        .limit(1);
      return row ?? null;
    },

    /** Ficha do aluno logado. Sem `userId` casado, não devolve nada. */
    async findByUserId(userId: string) {
      const [row] = await db
        .select({
          id: student.id,
          name: student.name,
          registration: student.registration,
          shift: student.shift,
          status: student.status,
          classroomId: student.classroomId,
          classroomName: classroom.name,
        })
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(withinSchool, eq(student.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Turma inteira, na ordem em que a chamada é feita.
     *
     * Sai da lista quem foi transferido ou desligado — quem está com
     * documentação pendente **continua**, porque está assistindo à aula e
     * tirá-lo daqui produziria falta silenciosa no histórico.
     */
    async listByClassroom(classroomId: string) {
      return db
        .select({
          id: student.id,
          name: student.name,
          registration: student.registration,
          ...presenceCounts,
        })
        .from(student)
        .leftJoin(attendance, eq(attendance.studentId, student.id))
        .where(
          and(
            withinSchool,
            eq(student.classroomId, classroomId),
            inArray(student.status, ENROLLED_STATUSES),
          ),
        )
        .groupBy(student.id)
        .orderBy(asc(student.name));
    },

    async create(data: CreateStudentData) {
      const [row] = await db
        .insert(student)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },
  };
}

export type StudentRepository = ReturnType<typeof createStudentRepository>;
