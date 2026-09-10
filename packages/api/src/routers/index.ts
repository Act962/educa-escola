import { protectedProcedure, publicProcedure, router, schoolProcedure } from "../index";
import { assessmentRouter } from "../modules/assessment/router";
import { classroomRouter } from "../modules/classroom/router";
import { lessonRouter } from "../modules/lesson/router";
import { overviewRouter } from "../modules/overview/router";
import { studentRouter } from "../modules/student/router";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  /**
   * Quem é o usuário nesta escola: nome, papel e vínculo.
   *
   * A casca do app decide o menu a partir daqui — o papel vem do servidor, e
   * não do que o navegador acha que é, senão esconder item de menu viraria a
   * única barreira.
   */
  me: schoolProcedure.query(({ ctx }) => ({
    userId: ctx.membership.userId,
    name: ctx.session.user.name,
    email: ctx.session.user.email,
    role: ctx.membership.role,
    schoolId: ctx.membership.schoolId,
    schoolName: ctx.membership.schoolName,
  })),
  classroom: classroomRouter,
  student: studentRouter,
  lesson: lessonRouter,
  assessment: assessmentRouter,
  overview: overviewRouter,
});

export type AppRouter = typeof appRouter;
