import {
  assessment,
  attendance,
  grade,
  lesson,
  member,
  scoreBalance,
  scoreEvent,
  student,
  user,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, desc, eq, inArray, sql, sum } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { SubjectKind } from "./rules";
import type { NewEvent, TalliedAssessment, TalliedAttendance, TalliedLesson } from "./tally";

/**
 * Quantos eventos por `insert`.
 *
 * O Postgres aceita 65.535 parâmetros por statement e a linha tem dez
 * colunas, então o teto real fica perto de 6.500. Mil deixa folga para a
 * coluna que alguém acrescentar sem refazer esta conta.
 */
const LOTE_DE_EVENTOS = 1000;

/**
 * Único lugar do módulo que monta query.
 *
 * Além das tabelas de pontuação, lê `attendance`, `lesson`, `assessment` e
 * `grade` — a apuração é feita dos fatos da escola, e o filtro por `schoolId`
 * continua valendo para todas elas.
 */
export function createScoreRepository(db: DbHandle, tenant: TenantContext) {
  const noEvento = eq(scoreEvent.schoolId, tenant.schoolId);
  const noSaldo = eq(scoreBalance.schoolId, tenant.schoolId);

  return {
    /**
     * Grava os eventos apurados, ignorando o que já existe.
     *
     * `onConflictDoNothing` sobre o índice único de origem é o que torna
     * reapurar inofensivo. Sem agendador, alguém vai clicar duas vezes.
     *
     * **Em lotes, e não numa tacada.** A escola de demonstração tem 288
     * alunos e um ano de chamadas: a apuração produz dezenas de milhares de
     * eventos, e um único `insert` com todos eles estoura a pilha ao montar a
     * query e passa do teto de parâmetros do Postgres. Com uma turma no banco
     * isso não aparece — com uma escola de verdade, aparece no primeiro
     * clique.
     */
    async appendEvents(eventos: NewEvent[]) {
      if (eventos.length === 0) return 0;

      let gravados = 0;
      for (let inicio = 0; inicio < eventos.length; inicio += LOTE_DE_EVENTOS) {
        const lote = eventos.slice(inicio, inicio + LOTE_DE_EVENTOS);
        const inseridos = await db
          .insert(scoreEvent)
          .values(lote.map((evento) => ({ ...evento, schoolId: tenant.schoolId })))
          .onConflictDoNothing()
          .returning({ id: scoreEvent.id });
        gravados += inseridos.length;
      }

      return gravados;
    },

    /**
     * Refaz o saldo do ano a partir dos eventos.
     *
     * Reconstrução completa e não incremento: saldo é projeção, e projeção que
     * só sabe somar diverge da fonte no primeiro evento que não chegar.
     */
    async rebuildBalances(academicYear: number) {
      const totais = await db
        .select({
          subjectKind: scoreEvent.subjectKind,
          subjectId: scoreEvent.subjectId,
          points: sum(scoreEvent.points).mapWith(Number),
          eventCount: count(scoreEvent.id),
        })
        .from(scoreEvent)
        .where(and(noEvento, eq(scoreEvent.academicYear, academicYear)))
        .groupBy(scoreEvent.subjectKind, scoreEvent.subjectId);

      await db
        .delete(scoreBalance)
        .where(and(noSaldo, eq(scoreBalance.academicYear, academicYear)));

      if (totais.length === 0) return [];

      return db
        .insert(scoreBalance)
        .values(
          totais.map((linha) => ({
            ...linha,
            schoolId: tenant.schoolId,
            academicYear,
          })),
        )
        .returning();
    },

    async balance(input: { subjectKind: SubjectKind; subjectId: string; academicYear: number }) {
      const [row] = await db
        .select()
        .from(scoreBalance)
        .where(
          and(
            noSaldo,
            eq(scoreBalance.subjectKind, input.subjectKind),
            eq(scoreBalance.subjectId, input.subjectId),
            eq(scoreBalance.academicYear, input.academicYear),
          ),
        )
        .limit(1);
      return row ?? null;
    },

    /**
     * O placar de um tipo de sujeito, do maior para o menor.
     *
     * Devolve a lista inteira porque quem chama decide o que mostrar: a tela do
     * aluno lê só a própria posição, a da direção lê a lista. O corte fica no
     * service, onde a regra do §7.5 está escrita e testada.
     */
    async scoreboard(input: { subjectKind: SubjectKind; academicYear: number }) {
      return db
        .select({
          subjectId: scoreBalance.subjectId,
          points: scoreBalance.points,
        })
        .from(scoreBalance)
        .where(
          and(
            noSaldo,
            eq(scoreBalance.subjectKind, input.subjectKind),
            eq(scoreBalance.academicYear, input.academicYear),
          ),
        )
        .orderBy(desc(scoreBalance.points), asc(scoreBalance.subjectId));
    },

    /** O extrato: os fatos que somam o total, do mais recente para trás. */
    async listEvents(input: {
      subjectKind: SubjectKind;
      subjectId: string;
      academicYear: number;
      limit: number;
    }) {
      return db
        .select({
          id: scoreEvent.id,
          ruleKey: scoreEvent.ruleKey,
          points: scoreEvent.points,
          term: scoreEvent.term,
          occurredAt: scoreEvent.occurredAt,
        })
        .from(scoreEvent)
        .where(
          and(
            noEvento,
            eq(scoreEvent.subjectKind, input.subjectKind),
            eq(scoreEvent.subjectId, input.subjectId),
            eq(scoreEvent.academicYear, input.academicYear),
          ),
        )
        .orderBy(desc(scoreEvent.occurredAt))
        .limit(input.limit);
    },

    /** Presenças do ano, com a data da aula — é dela que sai a ordem e o ano. */
    async presencasDoAno(academicYear: number): Promise<TalliedAttendance[]> {
      return db
        .select({
          id: attendance.id,
          studentId: attendance.studentId,
          date: lesson.date,
          status: attendance.status,
        })
        .from(attendance)
        .innerJoin(lesson, eq(attendance.lessonId, lesson.id))
        .where(
          and(
            eq(attendance.schoolId, tenant.schoolId),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        )
        .orderBy(asc(lesson.date));
    },

    async aulasDoAno(academicYear: number): Promise<TalliedLesson[]> {
      return db
        .select({
          id: lesson.id,
          teacherId: lesson.teacherId,
          date: lesson.date,
          attendanceRecordedAt: lesson.attendanceRecordedAt,
          content: lesson.content,
          homework: lesson.homework,
        })
        .from(lesson)
        .where(
          and(
            eq(lesson.schoolId, tenant.schoolId),
            sql`date_part('year', ${lesson.date}) = ${academicYear}`,
          ),
        );
    },

    /**
     * Avaliações publicadas no ano, com quantos alunos ficaram sem lançamento.
     *
     * A contagem é do roteiro da turma menos quem tem nota — é a mesma leitura
     * que a publicação faz, então o ponto e a regra não podem discordar.
     */
    async avaliacoesDoAno(academicYear: number): Promise<TalliedAssessment[]> {
      const publicadas = await db
        .select({
          id: assessment.id,
          teacherId: assessment.teacherId,
          term: assessment.term,
          appliedOn: assessment.appliedOn,
          status: assessment.status,
          publishedAt: assessment.publishedAt,
          classroomId: assessment.classroomId,
        })
        .from(assessment)
        .where(
          and(
            eq(assessment.schoolId, tenant.schoolId),
            eq(assessment.status, "publicada"),
            sql`date_part('year', ${assessment.publishedAt}) = ${academicYear}`,
          ),
        );

      if (publicadas.length === 0) return [];

      const ids = publicadas.map((linha) => linha.id);

      const [comNota, naTurma] = await Promise.all([
        db
          .select({ assessmentId: grade.assessmentId, total: count(grade.id) })
          .from(grade)
          .where(and(eq(grade.schoolId, tenant.schoolId), inArray(grade.assessmentId, ids)))
          .groupBy(grade.assessmentId),
        db
          .select({ classroomId: student.classroomId, total: count(student.id) })
          .from(student)
          .where(
            and(
              eq(student.schoolId, tenant.schoolId),
              inArray(student.status, ["ativo", "documentacao_pendente"]),
            ),
          )
          .groupBy(student.classroomId),
      ]);

      const notas = new Map(comNota.map((linha) => [linha.assessmentId, linha.total]));
      const alunos = new Map(naTurma.map((linha) => [linha.classroomId, linha.total]));

      return publicadas.map(({ classroomId, ...linha }) => ({
        ...linha,
        semLancamento: Math.max(0, (alunos.get(classroomId) ?? 0) - (notas.get(linha.id) ?? 0)),
      }));
    },

    /**
     * Nota publicada por aluno e bimestre, com o peso da avaliação.
     *
     * Devolve os lançamentos crus em vez de uma média pronta: a ponderação é
     * regra de negócio e já vive no `assessment/service.ts`. Repetir a conta
     * aqui faria o extrato de pontos e o boletim discordarem no dia em que um
     * dos dois mudasse.
     */
    async lancamentosPublicadosDoAno(academicYear: number) {
      return db
        .select({
          studentId: grade.studentId,
          term: assessment.term,
          score: grade.score,
          weight: assessment.weight,
        })
        .from(grade)
        .innerJoin(assessment, eq(grade.assessmentId, assessment.id))
        .where(
          and(
            eq(grade.schoolId, tenant.schoolId),
            eq(assessment.status, "publicada"),
            sql`date_part('year', ${assessment.publishedAt}) = ${academicYear}`,
          ),
        );
    },

    /** Nome e turma de quem aparece no placar de alunos. */
    async studentsByIds(ids: string[]) {
      if (ids.length === 0) return [];
      return db
        .select({
          id: student.id,
          name: student.name,
          classroomId: student.classroomId,
        })
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), inArray(student.id, ids)));
    },

    /**
     * Nome de quem aparece no placar de professores.
     *
     * Passa por `member` e não direto por `user`: `user` é tabela da auth e
     * não tem `schoolId`. O vínculo é o que amarra a pessoa a esta escola, e
     * sem ele a consulta devolveria o nome de um professor de outra
     * instituição a quem soubesse o id.
     */
    async teachersByIds(ids: string[]) {
      if (ids.length === 0) return [];
      return db
        .select({ id: user.id, name: user.name })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(and(eq(member.organizationId, tenant.schoolId), inArray(member.userId, ids)));
    },

    /** Os alunos de uma turma, para a média da turma do painel do aluno. */
    async studentIdsByClassroom(classroomId: string) {
      const rows = await db
        .select({ id: student.id })
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), eq(student.classroomId, classroomId)));
      return rows.map((row) => row.id);
    },
  };
}

export type ScoreRepository = ReturnType<typeof createScoreRepository>;
