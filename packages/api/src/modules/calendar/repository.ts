import { academicCalendar, calendarEvent, classroom } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { CreateEventInput, DefineYearInput, EventScope } from "./schema";

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createCalendarRepository(db: DbHandle, tenant: TenantContext) {
  const noCalendario = eq(academicCalendar.schoolId, tenant.schoolId);
  const noEvento = eq(calendarEvent.schoolId, tenant.schoolId);

  /**
   * Colunas explícitas, e não `select()`.
   *
   * Com o `leftJoin` da turma, `select()` devolveria `{ calendar_event: …,
   * classroom: … }` e toda a tela teria de aprender essa forma. Nomear as
   * colunas mantém o evento plano, com o nome da turma junto.
   */
  const colunasDoEvento = {
    id: calendarEvent.id,
    academicYear: calendarEvent.academicYear,
    scope: calendarEvent.scope,
    classroomId: calendarEvent.classroomId,
    classroomName: classroom.name,
    type: calendarEvent.type,
    dayEffect: calendarEvent.dayEffect,
    title: calendarEvent.title,
    description: calendarEvent.description,
    startsOn: calendarEvent.startsOn,
    endsOn: calendarEvent.endsOn,
  };

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

    /**
     * Os eventos do ano, opcionalmente recortados por turma.
     *
     * Com `classroomId`, a consulta devolve os eventos da turma **e** os da
     * escola inteira: o feriado de 7 de setembro vale para o 9º C, e um filtro
     * que o escondesse faria a coordenação achar que aquela turma tem aula.
     * Sem `classroomId`, devolve tudo — inclusive o que é de outras turmas,
     * porque a visão sem filtro é a da escola como um todo.
     */
    async listEvents(academicYear: number, classroomId?: string) {
      const daTurma = classroomId
        ? or(isNull(calendarEvent.classroomId), eq(calendarEvent.classroomId, classroomId))
        : undefined;

      return db
        .select(colunasDoEvento)
        .from(calendarEvent)
        .leftJoin(classroom, eq(classroom.id, calendarEvent.classroomId))
        .where(and(noEvento, eq(calendarEvent.academicYear, academicYear), daTurma))
        .orderBy(asc(calendarEvent.startsOn), asc(calendarEvent.title));
    },

    /**
     * A turma, se for desta escola.
     *
     * É o que impede um evento daqui de apontar para a turma de outra escola:
     * a chave estrangeira aceitaria, porque a turma existe — só não é nossa.
     */
    async findClassroom(id: string) {
      const [row] = await db
        .select({ id: classroom.id, name: classroom.name })
        .from(classroom)
        .where(and(eq(classroom.schoolId, tenant.schoolId), eq(classroom.id, id)))
        .limit(1);
      return row ?? null;
    },

    async createEvent(
      data: CreateEventInput & {
        endsOn: string;
        scope: EventScope;
        classroomId: string | null;
        createdByUserId: string;
      },
    ) {
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
        scope: EventScope;
        classroomId: string | null;
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
