import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";

import { permitted, router } from "../../index";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createEnrollmentRepository } from "../enrollment/repository";
import { createGateRepository } from "../gate/repository";
import { createPhotoRepository } from "./repository";
import { revokePhotoInput, savePhotoInput, studentRef } from "./schema";
import { createPhotoService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext; membership: Membership }) {
  return createPhotoService(
    createPhotoRepository(ctx.db, ctx.tenant),
    createEnrollmentRepository(ctx.db, ctx.tenant),
    {
      now: () => new Date(),
      encryptionKey: env.MEDIA_ENCRYPTION_KEY,
      actor: { userId: ctx.membership.userId },
      deleteFaceTemplate: (studentId) =>
        createGateRepository(ctx.db, ctx.tenant).deleteTemplate(studentId),
    },
  );
}

/**
 * Foto e identificação facial.
 *
 * Exige `student: ["update"]` até para ler: a foto é o dado mais sensível do
 * cadastro, e quem pode apenas listar aluno não precisa dela. Professor tem
 * leitura de aluno e **não** entra aqui.
 */
export const photoRouter = router({
  status: permitted({ student: ["update"] })
    .input(studentRef)
    .query(({ ctx, input }) => serviceFor(ctx).status(input.studentId)),

  read: permitted({ student: ["update"] })
    .input(studentRef)
    .mutation(({ ctx, input }) => serviceFor(ctx).read(input.studentId)),

  save: permitted({ student: ["update"] })
    .input(savePhotoInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).save(input)),

  revoke: permitted({ student: ["update"] })
    .input(revokePhotoInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).revoke(input)),
});
