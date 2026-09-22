import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router, schoolProcedure } from "../../index";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createReferralRepository } from "./repository";
import {
  conversionId,
  referralYearInput,
  registerConversionInput,
  studentId,
  updateProgramInput,
} from "./schema";
import { createReferralService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext; membership: Membership }) {
  return createReferralService(createReferralRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    actor: { userId: ctx.membership.userId },
  });
}

/**
 * Programa de indicações.
 *
 * Duas superfícies, e a separação entre elas é a coisa mais importante deste
 * arquivo. O que a gestão vê é nominal — quem indicou quem, e quanto isso
 * custa em desconto —, e fica atrás de `referral: ["read"]`. O que o aluno vê
 * é só dele, resolvido por identidade em `schoolProcedure`, como "Meu perfil":
 * nenhum papel precisa ganhar permissão de leitura para a família enxergar o
 * próprio link, e por isso `referral` continua vazio em `student`.
 */
export const referralRouter = router({
  overview: permitted({ referral: ["read"] })
    .input(referralYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).overview(input.academicYear)),

  /** A regra de desconto é decisão comercial da direção. */
  updateProgram: permitted({ referral: ["manage"] })
    .input(updateProgramInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).updateProgram(input)),

  /** A secretaria emite o link de uma família que pediu. */
  gerarLink: permitted({ referral: ["manage"] })
    .input(studentId)
    .mutation(({ ctx, input }) => serviceFor(ctx).garantirLink(input.studentId)),

  registrar: permitted({ referral: ["manage"] })
    .input(registerConversionInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).registrarConversao(input)),

  remover: permitted({ referral: ["manage"] })
    .input(conversionId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removerConversao(input.id)),

  /**
   * O painel de quem divulga. Sem `permitted`: o recorte é de identidade, não
   * de papel — o `userId` vem do contexto e nunca da entrada.
   */
  meuPainel: schoolProcedure
    .input(referralYearInput)
    .query(({ ctx, input }) =>
      serviceFor(ctx).meuPainel(ctx.membership.userId, input.academicYear),
    ),
});
