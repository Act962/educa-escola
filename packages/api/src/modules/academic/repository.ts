import { classroom, curriculum, lesson, subject } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, eq, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { CreateSubjectInput, SetCurriculumInput, Stage } from "./schema";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createAcademicRepository(db: DbHandle, tenant: TenantContext) {
  const atSchool = eq(subject.schoolId, tenant.schoolId);
  const naGrade = eq(curriculum.schoolId, tenant.schoolId);

  return {
    async listSubjects() {
      return db.select().from(subject).where(atSchool).orderBy(asc(subject.name));
    },

    async findSubjectByName(name: string) {
      const [row] = await db
        .select()
        .from(subject)
        .where(and(atSchool, eq(subject.name, name)))
        .limit(1);
      return row ?? null;
    },

    async findSubject(id: string) {
      const [row] = await db
        .select()
        .from(subject)
        .where(and(atSchool, eq(subject.id, id)))
        .limit(1);
      return row ?? null;
    },

    async createSubject(data: CreateSubjectInput) {
      const [row] = await db
        .insert(subject)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async updateSubject(id: string, data: Partial<CreateSubjectInput>) {
      const [row] = await db
        .update(subject)
        .set(data)
        .where(and(atSchool, eq(subject.id, id)))
        .returning();
      return row ?? null;
    },

    async removeSubject(id: string) {
      const [row] = await db
        .delete(subject)
        .where(and(atSchool, eq(subject.id, id)))
        .returning({ id: subject.id });
      return row ?? null;
    },

    /** Quantas aulas já foram dadas de cada disciplina. Trava a exclusão. */
    async lessonCountBySubject(subjectId: string) {
      const [row] = await db
        .select({ total: count() })
        .from(lesson)
        .where(and(eq(lesson.schoolId, tenant.schoolId), eq(lesson.subjectId, subjectId)));
      return row?.total ?? 0;
    },

    /** A grade do ano, com o nome da disciplina já resolvido. */
    async listCurriculum(academicYear: number, stage?: Stage) {
      const filtros = [naGrade, eq(curriculum.academicYear, academicYear)];
      if (stage) filtros.push(eq(curriculum.stage, stage));

      return db
        .select({
          id: curriculum.id,
          stage: curriculum.stage,
          gradeLevel: curriculum.gradeLevel,
          subjectId: curriculum.subjectId,
          subjectName: subject.name,
          subjectCode: subject.code,
          subjectKind: subject.kind,
          weeklyHours: curriculum.weeklyHours,
          annualHours: curriculum.annualHours,
        })
        .from(curriculum)
        .innerJoin(subject, eq(subject.id, curriculum.subjectId))
        .where(and(...filtros))
        .orderBy(asc(curriculum.gradeLevel), asc(subject.name));
    },

    /**
     * Põe (ou atualiza) uma disciplina na grade de uma série.
     *
     * `onConflictDoUpdate` sobre o único de (escola, ano, segmento, série,
     * disciplina): montar a grade é uma operação que a secretaria repete, e
     * "já está na grade" não é erro — é a carga horária sendo corrigida.
     */
    async setCurriculum(data: SetCurriculumInput) {
      const [row] = await db
        .insert(curriculum)
        .values({ ...data, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: [
            curriculum.schoolId,
            curriculum.academicYear,
            curriculum.stage,
            curriculum.gradeLevel,
            curriculum.subjectId,
          ],
          set: { weeklyHours: data.weeklyHours, annualHours: data.annualHours ?? null },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async removeFromCurriculum(id: string) {
      const [row] = await db
        .delete(curriculum)
        .where(and(naGrade, eq(curriculum.id, id)))
        .returning({ id: curriculum.id });
      return row ?? null;
    },

    /**
     * As séries que existem de fato, tiradas das turmas.
     *
     * A grade se monta para série que tem turma; oferecer as 21 combinações
     * possíveis faria a secretaria montar grade para série que a escola não
     * oferece.
     */
    async gradeLevelsInUse(academicYear: number) {
      return db
        .select({
          stage: classroom.stage,
          gradeLevel: classroom.gradeLevel,
          classrooms: count(classroom.id),
        })
        .from(classroom)
        .where(
          and(
            eq(classroom.schoolId, tenant.schoolId),
            eq(classroom.academicYear, academicYear),
            sql`${classroom.gradeLevel} is not null`,
            sql`${classroom.stage} is not null`,
          ),
        )
        .groupBy(classroom.stage, classroom.gradeLevel)
        .orderBy(asc(classroom.stage), asc(classroom.gradeLevel));
    },
  };
}

export type AcademicRepository = ReturnType<typeof createAcademicRepository>;
