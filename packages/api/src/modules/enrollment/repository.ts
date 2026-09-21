import {
  classroom,
  enrollment,
  enrollmentConsent,
  enrollmentEvent,
  enrollmentGuardian,
  enrollmentInvite,
  student,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, desc, eq, ilike, inArray, like, lte, or, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export type EnrollmentRow = typeof enrollment.$inferSelect;
export type GuardianRow = typeof enrollmentGuardian.$inferSelect;
export type InviteRow = typeof enrollmentInvite.$inferSelect;
export type EventRow = typeof enrollmentEvent.$inferSelect;
export type ConsentRow = typeof enrollmentConsent.$inferSelect;
export type EnrollmentStatusValue = EnrollmentRow["status"];
export type EventType = EventRow["type"];
export type EventActor = EventRow["actor"];

export interface ListEnrollmentsFilters {
  search?: string;
  status?: EnrollmentStatusValue;
  academicYear?: number;
  classroomId?: string;
  shift?: string;
  limit: number;
  offset: number;
}

/**
 * Único lugar do módulo que monta query.
 *
 * Mesmo contrato dos demais: o `tenant` é exigido na construção e o filtro
 * entra em toda operação, inclusive update, para que um id de outra escola
 * não encontre linha.
 */
function createBaseEnrollmentRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(enrollment.schoolId, tenant.schoolId);

  return {
    async list(filters: ListEnrollmentsFilters) {
      const where = and(
        withinSchool,
        filters.status ? eq(enrollment.status, filters.status) : undefined,
        filters.academicYear ? eq(enrollment.academicYear, filters.academicYear) : undefined,
        filters.classroomId ? eq(enrollment.classroomId, filters.classroomId) : undefined,
        filters.shift ? eq(enrollment.shift, filters.shift) : undefined,
        filters.search
          ? or(
              ilike(student.name, `%${filters.search}%`),
              ilike(student.registration, `%${filters.search}%`),
            )
          : undefined,
      );

      return db
        .select({
          id: enrollment.id,
          status: enrollment.status,
          kind: enrollment.kind,
          academicYear: enrollment.academicYear,
          shift: enrollment.shift,
          expiresAt: enrollment.expiresAt,
          confirmedAt: enrollment.confirmedAt,
          createdAt: enrollment.createdAt,
          studentId: student.id,
          studentName: student.name,
          registration: student.registration,
          classroomId: classroom.id,
          classroomName: classroom.name,
        })
        .from(enrollment)
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .leftJoin(classroom, eq(classroom.id, enrollment.classroomId))
        .where(where)
        .orderBy(asc(enrollment.expiresAt), asc(student.name))
        .limit(filters.limit)
        .offset(filters.offset);
    },

    async countMatching(filters: Omit<ListEnrollmentsFilters, "limit" | "offset">) {
      const [row] = await db
        .select({ total: count() })
        .from(enrollment)
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .where(
          and(
            withinSchool,
            filters.status ? eq(enrollment.status, filters.status) : undefined,
            filters.academicYear ? eq(enrollment.academicYear, filters.academicYear) : undefined,
            filters.classroomId ? eq(enrollment.classroomId, filters.classroomId) : undefined,
            filters.shift ? eq(enrollment.shift, filters.shift) : undefined,
            filters.search
              ? or(
                  ilike(student.name, `%${filters.search}%`),
                  ilike(student.registration, `%${filters.search}%`),
                )
              : undefined,
          ),
        );
      return row?.total ?? 0;
    },

    /** Contagem por situação, para os rótulos do controle segmentado. */
    async countsByStatus(academicYear: number) {
      return db
        .select({ status: enrollment.status, total: count() })
        .from(enrollment)
        .where(and(withinSchool, eq(enrollment.academicYear, academicYear)))
        .groupBy(enrollment.status);
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(enrollment)
        .where(and(withinSchool, eq(enrollment.id, id)))
        .limit(1);
      return row ?? null;
    },

    async findDetail(id: string) {
      const [row] = await db
        .select({
          enrollment,
          studentName: student.name,
          registration: student.registration,
          birthDate: student.birthDate,
          classroomName: classroom.name,
        })
        .from(enrollment)
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .leftJoin(classroom, eq(classroom.id, enrollment.classroomId))
        .where(and(withinSchool, eq(enrollment.id, id)))
        .limit(1);
      return row ?? null;
    },

    /** RN-040: a ativa do aluno naquele ano, se houver. */
    async findActiveFor(studentId: string, academicYear: number) {
      const [row] = await db
        .select()
        .from(enrollment)
        .where(
          and(
            withinSchool,
            eq(enrollment.studentId, studentId),
            eq(enrollment.academicYear, academicYear),
            eq(enrollment.status, "ativa"),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    // `schoolId` sai da assinatura de propósito: ele vem do tenant, nunca da
    // entrada, e aceitá-lo aqui abriria caminho para carimbar outra escola.
    async create(data: Omit<typeof enrollment.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(enrollment)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async update(id: string, data: Partial<typeof enrollment.$inferInsert>) {
      const [row] = await db
        .update(enrollment)
        .set(data)
        .where(and(withinSchool, eq(enrollment.id, id)))
        .returning();
      return row ?? null;
    },

    /** RN-043: pendente com prazo vencido deixa de valer e libera a vaga. */
    async expireOverdue(now: Date) {
      return db
        .update(enrollment)
        .set({ status: "cancelada", cancelReason: "prazo_expirado" })
        .where(and(withinSchool, eq(enrollment.status, "pendente"), lte(enrollment.expiresAt, now)))
        .returning({ id: enrollment.id });
    },

    // ---- aluno: leitura e projeção -------------------------------------

    async findStudentById(id: string) {
      const [row] = await db
        .select()
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.id, id)))
        .limit(1);
      return row ?? null;
    },

    async findStudentByRegistration(registration: string) {
      const [row] = await db
        .select()
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.registration, registration)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Maior matrícula já emitida no ano, para a próxima sair em sequência.
     *
     * O padrão usa `_`, que no LIKE casa exatamente um caractere: só entram
     * números no formato `2026-0042`. Número herdado de outro sistema, ou
     * digitado à mão fora do formato, fica de fora da sequência em vez de
     * empurrá-la para um valor absurdo — foi esse o defeito que apareceu na
     * tela como `2026-259987`.
     *
     * Ordena por texto de propósito: com o sequencial zero-preenchido em
     * largura fixa, ordem alfabética e numérica coincidem.
     */
    async lastRegistrationOfYear(prefix: string) {
      const [row] = await db
        .select({ registration: student.registration })
        .from(student)
        .where(
          and(eq(student.schoolId, tenant.schoolId), like(student.registration, `${prefix}____`)),
        )
        .orderBy(desc(student.registration))
        .limit(1);
      return row?.registration ?? null;
    },

    async createStudent(data: Omit<typeof student.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(student)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * A projeção do vínculo sobre o aluno.
     *
     * `student.classroomId` e `student.status` continuam sendo o que a chamada
     * e a grade de notas leem. Esta é a única escrita que os altera a partir da
     * matrícula, e ela roda dentro da transação da confirmação.
     */
    async projectOntoStudent(
      studentId: string,
      data: Partial<
        Pick<
          typeof student.$inferInsert,
          "name" | "classroomId" | "status" | "shift" | "guardianName" | "birthDate"
        >
      >,
    ) {
      const [row] = await db
        .update(student)
        .set(data)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.id, studentId)))
        .returning({ id: student.id });
      return row ?? null;
    },

    async findClassroomById(id: string) {
      const [row] = await db
        .select()
        .from(classroom)
        .where(and(eq(classroom.schoolId, tenant.schoolId), eq(classroom.id, id)))
        .limit(1);
      return row ?? null;
    },

    // ---- responsáveis ---------------------------------------------------

    async addGuardian(data: Omit<typeof enrollmentGuardian.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(enrollmentGuardian)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async updateGuardian(id: string, data: Partial<typeof enrollmentGuardian.$inferInsert>) {
      const [row] = await db
        .update(enrollmentGuardian)
        .set(data)
        .where(and(eq(enrollmentGuardian.schoolId, tenant.schoolId), eq(enrollmentGuardian.id, id)))
        .returning();
      return row ?? null;
    },

    async listGuardians(enrollmentId: string) {
      return db
        .select()
        .from(enrollmentGuardian)
        .where(
          and(
            eq(enrollmentGuardian.schoolId, tenant.schoolId),
            eq(enrollmentGuardian.enrollmentId, enrollmentId),
          ),
        )
        .orderBy(desc(enrollmentGuardian.isLegal), asc(enrollmentGuardian.name));
    },

    async listGuardiansFor(enrollmentIds: string[]) {
      if (enrollmentIds.length === 0) return [];
      return db
        .select()
        .from(enrollmentGuardian)
        .where(
          and(
            eq(enrollmentGuardian.schoolId, tenant.schoolId),
            inArray(enrollmentGuardian.enrollmentId, enrollmentIds),
          ),
        )
        .orderBy(desc(enrollmentGuardian.isLegal));
    },

    // ---- convites -------------------------------------------------------

    async createInvite(data: Omit<typeof enrollmentInvite.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(enrollmentInvite)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async latestInvite(enrollmentId: string) {
      const [row] = await db
        .select()
        .from(enrollmentInvite)
        .where(
          and(
            eq(enrollmentInvite.schoolId, tenant.schoolId),
            eq(enrollmentInvite.enrollmentId, enrollmentId),
          ),
        )
        .orderBy(desc(enrollmentInvite.createdAt))
        .limit(1);
      return row ?? null;
    },

    async latestInvitesFor(enrollmentIds: string[]) {
      if (enrollmentIds.length === 0) return [];
      return db
        .select()
        .from(enrollmentInvite)
        .where(
          and(
            eq(enrollmentInvite.schoolId, tenant.schoolId),
            inArray(enrollmentInvite.enrollmentId, enrollmentIds),
          ),
        )
        .orderBy(desc(enrollmentInvite.createdAt));
    },

    /** Reemitir mata o link anterior: dois links válidos seria um bug. */
    async revokeInvitesOf(enrollmentId: string, now: Date) {
      return db
        .update(enrollmentInvite)
        .set({ revokedAt: now })
        .where(
          and(
            eq(enrollmentInvite.schoolId, tenant.schoolId),
            eq(enrollmentInvite.enrollmentId, enrollmentId),
            sql`${enrollmentInvite.revokedAt} is null`,
            sql`${enrollmentInvite.consumedAt} is null`,
          ),
        )
        .returning({ id: enrollmentInvite.id });
    },

    // ---- consentimentos e histórico -------------------------------------

    async listConsents(enrollmentId: string) {
      return db
        .select()
        .from(enrollmentConsent)
        .where(
          and(
            eq(enrollmentConsent.schoolId, tenant.schoolId),
            eq(enrollmentConsent.enrollmentId, enrollmentId),
          ),
        )
        .orderBy(asc(enrollmentConsent.purpose));
    },

    /** Append-only: não existe update nem delete de evento, de propósito. */
    async appendEvent(data: Omit<typeof enrollmentEvent.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(enrollmentEvent)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * Quais dessas matrículas já tiveram o link efetivamente entregue.
     *
     * Enquanto a entrega é manual isso volta vazio, e a lista mostra "link não
     * enviado" — que é a verdade. Quando o envio automático entrar, a mesma
     * consulta passa a distinguir enviado de pendente sem mudar a tela.
     */
    async enrollmentIdsWithEvent(enrollmentIds: string[], type: EventType) {
      if (enrollmentIds.length === 0) return [];
      const rows = await db
        .selectDistinct({ enrollmentId: enrollmentEvent.enrollmentId })
        .from(enrollmentEvent)
        .where(
          and(
            eq(enrollmentEvent.schoolId, tenant.schoolId),
            eq(enrollmentEvent.type, type),
            inArray(enrollmentEvent.enrollmentId, enrollmentIds),
          ),
        );
      return rows.map((row) => row.enrollmentId);
    },

    async listEvents(enrollmentId: string) {
      return db
        .select()
        .from(enrollmentEvent)
        .where(
          and(
            eq(enrollmentEvent.schoolId, tenant.schoolId),
            eq(enrollmentEvent.enrollmentId, enrollmentId),
          ),
        )
        .orderBy(desc(enrollmentEvent.occurredAt));
    },
  };
}

/**
 * O tipo é escrito à mão porque `transaction` devolve o próprio repositório:
 * inferir `ReturnType` sobre isso é uma referência circular. A base não se
 * menciona, então o ciclo se resolve aqui, numa linha.
 */
export type EnrollmentRepository = ReturnType<typeof createBaseEnrollmentRepository> & {
  transaction<T>(fn: (repo: EnrollmentRepository) => Promise<T>): Promise<T>;
};

export function createEnrollmentRepository(
  db: DbHandle,
  tenant: TenantContext,
): EnrollmentRepository {
  return {
    ...createBaseEnrollmentRepository(db, tenant),

    /**
     * Confirmar escreve em duas tabelas e não pode ficar pela metade.
     *
     * A transação mora aqui porque é o repositório que conhece o handle; o
     * service recebe um repositório já transacional e segue sem saber o que é
     * Drizzle.
     */
    transaction<T>(fn: (repo: EnrollmentRepository) => Promise<T>): Promise<T> {
      return db.transaction((tx) => fn(createEnrollmentRepository(tx, tenant)));
    },
  };
}
