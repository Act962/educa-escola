import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createStudentRepository } from "./repository";
import { createStudentInput, listStudentsInput, studentId } from "./schema";
import { createStudentService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createStudentService(createStudentRepository(ctx.db, ctx.tenant));
}

export const studentRouter = router({
  list: permitted({ student: ["read"] })
    .input(listStudentsInput)
    .query(({ ctx, input }) => serviceFor(ctx).list(input)),

  byId: permitted({ student: ["read"] })
    .input(studentId)
    .query(({ ctx, input }) => serviceFor(ctx).get(input.id)),

  /**
   * Ficha de quem está logado. Não recebe id de propósito: o aluno não escolhe
   * de quem é a ficha, o vínculo escolhe por ele.
   */
  me: permitted({ student: ["read"] }).query(({ ctx }) =>
    serviceFor(ctx).byUserId(ctx.membership.userId),
  ),

  create: permitted({ student: ["create"] })
    .input(createStudentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).create(input)),
});
