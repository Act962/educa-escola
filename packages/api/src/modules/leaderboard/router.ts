import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createLeaderboardLookup, createLeaderboardRepository } from "./repository";
import { leaderboardYearInput, optInInput } from "./schema";
import { createLeaderboardService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createLeaderboardService({
    repo: createLeaderboardRepository(ctx.db, ctx.tenant),
    lookup: createLeaderboardLookup(ctx.db),
    schoolId: ctx.tenant.schoolId,
  });
}

export const leaderboardRouter = router({
  /** Situação da própria escola. `ranking: read` — secretaria e direção. */
  status: permitted({ ranking: ["read"] })
    .input(leaderboardYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).status(input.academicYear)),

  /**
   * O placar entre escolas. **A única procedure que lê dado de outro tenant.**
   *
   * Exige `ranking: ["read_cross_school"]`, que hoje nenhum papel tem — a
   * procedure existe, compila e é testada, e não abre para ninguém até alguém
   * conceder a ação a um papel. É a trava que deixa a decisão com o João em
   * vez de com quem fizer o próximo deploy.
   */
  scoreboard: permitted({ ranking: ["read_cross_school"] })
    .input(leaderboardYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).scoreboard(input.academicYear)),

  /** Aderir expõe o nome da escola num placar. Só a direção. */
  aderir: permitted({ ranking: ["opt_in"] })
    .input(optInInput)
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).optIn({ ...input, userId: ctx.membership.userId }),
    ),

  sair: permitted({ ranking: ["opt_in"] }).mutation(({ ctx }) => serviceFor(ctx).optOut()),

  publicar: permitted({ ranking: ["opt_in"] })
    .input(leaderboardYearInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).publicar(input.academicYear)),
});
