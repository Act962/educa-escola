import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createCalendarRepository } from "./repository";
import {
  calendarYearInput,
  createEventInput,
  defineYearInput,
  eventId,
  updateEventInput,
} from "./schema";
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

  /** O calendário brasileiro do ano, com o que já está no sistema marcado. */
  sugestoes: permitted({ calendar: ["read"] })
    .input(calendarYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).sugestoes(input.academicYear)),

  importar: permitted({ calendar: ["manage"] })
    .input(calendarYearInput)
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).importar(input.academicYear, ctx.membership.userId),
    ),

  updateEvent: permitted({ calendar: ["manage"] })
    .input(updateEventInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).updateEvent(input)),

  removeEvent: permitted({ calendar: ["manage"] })
    .input(eventId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removeEvent(input.id)),
});
