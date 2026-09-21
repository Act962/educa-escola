import type { DbHandle } from "@educa-escola/db/types";

import { publicProcedure, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createEnrollmentRepository } from "../enrollment/repository";
import { createEnrollmentLinkRepository, createInviteLookup } from "./repository";
import { linkToken, submitLinkInput, verifyLinkInput } from "./schema";
import { createEnrollmentLinkService } from "./service";

/**
 * As três procedures anônimas do sistema.
 *
 * `publicProcedure` e não `permitted(...)` porque o responsável não tem conta
 * nem papel — a autorização dele é a posse do token mais a conferência da data
 * de nascimento. Nenhuma delas escreve em `student`: colocar aluno em sala
 * continua exigindo `enrollment: ["update"]` pela gestão.
 */
function serviceFor(ctx: { db: DbHandle }) {
  return createEnrollmentLinkService({
    lookup: createInviteLookup(ctx.db),
    repoFor: (tenant: TenantContext) => createEnrollmentRepository(ctx.db, tenant),
    linkRepoFor: (tenant: TenantContext) => createEnrollmentLinkRepository(ctx.db, tenant),
    now: () => new Date(),
  });
}

export const enrollmentLinkRouter = router({
  open: publicProcedure
    .input(linkToken)
    .query(({ ctx, input }) => serviceFor(ctx).open(input.token)),

  verify: publicProcedure
    .input(verifyLinkInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).verify(input)),

  submit: publicProcedure
    .input(submitLinkInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).submit(input, ctx.getRequestOrigin())),
});
