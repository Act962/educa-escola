import {
  assessment,
  attendance,
  classroom,
  grade,
  lesson,
  member,
  student,
  subject,
  user,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, countDistinct, eq, ilike, inArray, or, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/**
 * Único lugar do módulo que monta query.
 *
 * **Não existe tabela `teacher`.** O corpo docente é o vínculo: `member` com
 * papel `teacher`, ligado ao `user` da auth. Por isso todo filtro daqui é
 * `member.organizationId`, e não `schoolId` numa tabela de domínio — a
 * organização *é* a escola (`school.id === organization.id`).
 */
export function createTeacherRepository(db: DbHandle, tenant: TenantContext) {
  const naEscola = and(eq(member.organizationId, tenant.schoolId), eq(member.role, "teacher"));

  const doAno = (ano: number) => sql`date_part('year', ${lesson.date}) = ${ano}`;

  return {
    /** O corpo docente, em ordem de nome. */
    async list(search?: string) {
      const busca = search?.trim()
        ? or(ilike(user.name, `%${search.trim()}%`), ilike(user.email, `%${search.trim()}%`))
        : undefined;

      return db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          desde: member.createdAt,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(busca ? and(naEscola, busca) : naEscola)
        .orderBy(asc(user.name));
    },

    /**
     * Turmas, disciplinas e aulas de cada docente no ano.
     *
     * Sai da agenda de aulas (`lesson`), não de uma tabela de alocação — ela
     * não existe ainda (§5.8 do requisito). Quem nunca teve aula marcada não
     * aparece aqui, e o service trata isso como zero, não como ausência.
     */
    async loadByTeacher(academicYear: number) {
      return db
        .select({
          teacherId: lesson.teacherId,
          turmas: countDistinct(lesson.classroomId),
          disciplinas: countDistinct(lesson.subjectId),
          aulas: count(lesson.id),
          registradas: count(lesson.attendanceRecordedAt),
        })
        .from(lesson)
        .where(and(eq(lesson.schoolId, tenant.schoolId), doAno(academicYear)))
        .groupBy(lesson.teacherId);
    },

    /**
     * Aulas já encerradas e ainda sem chamada, por docente.
     *
     * O corte é o dia: aula de hoje ainda pode ser registrada até o fim do
     * dia, que é o prazo da tela de chamada. Cobrar antes disso seria acusar
     * de atraso quem está dentro do prazo.
     */
    async pendingCallsByTeacher(academicYear: number, today: string) {
      return db
        .select({ teacherId: lesson.teacherId, pendentes: count(lesson.id) })
        .from(lesson)
        .where(
          and(
            eq(lesson.schoolId, tenant.schoolId),
            doAno(academicYear),
            sql`${lesson.attendanceRecordedAt} is null`,
            sql`${lesson.date} < ${today}`,
          ),
        )
        .groupBy(lesson.teacherId);
    },

    /**
     * Lançamentos de nota que faltam, por docente.
     *
     * Conta aluno na sala sem nota na avaliação — a mesma leitura que a
     * publicação faz. `ENROLLED_STATUSES` está escrito aqui como literal
     * porque importar do `student/schema` puxaria o módulo inteiro para
     * dentro de uma query.
     */
    async pendingGradesByTeacher(academicYear: number) {
      const avaliacoes = db
        .select({
          teacherId: assessment.teacherId,
          assessmentId: assessment.id,
          // `.as()` obrigatório: sem alias, referenciar estes campos a partir
          // da subconsulta explode em tempo de execução — e não na compilação,
          // porque para o TypeScript a coluna existe. Foi assim que este
          // método quebrou só quando a tela chamou.
          naTurma: countDistinct(student.id).as("na_turma"),
          comNota: countDistinct(grade.studentId).as("com_nota"),
        })
        .from(assessment)
        .innerJoin(
          student,
          and(
            eq(student.classroomId, assessment.classroomId),
            inArray(student.status, ["ativo", "documentacao_pendente"]),
          ),
        )
        .leftJoin(
          grade,
          and(eq(grade.assessmentId, assessment.id), eq(grade.studentId, student.id)),
        )
        .where(
          and(
            eq(assessment.schoolId, tenant.schoolId),
            sql`date_part('year', ${assessment.createdAt}) = ${academicYear}`,
          ),
        )
        .groupBy(assessment.teacherId, assessment.id)
        .as("avaliacoes");

      return db
        .select({
          teacherId: avaliacoes.teacherId,
          faltando: sql<number>`sum(${avaliacoes.naTurma} - ${avaliacoes.comNota})`.mapWith(Number),
        })
        .from(avaliacoes)
        .groupBy(avaliacoes.teacherId);
    },

    /** Turmas e disciplinas de um docente, para a ficha dele. */
    async assignmentsOf(teacherId: string, academicYear: number) {
      return db
        .selectDistinct({
          classroomId: classroom.id,
          classroomName: classroom.name,
          subjectId: subject.id,
          subjectName: subject.name,
        })
        .from(lesson)
        .innerJoin(classroom, eq(classroom.id, lesson.classroomId))
        .innerJoin(subject, eq(subject.id, lesson.subjectId))
        .where(
          and(
            eq(lesson.schoolId, tenant.schoolId),
            eq(lesson.teacherId, teacherId),
            doAno(academicYear),
          ),
        )
        .orderBy(asc(classroom.name), asc(subject.name));
    },

    /** Quantos alunos o docente alcança, sem repetir quem está em duas turmas. */
    async reachOf(teacherId: string, academicYear: number) {
      const turmas = db
        .selectDistinct({ classroomId: lesson.classroomId })
        .from(lesson)
        .where(
          and(
            eq(lesson.schoolId, tenant.schoolId),
            eq(lesson.teacherId, teacherId),
            doAno(academicYear),
          ),
        )
        .as("turmas");

      const [row] = await db
        .select({ alunos: countDistinct(student.id) })
        .from(student)
        .innerJoin(turmas, eq(turmas.classroomId, student.classroomId))
        .where(
          and(
            eq(student.schoolId, tenant.schoolId),
            inArray(student.status, ["ativo", "documentacao_pendente"]),
          ),
        );

      return row?.alunos ?? 0;
    },

    /** Uma linha por docente e por membro: existe? é mesmo desta escola? */
    async findMember(userId: string) {
      const [row] = await db
        .select({ userId: user.id, name: user.name, email: user.email, desde: member.createdAt })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(naEscola, eq(member.userId, userId)))
        .limit(1);
      return row ?? null;
    },

    /** Frequência média das turmas do docente — contexto, não avaliação dele. */
    async attendanceOf(teacherId: string, academicYear: number) {
      const [row] = await db
        .select({
          registros: count(attendance.id),
          comparecimentos:
            sql<number>`count(*) filter (where ${attendance.status} <> 'falta')`.mapWith(Number),
        })
        .from(attendance)
        .innerJoin(lesson, eq(lesson.id, attendance.lessonId))
        .where(
          and(
            eq(attendance.schoolId, tenant.schoolId),
            eq(lesson.teacherId, teacherId),
            doAno(academicYear),
          ),
        );

      return { registros: row?.registros ?? 0, comparecimentos: row?.comparecimentos ?? 0 };
    },
  };
}

export type TeacherRepository = ReturnType<typeof createTeacherRepository>;
