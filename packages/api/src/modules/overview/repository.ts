import {
  assessment,
  attendance,
  classroom,
  grade,
  lesson,
  member,
  student,
  subject,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, eq, inArray, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/**
 * Único lugar do módulo que monta query.
 *
 * Aqui as consultas são agregadas de propósito: um dashboard que buscasse
 * lista e contasse em memória traria a escola inteira para o Node.
 */
export function createOverviewRepository(db: DbHandle, tenant: TenantContext) {
  const school = tenant.schoolId;

  return {
    async studentCounts() {
      const rows = await db
        .select({ status: student.status, total: count() })
        .from(student)
        .where(eq(student.schoolId, school))
        .groupBy(student.status);
      return rows;
    },

    async classroomCount() {
      const [row] = await db
        .select({ total: count() })
        .from(classroom)
        .where(eq(classroom.schoolId, school));
      return row?.total ?? 0;
    },

    /** Professores da escola vêm do vínculo, não de tabela de domínio. */
    async teacherCount() {
      const [row] = await db
        .select({ total: count() })
        .from(member)
        .where(and(eq(member.organizationId, school), eq(member.role, "teacher")));
      return row?.total ?? 0;
    },

    /** Presenças e faltas por aluno — base de toda frequência derivada. */
    async attendanceByStudent() {
      return db
        .select({
          studentId: attendance.studentId,
          studentName: student.name,
          classroomId: student.classroomId,
          classroomName: classroom.name,
          presentCount:
            sql<number>`count(*) filter (where ${attendance.status} = 'presente')`.mapWith(Number),
          lateCount: sql<number>`count(*) filter (where ${attendance.status} = 'atraso')`.mapWith(
            Number,
          ),
          absentCount: sql<number>`count(*) filter (where ${attendance.status} = 'falta')`.mapWith(
            Number,
          ),
        })
        .from(attendance)
        .innerJoin(student, eq(student.id, attendance.studentId))
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(eq(attendance.schoolId, school), eq(student.status, "ativo")))
        .groupBy(attendance.studentId, student.name, student.classroomId, classroom.name);
    },

    /** Média publicada por aluno no bimestre, para os recortes de risco. */
    async publishedAveragesByStudent(term: number) {
      return db
        .select({
          studentId: grade.studentId,
          studentName: student.name,
          classroomName: classroom.name,
          average: sql<number>`avg(${grade.score})`.mapWith(Number),
        })
        .from(grade)
        .innerJoin(assessment, eq(assessment.id, grade.assessmentId))
        .innerJoin(student, eq(student.id, grade.studentId))
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(
          and(
            eq(grade.schoolId, school),
            eq(assessment.term, term),
            eq(assessment.status, "publicada"),
          ),
        )
        .groupBy(grade.studentId, student.name, classroom.name);
    },

    /**
     * Média da turma por disciplina — a comparação que o aluno vê.
     *
     * Sem nome de ninguém: o requisito é comparar contra a turma de forma
     * anônima, nunca contra um colega identificado.
     */
    async classroomSubjectAverages(classroomId: string, term: number) {
      return db
        .select({
          subjectId: assessment.subjectId,
          subjectName: subject.name,
          average: sql<number>`avg(${grade.score})`.mapWith(Number),
        })
        .from(grade)
        .innerJoin(assessment, eq(assessment.id, grade.assessmentId))
        .innerJoin(subject, eq(subject.id, assessment.subjectId))
        .where(
          and(
            eq(grade.schoolId, school),
            eq(assessment.classroomId, classroomId),
            eq(assessment.term, term),
            eq(assessment.status, "publicada"),
          ),
        )
        .groupBy(assessment.subjectId, subject.name)
        .orderBy(asc(subject.name));
    },

    /** Turmas em que o professor dá aula, sem repetir turma por disciplina. */
    async classroomIdsOfTeacher(teacherId: string) {
      const rows = await db
        .selectDistinct({ classroomId: lesson.classroomId })
        .from(lesson)
        .where(and(eq(lesson.schoolId, school), eq(lesson.teacherId, teacherId)));
      return rows.map((row) => row.classroomId);
    },

    async attendanceByStudentInClassrooms(classroomIds: string[]) {
      if (classroomIds.length === 0) return [];
      return db
        .select({
          studentId: attendance.studentId,
          studentName: student.name,
          classroomName: classroom.name,
          presentCount:
            sql<number>`count(*) filter (where ${attendance.status} = 'presente')`.mapWith(Number),
          lateCount: sql<number>`count(*) filter (where ${attendance.status} = 'atraso')`.mapWith(
            Number,
          ),
          absentCount: sql<number>`count(*) filter (where ${attendance.status} = 'falta')`.mapWith(
            Number,
          ),
        })
        .from(attendance)
        .innerJoin(student, eq(student.id, attendance.studentId))
        .innerJoin(classroom, eq(classroom.id, student.classroomId))
        .where(
          and(
            eq(attendance.schoolId, school),
            eq(student.status, "ativo"),
            inArray(student.classroomId, classroomIds),
          ),
        )
        .groupBy(attendance.studentId, student.name, classroom.name);
    },
  };
}

export type OverviewRepository = ReturnType<typeof createOverviewRepository>;
