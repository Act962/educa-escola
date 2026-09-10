import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createAssessmentRepository } from "../assessment/repository";
import { createLessonRepository } from "../lesson/repository";
import { createStudentRepository } from "../student/repository";
import { createStudentService } from "../student/service";
import { createOverviewRepository } from "./repository";
import { overviewInput } from "./schema";
import { createOverviewService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createOverviewService({
    overview: createOverviewRepository(ctx.db, ctx.tenant),
    lessons: createLessonRepository(ctx.db, ctx.tenant),
    assessments: createAssessmentRepository(ctx.db, ctx.tenant),
  });
}

export const overviewRouter = router({
  /** Painel da direção. Exige leitura de aluno — é o dado mais sensível dele. */
  gestao: permitted({ student: ["read"], grade: ["read"] })
    .input(overviewInput)
    .query(({ ctx, input }) => serviceFor(ctx).gestao(input.term, new Date())),

  professor: permitted({ lesson: ["read"], grade: ["read"] })
    .input(overviewInput)
    .query(({ ctx, input }) => serviceFor(ctx).professor(ctx.membership.userId, input.term)),

  /** Painel do aluno. Resolve a matrícula pelo vínculo, nunca por id na entrada. */
  aluno: permitted({ grade: ["read"] })
    .input(overviewInput)
    .query(async ({ ctx, input }) => {
      const students = createStudentService(createStudentRepository(ctx.db, ctx.tenant));
      const me = await students.byUserId(ctx.membership.userId);
      return serviceFor(ctx).aluno({
        studentId: me.id,
        classroomId: me.classroomId,
        term: input.term,
      });
    }),
});
