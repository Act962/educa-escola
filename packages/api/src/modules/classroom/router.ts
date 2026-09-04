import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createClassroomRepository } from "./repository";
import { classroomId, createClassroomInput, renameClassroomInput } from "./schema";
import { createClassroomService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createClassroomService(createClassroomRepository(ctx.db, ctx.tenant));
}

export const classroomRouter = router({
  list: permitted({ classroom: ["read"] }).query(({ ctx }) => serviceFor(ctx).list()),

  byId: permitted({ classroom: ["read"] })
    .input(classroomId)
    .query(({ ctx, input }) => serviceFor(ctx).get(input.id)),

  create: permitted({ classroom: ["create"] })
    .input(createClassroomInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).create(input)),

  rename: permitted({ classroom: ["update"] })
    .input(renameClassroomInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).rename(input.id, input.name)),

  remove: permitted({ classroom: ["delete"] })
    .input(classroomId)
    .mutation(({ ctx, input }) => serviceFor(ctx).remove(input.id)),
});
