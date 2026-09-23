import { classroom, lesson, member, organization, student, user } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, count, countDistinct, eq, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

/**
 * Único lugar do módulo que monta query.
 *
 * **Tudo aqui é por vínculo, nunca por usuário solto.** A chave de leitura é
 * sempre `(tenant.schoolId, userId)`: quem tem conta em duas escolas vê nesta
 * tela o vínculo *desta*, e não a soma dos dois. Consultar `user` pelo id sem
 * passar por `member` daria a resposta errada e pareceria certa.
 */
export function createProfileRepository(db: DbHandle, tenant: TenantContext) {
  return {
    /** Quem é a pessoa nesta escola. `null` quando não há vínculo aqui. */
    async identity(userId: string) {
      const [row] = await db
        .select({
          userId: user.id,
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          contaCriadaEm: user.createdAt,
          role: member.role,
          atSchoolSince: member.createdAt,
          schoolId: member.organizationId,
          schoolName: organization.name,
        })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .innerJoin(organization, eq(organization.id, member.organizationId))
        .where(and(eq(member.organizationId, tenant.schoolId), eq(member.userId, userId)))
        .limit(1);

      return row ?? null;
    },

    /**
     * A ficha do aluno ligada a esta conta.
     *
     * Nem todo aluno tem login e nem toda conta é de aluno, então `null` é
     * resposta legítima: a tela mostra a identificação sem o vínculo escolar
     * em vez de inventar uma turma.
     */
    async studentBond(userId: string) {
      const [row] = await db
        .select({
          studentId: student.id,
          registration: student.registration,
          status: student.status,
          shift: student.shift,
          classroomId: student.classroomId,
          classroomName: classroom.name,
        })
        .from(student)
        .leftJoin(classroom, eq(classroom.id, student.classroomId))
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.userId, userId)))
        .limit(1);

      return row ?? null;
    },

    /**
     * O que esta pessoa leciona no ano.
     *
     * Conta a partir de `lesson` e não de uma tabela de alocação porque
     * alocação é a própria grade: quem tem aula na grade dá aula. Sem aula
     * nenhuma o retorno é zero em tudo, que é o caso de quem entrou agora.
     */
    async teacherBond(userId: string, academicYear: number) {
      const [row] = await db
        .select({
          classrooms: countDistinct(lesson.classroomId),
          subjects: countDistinct(lesson.subjectId),
          lessons: count(),
        })
        .from(lesson)
        .where(
          and(
            eq(lesson.schoolId, tenant.schoolId),
            eq(lesson.teacherId, userId),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        );

      return row ?? { classrooms: 0, subjects: 0, lessons: 0 };
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
