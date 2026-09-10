import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createStudentRepository } from "../student/repository";
import { createStudentService } from "../student/service";
import { createLessonRepository } from "./repository";
import { lessonId, saveAttendanceInput } from "./schema";
import { createLessonService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createLessonService(
    createLessonRepository(ctx.db, ctx.tenant),
    createStudentRepository(ctx.db, ctx.tenant),
  );
}

export const lessonRouter = router({
  /** Agenda de hoje de quem está logado — o professor não escolhe de quem é. */
  myAgenda: permitted({ lesson: ["read"] }).query(({ ctx }) =>
    serviceFor(ctx).agendaOfTeacher(ctx.membership.userId, new Date()),
  ),

  byId: permitted({ lesson: ["read"] })
    .input(lessonId)
    .query(({ ctx, input }) => serviceFor(ctx).get(input.id)),

  attendanceSheet: permitted({ attendance: ["read"] })
    .input(lessonId)
    .query(({ ctx, input }) => serviceFor(ctx).attendanceSheet(input.id, new Date())),

  saveAttendance: permitted({ attendance: ["create"] })
    .input(saveAttendanceInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).saveAttendance(input, new Date())),

  myClassrooms: permitted({ lesson: ["read"] }).query(({ ctx }) =>
    serviceFor(ctx).classroomsOf(ctx.membership.userId),
  ),

  /** Aulas de hoje da turma de quem está logado — a agenda do aluno. */
  myClassAgenda: permitted({ lesson: ["read"] }).query(async ({ ctx }) => {
    const students = createStudentService(createStudentRepository(ctx.db, ctx.tenant));
    const me = await students.byUserId(ctx.membership.userId);
    if (!me.classroomId) return { date: null, lessons: [] };
    return serviceFor(ctx).agendaOfClassroom(me.classroomId, new Date());
  }),
});
