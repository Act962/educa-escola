import { attendance, classroom, lesson, member, student, user } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, countDistinct, eq, inArray, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/** Alunos que ocupam vaga na sala. Mesma leitura de `ENROLLED_STATUSES`. */
const NA_SALA = ["ativo", "documentacao_pendente"] as const;

/**
 * Único lugar do módulo que monta query.
 *
 * Só agregados: relatório que traz linha por linha de aluno seria a listagem
 * de alunos com outro nome. O que sai daqui são contagens por turma, por
 * situação e por docente.
 */
export function createReportRepository(db: DbHandle, tenant: TenantContext) {
  const daEscola = eq(student.schoolId, tenant.schoolId);

  return {
    /** Quantos alunos por turma e turno, e quantos estão na sala. */
    async alunosPorTurma(academicYear: number) {
      return db
        .select({
          classroomId: classroom.id,
          classroomName: classroom.name,
          gradeLevel: classroom.gradeLevel,
          stage: classroom.stage,
          total: count(student.id),
          naSala:
            sql<number>`count(*) filter (where ${student.status} in ('ativo','documentacao_pendente'))`.mapWith(
              Number,
            ),
          documentacaoPendente:
            sql<number>`count(*) filter (where ${student.status} = 'documentacao_pendente')`.mapWith(
              Number,
            ),
          manha: sql<number>`count(*) filter (where ${student.shift} = 'manha')`.mapWith(Number),
          tarde: sql<number>`count(*) filter (where ${student.shift} = 'tarde')`.mapWith(Number),
          noite: sql<number>`count(*) filter (where ${student.shift} = 'noite')`.mapWith(Number),
        })
        .from(classroom)
        .leftJoin(student, eq(student.classroomId, classroom.id))
        .where(
          and(eq(classroom.schoolId, tenant.schoolId), eq(classroom.academicYear, academicYear)),
        )
        .groupBy(classroom.id, classroom.name, classroom.gradeLevel, classroom.stage)
        .orderBy(asc(classroom.name));
    },

    /** Movimentação: quantos em cada situação de matrícula. */
    async movimentacao() {
      return db
        .select({ status: student.status, total: count(student.id) })
        .from(student)
        .where(daEscola)
        .groupBy(student.status);
    },

    /** Presenças e faltas por turma, para a frequência média de cada uma. */
    async frequenciaPorTurma(academicYear: number) {
      return db
        .select({
          classroomId: classroom.id,
          classroomName: classroom.name,
          registros: count(attendance.id),
          comparecimentos:
            sql<number>`count(*) filter (where ${attendance.status} <> 'falta')`.mapWith(Number),
          alunos: countDistinct(attendance.studentId),
        })
        .from(attendance)
        .innerJoin(lesson, eq(lesson.id, attendance.lessonId))
        .innerJoin(classroom, eq(classroom.id, lesson.classroomId))
        .where(
          and(
            eq(attendance.schoolId, tenant.schoolId),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        )
        .groupBy(classroom.id, classroom.name)
        .orderBy(asc(classroom.name));
    },

    /**
     * Frequência de cada aluno no ano — só as contagens, sem nome.
     *
     * Serve ao indicador "alunos em risco", que é um número. A lista de quem
     * está em risco já existe em `/alunos`, com o recorte e a permissão dela.
     */
    async frequenciaPorAluno(academicYear: number) {
      return db
        .select({
          studentId: attendance.studentId,
          registros: count(attendance.id),
          comparecimentos:
            sql<number>`count(*) filter (where ${attendance.status} <> 'falta')`.mapWith(Number),
        })
        .from(attendance)
        .innerJoin(lesson, eq(lesson.id, attendance.lessonId))
        .innerJoin(student, eq(student.id, attendance.studentId))
        .where(
          and(
            eq(attendance.schoolId, tenant.schoolId),
            inArray(student.status, NA_SALA),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        )
        .groupBy(attendance.studentId);
    },

    /** Carga de cada docente no ano: aulas dadas e quantas sem chamada. */
    async cargaPorDocente(academicYear: number, hoje: string) {
      return db
        .select({
          teacherId: user.id,
          teacherName: user.name,
          turmas: countDistinct(lesson.classroomId),
          aulas: count(lesson.id),
          semChamada: sql<number>`count(*) filter (
            where ${lesson.attendanceRecordedAt} is null and ${lesson.date} < ${hoje}
          )`.mapWith(Number),
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .leftJoin(
          lesson,
          and(
            eq(lesson.teacherId, member.userId),
            eq(lesson.schoolId, tenant.schoolId),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        )
        .where(and(eq(member.organizationId, tenant.schoolId), eq(member.role, "teacher")))
        .groupBy(user.id, user.name)
        .orderBy(asc(user.name));
    },
  };
}

export type ReportRepository = ReturnType<typeof createReportRepository>;
