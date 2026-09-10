import { assessment, classroom, grade, student, subject } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export interface CreateAssessmentData {
  classroomId: string;
  subjectId: string;
  teacherId: string;
  name: string;
  weight: number;
  term: number;
  appliedOn?: string | null;
}

export interface GradeEntry {
  studentId: string;
  /** `null` apaga o lançamento — é assim que se corrige nota digitada errado. */
  score: number | null;
}

const assessmentColumns = {
  id: assessment.id,
  name: assessment.name,
  weight: assessment.weight,
  term: assessment.term,
  appliedOn: assessment.appliedOn,
  status: assessment.status,
  publishedAt: assessment.publishedAt,
  classroomId: assessment.classroomId,
  classroomName: classroom.name,
  subjectId: assessment.subjectId,
  subjectName: subject.name,
  teacherId: assessment.teacherId,
};

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createAssessmentRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(assessment.schoolId, tenant.schoolId);

  const joined = () =>
    db
      .select(assessmentColumns)
      .from(assessment)
      .innerJoin(classroom, eq(classroom.id, assessment.classroomId))
      .innerJoin(subject, eq(subject.id, assessment.subjectId));

  return {
    async listByClassroom(classroomId: string, subjectId: string, term: number) {
      return joined()
        .where(
          and(
            withinSchool,
            eq(assessment.classroomId, classroomId),
            eq(assessment.subjectId, subjectId),
            eq(assessment.term, term),
          ),
        )
        .orderBy(asc(assessment.appliedOn), asc(assessment.createdAt));
    },

    async findById(id: string) {
      const [row] = await joined()
        .where(and(withinSchool, eq(assessment.id, id)))
        .limit(1);
      return row ?? null;
    },

    async listGrades(assessmentIds: string[]) {
      if (assessmentIds.length === 0) return [];
      return db
        .select({
          assessmentId: grade.assessmentId,
          studentId: grade.studentId,
          score: grade.score,
        })
        .from(grade)
        .where(
          and(eq(grade.schoolId, tenant.schoolId), inArray(grade.assessmentId, assessmentIds)),
        );
    },

    /**
     * Boletim do aluno: só o que foi **publicado**.
     *
     * O filtro é aqui, na query, e não numa checagem depois — nota em rascunho
     * não pode nem chegar perto da camada que responde ao aluno.
     */
    async listPublishedForStudent(studentId: string, term: number) {
      return db
        .select({
          assessmentId: assessment.id,
          assessmentName: assessment.name,
          weight: assessment.weight,
          appliedOn: assessment.appliedOn,
          subjectId: assessment.subjectId,
          subjectName: subject.name,
          score: grade.score,
        })
        .from(grade)
        .innerJoin(assessment, eq(assessment.id, grade.assessmentId))
        .innerJoin(subject, eq(subject.id, assessment.subjectId))
        .where(
          and(
            eq(grade.schoolId, tenant.schoolId),
            eq(grade.studentId, studentId),
            eq(assessment.term, term),
            eq(assessment.status, "publicada"),
          ),
        )
        .orderBy(desc(assessment.appliedOn));
    },

    /** Média publicada por turma e disciplina — o gráfico do professor. */
    async publishedAveragesByClassroom(teacherId: string, term: number) {
      return db
        .select({
          classroomId: assessment.classroomId,
          classroomName: classroom.name,
          term: assessment.term,
          average: sql<number>`avg(${grade.score})`.mapWith(Number),
        })
        .from(grade)
        .innerJoin(assessment, eq(assessment.id, grade.assessmentId))
        .innerJoin(classroom, eq(classroom.id, assessment.classroomId))
        .where(
          and(
            eq(grade.schoolId, tenant.schoolId),
            eq(assessment.teacherId, teacherId),
            inArray(assessment.term, [term, term - 1]),
          ),
        )
        .groupBy(assessment.classroomId, classroom.name, assessment.term)
        .orderBy(asc(classroom.name));
    },

    /**
     * Notas que faltam lançar, por professor.
     *
     * Cada aluno ativo da turma multiplicado por cada avaliação: o que não tem
     * linha em `grade` é pendência. É esse número que a Gestão cobra.
     */
    async countMissingGradesByTeacher() {
      return db
        .select({ teacherId: assessment.teacherId, missing: count() })
        .from(assessment)
        .innerJoin(
          student,
          and(eq(student.classroomId, assessment.classroomId), eq(student.status, "ativo")),
        )
        .leftJoin(
          grade,
          and(eq(grade.assessmentId, assessment.id), eq(grade.studentId, student.id)),
        )
        .where(and(withinSchool, isNull(grade.id)))
        .groupBy(assessment.teacherId);
    },

    async countMissingGradesFor(assessmentId: string, classroomId: string) {
      const [row] = await db
        .select({ missing: count() })
        .from(student)
        .leftJoin(grade, and(eq(grade.assessmentId, assessmentId), eq(grade.studentId, student.id)))
        .where(
          and(
            eq(student.schoolId, tenant.schoolId),
            eq(student.classroomId, classroomId),
            eq(student.status, "ativo"),
            isNull(grade.id),
          ),
        );
      return row?.missing ?? 0;
    },

    /** Grava o lançamento inteiro de uma avaliação de uma vez. */
    async saveGrades(assessmentId: string, entries: GradeEntry[]) {
      const cleared = entries.filter((entry) => entry.score === null).map((e) => e.studentId);
      const written = entries.filter(
        (entry): entry is { studentId: string; score: number } => entry.score !== null,
      );

      const write = async (tx: DbHandle) => {
        if (cleared.length > 0) {
          await tx
            .delete(grade)
            .where(
              and(
                eq(grade.schoolId, tenant.schoolId),
                eq(grade.assessmentId, assessmentId),
                inArray(grade.studentId, cleared),
              ),
            );
        }

        if (written.length > 0) {
          await tx
            .insert(grade)
            .values(
              written.map((entry) => ({
                schoolId: tenant.schoolId,
                assessmentId,
                studentId: entry.studentId,
                score: entry.score,
              })),
            )
            .onConflictDoUpdate({
              target: [grade.assessmentId, grade.studentId],
              set: { score: sql`excluded.score`, updatedAt: new Date() },
            });
        }
      };

      if ("transaction" in db && typeof db.transaction === "function") {
        await db.transaction(write);
      } else {
        await write(db);
      }
    },

    async publish(id: string, at: Date) {
      const [row] = await db
        .update(assessment)
        .set({ status: "publicada", publishedAt: at })
        .where(and(withinSchool, eq(assessment.id, id)))
        .returning({ id: assessment.id, status: assessment.status });
      return row ?? null;
    },

    async create(data: CreateAssessmentData) {
      const [row] = await db
        .insert(assessment)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },
  };
}

export type AssessmentRepository = ReturnType<typeof createAssessmentRepository>;
