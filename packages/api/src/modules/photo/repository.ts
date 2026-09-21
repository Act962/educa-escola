import { enrollment, enrollmentConsent, student, studentPhoto } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export type PhotoRow = typeof studentPhoto.$inferSelect;

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createPhotoRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(studentPhoto.schoolId, tenant.schoolId);

  return {
    async findByStudent(studentId: string) {
      const [row] = await db
        .select()
        .from(studentPhoto)
        .where(and(withinSchool, eq(studentPhoto.studentId, studentId)))
        .limit(1);
      return row ?? null;
    },

    async findStudent(studentId: string) {
      const [row] = await db
        .select({
          id: student.id,
          name: student.name,
          registration: student.registration,
          classroomId: student.classroomId,
        })
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.id, studentId)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Recapturar substitui, não acumula.
     *
     * Guardar histórico de fotos de criança seria colecionar o que não se
     * precisa — a §24.4 pede minimização, e a foto anterior não serve a
     * nenhuma finalidade declarada.
     */
    async upsert(data: Omit<typeof studentPhoto.$inferInsert, "schoolId">) {
      const [row] = await db
        .insert(studentPhoto)
        .values({ ...data, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: studentPhoto.studentId,
          set: {
            cipher: data.cipher,
            iv: data.iv,
            authTag: data.authTag,
            contentType: data.contentType,
            capturedAt: data.capturedAt,
            capturedByUserId: data.capturedByUserId,
            syncedAt: null,
          },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async remove(studentId: string) {
      const [row] = await db
        .delete(studentPhoto)
        .where(and(withinSchool, eq(studentPhoto.studentId, studentId)))
        .returning({ id: studentPhoto.id });
      return row ?? null;
    },

    async markSynced(studentId: string, when: Date) {
      const [row] = await db
        .update(studentPhoto)
        .set({ syncedAt: when })
        .where(and(withinSchool, eq(studentPhoto.studentId, studentId)))
        .returning({ id: studentPhoto.id });
      return row ?? null;
    },

    /**
     * A matrícula corrente do aluno, que é onde o consentimento mora.
     *
     * Consentimento pende do vínculo, não do cadastro: autorizar em 2026 não
     * autoriza para sempre.
     */
    async currentEnrollment(studentId: string) {
      const [row] = await db
        .select()
        .from(enrollment)
        .where(and(eq(enrollment.schoolId, tenant.schoolId), eq(enrollment.studentId, studentId)))
        .orderBy(desc(enrollment.academicYear), desc(enrollment.createdAt))
        .limit(1);
      return row ?? null;
    },

    /** O aceite de biometria mais recente daquela matrícula. */
    async biometricConsent(enrollmentId: string) {
      const [row] = await db
        .select()
        .from(enrollmentConsent)
        .where(
          and(
            eq(enrollmentConsent.schoolId, tenant.schoolId),
            eq(enrollmentConsent.enrollmentId, enrollmentId),
            eq(enrollmentConsent.purpose, "biometria"),
          ),
        )
        .orderBy(desc(enrollmentConsent.grantedAt))
        .limit(1);
      return row ?? null;
    },

    async revokeConsent(consentId: string, when: Date) {
      const [row] = await db
        .update(enrollmentConsent)
        .set({ revokedAt: when })
        .where(
          and(eq(enrollmentConsent.schoolId, tenant.schoolId), eq(enrollmentConsent.id, consentId)),
        )
        .returning({ id: enrollmentConsent.id });
      return row ?? null;
    },
  };
}

export type PhotoRepository = ReturnType<typeof createPhotoRepository>;
