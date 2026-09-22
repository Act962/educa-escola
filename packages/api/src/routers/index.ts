import { protectedProcedure, publicProcedure, router, schoolProcedure } from "../index";
import { academicRouter } from "../modules/academic/router";
import { assessmentRouter } from "../modules/assessment/router";
import { calendarRouter } from "../modules/calendar/router";
import { classroomRouter } from "../modules/classroom/router";
import { enrollmentRouter } from "../modules/enrollment/router";
import { enrollmentLinkRouter } from "../modules/enrollment-link/router";
import { leaderboardRouter } from "../modules/leaderboard/router";
import { lessonRouter } from "../modules/lesson/router";
import { orbitaRouter } from "../modules/orbita/router";
import { overviewRouter } from "../modules/overview/router";
import { photoRouter } from "../modules/photo/router";
import { scoreRouter } from "../modules/score/router";
import { studentRouter } from "../modules/student/router";
import { teacherRouter } from "../modules/teacher/router";

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
  /** Catálogo de disciplinas e grade curricular. */
  academic: academicRouter,
  calendar: calendarRouter,
  classroom: classroomRouter,
  enrollment: enrollmentRouter,
  /** Fluxo do responsável, sem sessão. Ver o comentário no router. */
  enrollmentLink: enrollmentLinkRouter,
  student: studentRouter,
  /** Corpo docente, para a gestão. Pendências de registro, nunca desempenho. */
  teacher: teacherRouter,
  /** Foto do aluno. Ver o comentário no router: leitura também é restrita. */
  photo: photoRouter,
  lesson: lessonRouter,
  assessment: assessmentRouter,
  leaderboard: leaderboardRouter,
  overview: overviewRouter,
  /** Apps do ecossistema Órbita. O dado deles mora lá; aqui, o vínculo. */
  orbita: orbitaRouter,
  score: scoreRouter,
});

export type AppRouter = typeof appRouter;
