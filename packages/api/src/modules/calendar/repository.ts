import { academicCalendar, calendarEvent } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, eq } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { CreateEventInput, DefineYearInput } from "./schema";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createCalendarRepository(db: DbHandle, tenant: TenantContext) {
  const noCalendario = eq(academicCalendar.schoolId, tenant.schoolId);
  const noEvento = eq(calendarEvent.schoolId, tenant.schoolId);

  return {
    async findYear(academicYear: number) {
      const [row] = await db
        .select()
        .from(academicCalendar)
        .where(and(noCalendario, eq(academicCalendar.academicYear, academicYear)))
        .limit(1);
      return row ?? null;
    },

    /**
     * Define ou redefine o ano letivo.
     *
     * `onConflictDoUpdate` no único de (escola, ano): corrigir a data de
     * início do ano é operação normal de secretaria em fevereiro, não erro.
     */
    async defineYear(data: DefineYearInput) {
      const [row] = await db
        .insert(academicCalendar)
        .values({ ...data, schoolId: tenant.schoolId })
        .onConflictDoUpdate({
          target: [academicCalendar.schoolId, academicCalendar.academicYear],
          set: {
            startsOn: data.startsOn,
            endsOn: data.endsOn,
            minimumSchoolDays: data.minimumSchoolDays,
          },
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async listEvents(academicYear: number) {
      return db
        .select()
        .from(calendarEvent)
        .where(and(noEvento, eq(calendarEvent.academicYear, academicYear)))
        .orderBy(asc(calendarEvent.startsOn), asc(calendarEvent.title));
    },

    async createEvent(data: CreateEventInput & { endsOn: string; createdByUserId: string }) {
      const [row] = await db
        .insert(calendarEvent)
        .values({ ...data, schoolId: tenant.schoolId })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /** Um evento desta escola. É dele que sai o ano letivo a validar. */
    async findEvent(id: string) {
      const [row] = await db
        .select()
        .from(calendarEvent)
        .where(and(noEvento, eq(calendarEvent.id, id)))
        .limit(1);
      return row ?? null;
    },

    async updateEvent(
      id: string,
      data: {
        type: CreateEventInput["type"];
        dayEffect: CreateEventInput["dayEffect"];
        title: string;
        description?: string | null;
        startsOn: string;
        endsOn: string;
      },
    ) {
      const [row] = await db
        .update(calendarEvent)
        .set(data)
        .where(and(noEvento, eq(calendarEvent.id, id)))
        .returning();
      return row ?? null;
    },

    async removeEvent(id: string) {
      const [row] = await db
        .delete(calendarEvent)
        .where(and(noEvento, eq(calendarEvent.id, id)))
        .returning({ id: calendarEvent.id });
      return row ?? null;
    },
  };
}

export type CalendarRepository = ReturnType<typeof createCalendarRepository>;
