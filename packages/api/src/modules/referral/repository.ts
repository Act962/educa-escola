import {
  classroom,
  enrollment,
  referralConversion,
  referralLink,
  referralProgram,
  student,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { RewardKind, UpdateProgramInput } from "./schema";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createReferralRepository(db: DbHandle, tenant: TenantContext) {
  const noPrograma = eq(referralProgram.schoolId, tenant.schoolId);
  const noLink = eq(referralLink.schoolId, tenant.schoolId);
  const naConversao = eq(referralConversion.schoolId, tenant.schoolId);

  /**
   * A indicação, com a matrícula que ela gerou e o aluno que a fez.
   *
   * Traz `enrollment.status` cru: a situação do prêmio é **derivada** dele no
   * service, e não guardada. Cancelar uma matrícula cancela o desconto no
   * mesmo instante, sem ninguém ter de lembrar de sincronizar nada.
   */
  const colunasDaConversao = {
    id: referralConversion.id,
    linkId: referralConversion.linkId,
    enrollmentId: referralConversion.enrollmentId,
    rewardKind: referralConversion.rewardKind,
    rewardValue: referralConversion.rewardValue,
    note: referralConversion.note,
    createdAt: referralConversion.createdAt,
    enrollmentStatus: enrollment.status,
    academicYear: enrollment.academicYear,
    indicanteId: referralLink.studentId,
    referrerName: student.name,
    code: referralLink.code,
  };

  return {
    async findProgram() {
      const [row] = await db.select().from(referralProgram).where(noPrograma).limit(1);
      return row ?? null;
    },

    /**
     * Grava o programa. `onConflictDoUpdate` na chave da escola: a linha nasce
     * na primeira edição, e não num passo de provisionamento que alguém teria
     * de lembrar de rodar para cada escola nova.
     */
    async saveProgram(input: UpdateProgramInput) {
      const [row] = await db
        .insert(referralProgram)
        .values({ ...input, schoolId: tenant.schoolId })
        .onConflictDoUpdate({ target: referralProgram.schoolId, set: { ...input } })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async findLinkByStudent(id: string) {
      const [row] = await db
        .select()
        .from(referralLink)
        .where(and(noLink, eq(referralLink.studentId, id)))
        .limit(1);
      return row ?? null;
    },

    async findLinkByCode(code: string) {
      const [row] = await db
        .select({
          id: referralLink.id,
          studentId: referralLink.studentId,
          code: referralLink.code,
          expiresAt: referralLink.expiresAt,
          revokedAt: referralLink.revokedAt,
          studentName: student.name,
        })
        .from(referralLink)
        .innerJoin(student, eq(student.id, referralLink.studentId))
        .where(and(noLink, eq(referralLink.code, code)))
        .limit(1);
      return row ?? null;
    },

    async createLink(data: {
      studentId: string;
      code: string;
      expiresAt: Date | null;
      createdByUserId: string;
    }) {
      const [row] = await db
        .insert(referralLink)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /** Um aluno da escola, para a tela saber de quem é o link. */
    async findStudent(id: string) {
      const [row] = await db
        .select({
          id: student.id,
          name: student.name,
          registration: student.registration,
          classroomName: classroom.name,
        })
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.id, id)))
        .limit(1);
      return row ?? null;
    },

    /** A ficha de aluno ligada a uma conta. É assim que o aluno acha o próprio link. */
    async findStudentByUser(userId: string) {
      const [row] = await db
        .select({ id: student.id, name: student.name })
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    async listConversions(academicYear: number) {
      return db
        .select(colunasDaConversao)
        .from(referralConversion)
        .innerJoin(referralLink, eq(referralLink.id, referralConversion.linkId))
        .innerJoin(student, eq(student.id, referralLink.studentId))
        .innerJoin(enrollment, eq(enrollment.id, referralConversion.enrollmentId))
        .where(and(naConversao, eq(enrollment.academicYear, academicYear)))
        .orderBy(desc(referralConversion.createdAt));
    },

    /** As indicações de um aluno, que é o que a tela dele mostra. */
    async listConversionsByStudent(id: string, academicYear: number) {
      return db
        .select(colunasDaConversao)
        .from(referralConversion)
        .innerJoin(referralLink, eq(referralLink.id, referralConversion.linkId))
        .innerJoin(student, eq(student.id, referralLink.studentId))
        .innerJoin(enrollment, eq(enrollment.id, referralConversion.enrollmentId))
        .where(
          and(
            naConversao,
            eq(referralLink.studentId, id),
            eq(enrollment.academicYear, academicYear),
          ),
        )
        .orderBy(asc(referralConversion.createdAt));
    },

    /** A matrícula, para conferir que ela é desta escola antes de premiar. */
    async findEnrollment(id: string) {
      const [row] = await db
        .select({
          id: enrollment.id,
          studentId: enrollment.studentId,
          status: enrollment.status,
          academicYear: enrollment.academicYear,
          studentName: student.name,
        })
        .from(enrollment)
        .innerJoin(student, eq(student.id, enrollment.studentId))
        .where(and(eq(enrollment.schoolId, tenant.schoolId), eq(enrollment.id, id)))
        .limit(1);
      return row ?? null;
    },

    async createConversion(data: {
      linkId: string;
      enrollmentId: string;
      rewardKind: RewardKind;
      rewardValue: number;
      note?: string;
      registeredByUserId: string;
    }) {
      const [row] = await db
        .insert(referralConversion)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async removeConversion(id: string) {
      const [row] = await db
        .delete(referralConversion)
        .where(and(naConversao, eq(referralConversion.id, id)))
        .returning({ id: referralConversion.id });
      return row ?? null;
    },

    /** Códigos já usados, para o gerador não sortear em cima de um existente. */
    async codesInUse() {
      const linhas = await db.select({ code: referralLink.code }).from(referralLink).where(noLink);
      return new Set(linhas.map((l) => l.code));
    },

    /** Quantas famílias já entraram no programa. Alimenta o painel. */
    async countLinks() {
      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(referralLink)
        .where(noLink);
      return row?.total ?? 0;
    },
  };
}

export type ReferralRepository = ReturnType<typeof createReferralRepository>;
