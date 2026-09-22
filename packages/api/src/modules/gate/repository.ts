import {
  classroom,
  enrollment,
  enrollmentConsent,
  schoolEntry,
  student,
  studentFaceTemplate,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq, gte, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import { ENROLLED_STATUSES } from "../student/schema";

export interface MoldeGravado {
  studentId: string;
  cipher: string;
  iv: string;
  authTag: string;
  dimensions: number;
  extractor: string;
}

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createGateRepository(db: DbHandle, tenant: TenantContext) {
  const naEscola = eq(student.schoolId, tenant.schoolId);

  /** O cartão que a portaria mostra. Nada de nota, frequência ou responsável. */
  const cartao = {
    studentId: student.id,
    name: student.name,
    registration: student.registration,
    shift: student.shift,
    status: student.status,
    classroomName: classroom.name,
  };

  return {
    /**
     * Os moldes dos alunos matriculados, ainda cifrados.
     *
     * Só quem está em `ENROLLED_STATUSES`: aluno transferido ou cancelado não
     * abre portão, e deixá-lo no conjunto de comparação seria manter o rosto
     * de quem saiu da escola em disputa por uma identificação.
     */
    async listTemplates(): Promise<MoldeGravado[]> {
      return db
        .select({
          studentId: studentFaceTemplate.studentId,
          cipher: studentFaceTemplate.cipher,
          iv: studentFaceTemplate.iv,
          authTag: studentFaceTemplate.authTag,
          dimensions: studentFaceTemplate.dimensions,
          extractor: studentFaceTemplate.extractor,
        })
        .from(studentFaceTemplate)
        .innerJoin(student, eq(student.id, studentFaceTemplate.studentId))
        .where(
          and(
            eq(studentFaceTemplate.schoolId, tenant.schoolId),
            naEscola,
            sql`${student.status} in ${ENROLLED_STATUSES}`,
          ),
        );
    },

    async findStudent(studentId: string) {
      const [row] = await db
        .select(cartao)
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(naEscola, eq(student.id, studentId)))
        .limit(1);
      return row ?? null;
    },

    async findByRegistration(registration: string) {
      const [row] = await db
        .select(cartao)
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(naEscola, eq(student.registration, registration)))
        .limit(1);
      return row ?? null;
    },

    /**
     * O consentimento de biometria vigente do aluno.
     *
     * Passa pela matrícula porque é lá que a família autoriza — autorizar em
     * 2026 não autoriza para sempre. Pega o aceite mais recente da matrícula
     * mais recente, e revogado conta como ausente: a pergunta é "vale agora?",
     * não "existe linha?".
     */
    async hasBiometricConsent(studentId: string) {
      const [row] = await db
        .select({ id: enrollmentConsent.id })
        .from(enrollmentConsent)
        .innerJoin(enrollment, eq(enrollment.id, enrollmentConsent.enrollmentId))
        .where(
          and(
            eq(enrollmentConsent.schoolId, tenant.schoolId),
            eq(enrollment.studentId, studentId),
            eq(enrollmentConsent.purpose, "biometria"),
            eq(enrollmentConsent.granted, true),
            sql`${enrollmentConsent.revokedAt} is null`,
          ),
        )
        .orderBy(desc(enrollment.academicYear), desc(enrollmentConsent.grantedAt))
        .limit(1);
      return !!row;
    },

    async saveTemplate(data: {
      studentId: string;
      cipher: string;
      iv: string;
      authTag: string;
      dimensions: number;
      extractor: string;
      enrolledByUserId: string;
    }) {
      const [row] = await db
        .insert(studentFaceTemplate)
        .values({ ...data, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: studentFaceTemplate.studentId,
          set: {
            cipher: data.cipher,
            iv: data.iv,
            authTag: data.authTag,
            dimensions: data.dimensions,
            extractor: data.extractor,
          },
        })
        .returning({ id: studentFaceTemplate.id });
      return row as { id: string };
    },

    async deleteTemplate(studentId: string) {
      await db
        .delete(studentFaceTemplate)
        .where(
          and(
            eq(studentFaceTemplate.schoolId, tenant.schoolId),
            eq(studentFaceTemplate.studentId, studentId),
          ),
        );
    },

    async recordEntry(data: {
      studentId: string;
      direction: "entrada" | "saida";
      method: "rosto" | "carteirinha" | "manual";
      operatorUserId: string;
      deviceLabel: string | null;
      occurredAt: Date;
    }) {
      const [row] = await db
        .insert(schoolEntry)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning({ id: schoolEntry.id, occurredAt: schoolEntry.occurredAt });
      return row as { id: string; occurredAt: Date };
    },

    /** A última passagem do aluno desde um instante. Diz se ele está dentro. */
    async lastEntryOf(studentId: string, desde: Date) {
      const [row] = await db
        .select({ direction: schoolEntry.direction, occurredAt: schoolEntry.occurredAt })
        .from(schoolEntry)
        .where(
          and(
            eq(schoolEntry.schoolId, tenant.schoolId),
            eq(schoolEntry.studentId, studentId),
            gte(schoolEntry.occurredAt, desde),
          ),
        )
        .orderBy(desc(schoolEntry.occurredAt))
        .limit(1);
      return row ?? null;
    },

    /**
     * Quantos alunos estão dentro agora.
     *
     * Conta quem tem uma `entrada` como passagem mais recente do dia. Não é a
     * soma de entradas menos saídas: aluno que entrou duas vezes sem sair
     * estragaria essa conta, e portão de escola tem passagem repetida o tempo
     * todo.
     */
    async presentCount(desde: Date) {
      const ultima = db
        .selectDistinctOn([schoolEntry.studentId], {
          studentId: schoolEntry.studentId,
          direction: schoolEntry.direction,
        })
        .from(schoolEntry)
        .where(and(eq(schoolEntry.schoolId, tenant.schoolId), gte(schoolEntry.occurredAt, desde)))
        .orderBy(schoolEntry.studentId, desc(schoolEntry.occurredAt))
        .as("ultima");

      const [row] = await db
        .select({ total: sql<number>`count(*)::int` })
        .from(ultima)
        .where(eq(ultima.direction, "entrada"));
      return row?.total ?? 0;
    },

    /** As passagens do dia, mais recentes primeiro. Alimenta a tela da gestão. */
    async listEntries(desde: Date, limite: number) {
      return db
        .select({
          id: schoolEntry.id,
          studentId: schoolEntry.studentId,
          name: student.name,
          classroomName: classroom.name,
          direction: schoolEntry.direction,
          method: schoolEntry.method,
          occurredAt: schoolEntry.occurredAt,
        })
        .from(schoolEntry)
        .innerJoin(student, eq(student.id, schoolEntry.studentId))
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(eq(schoolEntry.schoolId, tenant.schoolId), gte(schoolEntry.occurredAt, desde)))
        .orderBy(desc(schoolEntry.occurredAt))
        .limit(limite);
    },
  };
}

export type GateRepository = ReturnType<typeof createGateRepository>;
