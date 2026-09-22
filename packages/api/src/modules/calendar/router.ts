import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createCalendarRepository } from "./repository";
import { calendarYearInput, createEventInput, defineYearInput, eventId } from "./schema";
import { createCalendarService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createCalendarService(createCalendarRepository(ctx.db, ctx.tenant));
}

export const calendarRouter = router({
  /** Todo mundo lê o calendário: é o que diz quando tem aula. */
  year: permitted({ calendar: ["read"] })
    .input(calendarYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).year(input.academicYear)),

  defineYear: permitted({ calendar: ["manage"] })
    .input(defineYearInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).defineYear(input)),

  createEvent: permitted({ calendar: ["manage"] })
    .input(createEventInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).createEvent(input, ctx.membership.userId)),

  removeEvent: permitted({ calendar: ["manage"] })
    .input(eventId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removeEvent(input.id)),
});
