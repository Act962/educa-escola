import { protectedProcedure, publicProcedure, router } from "../index";
import { classroomRouter } from "../modules/classroom/router";

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
  classroom: classroomRouter,
});

export type AppRouter = typeof appRouter;
