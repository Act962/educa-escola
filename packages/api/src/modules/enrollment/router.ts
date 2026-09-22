import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";
import { z } from "zod";

import { permitted, router } from "../../index";
import { createManualMessenger } from "../../messaging/messenger";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createEnrollmentRepository } from "./repository";
import {
  academicYear,
  cancelEnrollmentInput,
  confirmEnrollmentInput,
  createEnrollmentInput,
  enrollmentId,
  listEnrollmentsInput,
  renewEnrollmentInput,
  updateEnrollmentInput,
} from "./schema";
import { createEnrollmentService } from "./service";

/**
 * O link público mora no mesmo endereço do app — não há domínio separado.
 * `BETTER_AUTH_URL` já é a origem canônica configurada, então reusá-la evita
 * uma variável de ambiente a mais para declarar no turbo.json e no CI.
 */
function serviceFor(ctx: { db: DbHandle; tenant: TenantContext; membership: Membership }) {
  return createEnrollmentService(createEnrollmentRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    messenger: createManualMessenger(),
    linkBaseUrl: env.BETTER_AUTH_URL,
    schoolName: ctx.membership.schoolName,
    actor: { userId: ctx.membership.userId },
  });
}

export const enrollmentRouter = router({
  list: permitted({ enrollment: ["read"] })
    .input(listEnrollmentsInput)
    .query(({ ctx, input }) => serviceFor(ctx).list(input)),

  counts: permitted({ enrollment: ["read"] })
    .input(z.object({ academicYear }))
    .query(({ ctx, input }) => serviceFor(ctx).counts(input.academicYear)),

  /** Prévia do número que a próxima matrícula do ano receberá. */
  nextRegistration: permitted({ enrollment: ["create"] })
    .input(z.object({ academicYear }))
    .query(({ ctx, input }) => serviceFor(ctx).nextRegistration(input.academicYear)),

  byId: permitted({ enrollment: ["read"] })
    .input(enrollmentId)
    .query(({ ctx, input }) => serviceFor(ctx).get(input.id)),

  create: permitted({ enrollment: ["create"] })
    .input(createEnrollmentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).create(input)),

  renew: permitted({ enrollment: ["create"] })
    .input(renewEnrollmentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).renew(input)),

  edit: permitted({ enrollment: ["update"] })
    .input(updateEnrollmentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).edit(input)),

  confirm: permitted({ enrollment: ["update"] })
    .input(confirmEnrollmentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).confirm(input)),

  cancel: permitted({ enrollment: ["update"] })
    .input(cancelEnrollmentInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).cancel(input)),

  /**
   * Pede à família a autorização da identificação facial.
   *
   * `enrollment: ["update"]` como o reenvio do link: é a secretaria pedindo,
   * não concedendo — quem autoriza continua sendo o responsável, abrindo o
   * link. O sistema nunca marca consentimento em nome de ninguém.
   */
  pedirAutorizacaoBiometria: permitted({ enrollment: ["update"] })
    .input(
      z.object({ id: z.string().min(1), expiryDays: z.number().int().min(1).max(30).default(7) }),
    )
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).emitirAutorizacaoBiometria(input.id, input.expiryDays),
    ),

  /**
   * Registra a autorização declarada no balcão.
   *
   * `enrollment: ["update"]`, como o resto do que a secretaria faz na ficha.
   * A linha nasce marcada como presencial e guarda quem declarou e quem
   * registrou — a distinção é o que torna isto auditável em vez de opaco.
   */
  registrarAutorizacaoPresencial: permitted({ enrollment: ["update"] })
    .input(
      z.object({
        id: z.string().min(1),
        purpose: z.literal("biometria"),
        granted: z.boolean(),
        declaredBy: z.string().trim().min(1, "Informe quem autorizou").max(120),
      }),
    )
    .mutation(({ ctx, input }) => serviceFor(ctx).registrarAutorizacaoPresencial(input)),

  resendLink: permitted({ enrollment: ["update"] })
    .input(
      z.object({ id: z.string().min(1), expiryDays: z.number().int().min(1).max(60).default(7) }),
    )
    .mutation(({ ctx, input }) => serviceFor(ctx).resendLink(input.id, input.expiryDays)),
});
