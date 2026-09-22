import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createTeacherRepository } from "./repository";
import { teacherFilters, teacherId } from "./schema";
import { createTeacherService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createTeacherService(createTeacherRepository(ctx.db, ctx.tenant));
}

export const teacherRouter = router({
  list: permitted({ faculty: ["read"] })
    .input(teacherFilters)
    .query(({ ctx, input }) => serviceFor(ctx).list(input, new Date())),

  byId: permitted({ faculty: ["read"] })
    .input(teacherId)
    .query(({ ctx, input }) => serviceFor(ctx).byId(input.userId, input.academicYear, new Date())),
});
