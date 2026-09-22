import {
  assessment,
  attendance,
  grade,
  lesson,
  schoolLeaderboardEntry,
  schoolLeaderboardOptIn,
  student,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { ContagensDaEscola } from "./indicators";

/**
 * O repositório da própria escola. Tudo aqui é filtrado por `tenant.schoolId`.
 *
 * As contagens são agregados da própria escola — `count`, nunca lista. O que
 * sai daqui para o placar é um punhado de inteiros, e é por isso que publicar
 * não expõe pessoa nenhuma.
 */
export function createLeaderboardRepository(db: DbHandle, tenant: TenantContext) {
  const daEscola = eq(schoolLeaderboardOptIn.schoolId, tenant.schoolId);

  return {
    async optIn(input: { displayName: string; academicYear: number; userId: string }) {
      const [row] = await db
        .insert(schoolLeaderboardOptIn)
        .values({
          schoolId: tenant.schoolId,
          displayName: input.displayName,
          academicYear: input.academicYear,
          optedInByUserId: input.userId,
          status: "ativa",
        })
        .onConflictDoUpdate({
          target: schoolLeaderboardOptIn.schoolId,
          set: {
            displayName: input.displayName,
            academicYear: input.academicYear,
            status: "ativa",
          },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * Sair do placar apaga a linha publicada, não só marca a adesão.
     *
     * Suspender a adesão e deixar o número publicado seria continuar expondo
     * a escola depois de ela pedir para sair. Consentimento retirado é dado
     * retirado.
     */
    async optOut() {
      await db.update(schoolLeaderboardOptIn).set({ status: "suspensa" }).where(daEscola);
      await db
        .delete(schoolLeaderboardEntry)
        .where(eq(schoolLeaderboardEntry.schoolId, tenant.schoolId));
    },

    async currentOptIn() {
      const [row] = await db.select().from(schoolLeaderboardOptIn).where(daEscola).limit(1);
      return row ?? null;
    },

    /** Publica (ou republica) **a linha desta escola**, nunca a de outra. */
    async publish(input: {
      displayName: string;
      academicYear: number;
      points: number;
      chamadaNoPrazo: number;
      notasSemPendencia: number;
      frequenciaMedia: number;
    }) {
      const [row] = await db
        .insert(schoolLeaderboardEntry)
        .values({ ...input, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: schoolLeaderboardEntry.schoolId,
          set: { ...input, computedAt: new Date() },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /**
     * Os seis inteiros que descrevem o ano letivo desta escola.
     *
     * Quatro agregados, nenhuma lista. O `date_part` repete o recorte de ano
     * que o módulo de pontuação já usa — é o ano civil da aula, que é o que a
     * escola reconhece como ano letivo.
     */
    async contagens(academicYear: number): Promise<ContagensDaEscola> {
      const doAno = sql`date_part('year', ${lesson.date}) = ${academicYear}`;

      const [aulas] = await db
        .select({
          comChamada: count(lesson.attendanceRecordedAt),
          // Dois `at time zone` e não um: a coluna é `timestamp` sem fuso,
          // gravada em UTC. Um só interpretaria o valor **como** horário de
          // São Paulo em vez de convertê-lo para lá, e a chamada das 21h
          // cairia no dia seguinte — tirando do professor um ponto que ele
          // ganhou. É a mesma leitura que `toSchoolDate` faz do lado do TS.
          noPrazo: sql<number>`count(*) filter (
            where ${lesson.attendanceRecordedAt} is not null
              and (${lesson.attendanceRecordedAt} at time zone 'UTC' at time zone 'America/Sao_Paulo')::date
                  <= ${lesson.date}::date
          )`.mapWith(Number),
        })
        .from(lesson)
        .where(and(eq(lesson.schoolId, tenant.schoolId), doAno));

      const [chamadas] = await db
        .select({
          registros: count(attendance.id),
          comparecimentos:
            sql<number>`count(*) filter (where ${attendance.status} <> 'falta')`.mapWith(Number),
        })
        .from(attendance)
        .innerJoin(lesson, eq(attendance.lessonId, lesson.id))
        .where(and(eq(attendance.schoolId, tenant.schoolId), doAno));

      const publicadas = await db
        .select({ id: assessment.id, classroomId: assessment.classroomId })
        .from(assessment)
        .where(
          and(
            eq(assessment.schoolId, tenant.schoolId),
            eq(assessment.status, "publicada"),
            sql`date_part('year', ${assessment.publishedAt}) = ${academicYear}`,
          ),
        );

      let semPendencia = 0;
      if (publicadas.length > 0) {
        const [notas, turmas] = await Promise.all([
          db
            .select({ assessmentId: grade.assessmentId, total: count(grade.id) })
            .from(grade)
            .where(
              and(
                eq(grade.schoolId, tenant.schoolId),
                inArray(
                  grade.assessmentId,
                  publicadas.map((linha) => linha.id),
                ),
              ),
            )
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

        const porAvaliacao = new Map(notas.map((linha) => [linha.assessmentId, linha.total]));
        const porTurma = new Map(turmas.map((linha) => [linha.classroomId, linha.total]));

        semPendencia = publicadas.filter(
          (linha) => (porAvaliacao.get(linha.id) ?? 0) >= (porTurma.get(linha.classroomId) ?? 0),
        ).length;
      }

      return {
        aulasComChamada: aulas?.comChamada ?? 0,
        aulasNoPrazo: aulas?.noPrazo ?? 0,
        avaliacoesPublicadas: publicadas.length,
        avaliacoesSemPendencia: semPendencia,
        comparecimentos: chamadas?.comparecimentos ?? 0,
        registrosDeChamada: chamadas?.registros ?? 0,
      };
    },
  };
}

export type LeaderboardRepository = ReturnType<typeof createLeaderboardRepository>;

/**
 * ⚠️ A **segunda** consulta do sistema sem filtro de escola. A primeira é
 * `createInviteLookup`, do link do responsável.
 *
 * Toda a arquitetura existe para impedir que uma escola leia dado de outra.
 * Esta função atravessa essa fronteira de propósito, e três coisas seguram a
 * travessia:
 *
 * 1. **`innerJoin` na adesão.** Escola sem linha em `school_leaderboard_opt_in`
 *    com `status = 'ativa'` não é filtrada — ela não existe para juntar. Não é
 *    um `where` que alguém pode apagar sem querer; é a origem das linhas.
 * 2. **A tabela publicada não tem coluna para pessoa.** Um join mal escrito
 *    daqui não consegue vazar aluno nem professor, porque não há onde eles
 *    caberiam. O que existe é `(escola, nome de exibição, quatro inteiros)`.
 * 3. **A allowlist em `architecture.test.ts`.** Consulta sem tenant agora
 *    precisa estar numa lista explícita, que alguém acrescenta olhando para
 *    ela em revisão — foi assim que `createInviteLookup` passou despercebida
 *    por meses.
 *
 * DECISÃO-JOÃO: isto muda o contrato de isolamento entre escolas.
 * Quebra se: a `school_leaderboard_entry` um dia ganhar coluna que identifique
 *   pessoa, ou se alguém trocar o `innerJoin` por `leftJoin` — as duas coisas
 *   compilam e passam nos outros testes.
 * Fiz assim: adesão explícita por escola, tabela publicada sem pessoa, e a
 *   allowlist obrigando a próxima exceção a ser consciente.
 * Alternativas: placar num serviço separado, alimentado por evento, sem
 *   consulta cruzada nenhuma · placar só com a posição da própria escola, sem
 *   listar as outras · nada de placar entre escolas.
 */
export function createLeaderboardLookup(db: DbHandle) {
  return {
    async scoreboard(academicYear: number) {
      return db
        .select({
          schoolId: schoolLeaderboardEntry.schoolId,
          displayName: schoolLeaderboardEntry.displayName,
          points: schoolLeaderboardEntry.points,
          chamadaNoPrazo: schoolLeaderboardEntry.chamadaNoPrazo,
          notasSemPendencia: schoolLeaderboardEntry.notasSemPendencia,
          frequenciaMedia: schoolLeaderboardEntry.frequenciaMedia,
        })
        .from(schoolLeaderboardEntry)
        .innerJoin(
          schoolLeaderboardOptIn,
          eq(schoolLeaderboardOptIn.schoolId, schoolLeaderboardEntry.schoolId),
        )
        .where(
          and(
            eq(schoolLeaderboardOptIn.status, "ativa"),
            eq(schoolLeaderboardEntry.academicYear, academicYear),
          ),
        )
        .orderBy(desc(schoolLeaderboardEntry.points), asc(schoolLeaderboardEntry.displayName));
    },
  };
}

export type LeaderboardLookup = ReturnType<typeof createLeaderboardLookup>;
