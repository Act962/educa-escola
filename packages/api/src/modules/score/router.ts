import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createStudentRepository } from "../student/repository";
import { createStudentService } from "../student/service";
import { createScoreRepository } from "./repository";
import { scoreYearInput, tallyInput } from "./schema";
import { createScoreService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createScoreService(createScoreRepository(ctx.db, ctx.tenant));
}

export const scoreRouter = router({
  /**
   * Meus pontos, como aluno.
   *
   * A matrícula sai do vínculo (`ctx.membership.userId`), nunca de id na
   * entrada — do contrário qualquer aluno leria o painel de qualquer colega
   * trocando um parâmetro.
   */
  meuPainelDeAluno: permitted({ score: ["read"] })
    .input(scoreYearInput)
    .query(async ({ ctx, input }) => {
      const students = createStudentService(createStudentRepository(ctx.db, ctx.tenant));
      const me = await students.byUserId(ctx.membership.userId);
      return serviceFor(ctx).doAluno({
        studentId: me.id,
        classroomId: me.classroomId,
        academicYear: input.academicYear,
      });
    }),

  /** Meus pontos, como professor. Mesma regra: o docente sai do vínculo. */
  meuPainelDeProfessor: permitted({ score: ["read"] })
    .input(scoreYearInput)
    .query(({ ctx, input }) =>
      serviceFor(ctx).doProfessor(ctx.membership.userId, input.academicYear),
    ),

  /**
   * O placar nominal de alunos. Exige `ranking: ["read"]`, que professor e
   * aluno não têm — é a barreira do §7.5, e ela está aqui, no servidor.
   */
  rankingDeAlunos: permitted({ ranking: ["read"] })
    .input(scoreYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).rankingDeAlunos(input.academicYear)),

  rankingDeProfessores: permitted({ ranking: ["read"] })
    .input(scoreYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).rankingDeProfessores(input.academicYear)),

  /**
   * Reprocessa o ano e refaz o saldo.
   *
   * DECISÃO-JOÃO: hoje isto só acontece quando alguém clica.
   * Quebra se: ninguém clicar — o placar congela no último clique, e a pessoa
   *   que ganhou ponto ontem não o vê hoje.
   * Fiz assim: mutation manual, idempotente pelo índice único de origem, para
   *   que a falta de agendador seja um incômodo e não uma corrupção de dado.
   * Alternativas: cron do provedor de deploy chamando esta procedure ·
   *   `pg_cron` no Neon · fila com worker · apuração incremental no momento em
   *   que a chamada é salva.
   */
  apurar: permitted({ score: ["apurar"] })
    .input(tallyInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).apurar(input.academicYear)),
});
