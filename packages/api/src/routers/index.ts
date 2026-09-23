import { protectedProcedure, publicProcedure, router, schoolProcedure } from "../index";
import { academicRouter } from "../modules/academic/router";
import { assessmentRouter } from "../modules/assessment/router";
import { assistantRouter } from "../modules/assistant/router";
import { calendarRouter } from "../modules/calendar/router";
import { classroomRouter } from "../modules/classroom/router";
import { communicationRouter } from "../modules/communication/router";
import { enrollmentRouter } from "../modules/enrollment/router";
import { enrollmentLinkRouter } from "../modules/enrollment-link/router";
import { gateRouter } from "../modules/gate/router";
import { leaderboardRouter } from "../modules/leaderboard/router";
import { lessonRouter } from "../modules/lesson/router";
import { orbitaRouter } from "../modules/orbita/router";
import { overviewRouter } from "../modules/overview/router";
import { photoRouter } from "../modules/photo/router";
import { profileRouter } from "../modules/profile/router";
import { referralRouter } from "../modules/referral/router";
import { reportRouter } from "../modules/report/router";
import { scoreRouter } from "../modules/score/router";
import { settingsRouter } from "../modules/settings/router";
import { studentRouter } from "../modules/student/router";
import { teacherRouter } from "../modules/teacher/router";
import { whatsappRouter } from "../modules/whatsapp/router";

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
  communication: communicationRouter,
  enrollment: enrollmentRouter,
  /** Fluxo do responsável, sem sessão. Ver o comentário no router. */
  enrollmentLink: enrollmentLinkRouter,
  /** Relatórios e indicadores (§15). Só agregados, nunca lista de pessoa. */
  report: reportRouter,
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
  /**
   * "Meu perfil": só leitura, e só de quem pede. As escritas de identidade
   * (nome, senha, sessões) são do Better Auth e a tela as chama direto.
   */
  profile: profileRouter,
  /** Configurações da instituição. Fechado atrás de `organization: update`. */
  settings: settingsRouter,
  /** O Astro. A credencial do modelo nunca volta para a tela. */
  assistant: assistantRouter,
  gate: gateRouter,
  /**
   * Programa de indicações. A visão da gestão é nominal e fica atrás de
   * `referral: read`; a de quem divulga resolve por identidade.
   */
  referral: referralRouter,
  /**
   * WhatsApp. Porta e adaptadores em `messaging/whatsapp/`: a Meta é uma
   * implementação, não o contrato. Toda a aba é da gestão.
   */
  whatsapp: whatsappRouter,
});

export type AppRouter = typeof appRouter;
