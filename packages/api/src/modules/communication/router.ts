import type { DbHandle } from "@educa-escola/db/types";
import { z } from "zod";
import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createStudentRepository } from "../student/repository";
import { createCommunicationRepository } from "./repository";
import {
  communicationId,
  communicationYearInput,
  publishInput,
  rectifyInput,
  saveDraftInput,
} from "./schema";
import { createCommunicationService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createCommunicationService(createCommunicationRepository(ctx.db, ctx.tenant));
}

export const communicationRouter = router({
  /** O painel da gestão: rascunhos, publicados e taxa de leitura. */
  list: permitted({ communication: ["manage"] })
    .input(communicationYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).list(input.academicYear)),

  previewAudience: permitted({ communication: ["manage"] })
    .input(
      z.object({
        audience: z.enum(["toda_a_escola", "professores", "alunos", "turma"]),
        classroomId: z.string().min(1).optional(),
      }),
    )
    .query(({ ctx, input }) =>
      serviceFor(ctx).previewAudience(input.audience, input.classroomId ?? null),
    ),

  createDraft: permitted({ communication: ["manage"] })
    .input(saveDraftInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).createDraft(input, ctx.membership.userId)),

  publish: permitted({ communication: ["manage"] })
    .input(publishInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).publish(input, new Date())),

  rectify: permitted({ communication: ["manage"] })
    .input(rectifyInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).rectify(input, ctx.membership.userId)),

  remove: permitted({ communication: ["manage"] })
    .input(communicationId)
    .mutation(({ ctx, input }) => serviceFor(ctx).remove(input.id)),

  /**
   * O mural de quem recebe.
   *
   * A turma sai da ficha do aluno, nunca de id na entrada — do contrário
   * qualquer pessoa leria o mural de qualquer turma trocando um parâmetro.
   */
  inbox: permitted({ communication: ["read"] })
    .input(communicationYearInput)
    .query(async ({ ctx, input }) => {
      const classroomId =
        ctx.membership.role === "student"
          ? ((
              (await createStudentRepository(ctx.db, ctx.tenant).findByUserId(
                ctx.membership.userId,
              )) ?? null
            )?.classroomId ?? null)
          : null;

      return serviceFor(ctx).inbox({
        userId: ctx.membership.userId,
        role: ctx.membership.role,
        academicYear: input.academicYear,
        classroomId,
      });
    }),

  marcarComoLido: permitted({ communication: ["read"] })
    .input(communicationId.extend({ acknowledge: z.boolean().default(false) }))
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).marcarComoLido(input.id, ctx.membership.userId, input.acknowledge),
    ),
});
