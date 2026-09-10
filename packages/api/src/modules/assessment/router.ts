import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createStudentRepository } from "../student/repository";
import { createStudentService } from "../student/service";
import { createAssessmentRepository } from "./repository";
import {
  assessmentId,
  createAssessmentInput,
  gradeGridInput,
  reportCardInput,
  saveGradesInput,
} from "./schema";
import { createAssessmentService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createAssessmentService(
    createAssessmentRepository(ctx.db, ctx.tenant),
    createStudentRepository(ctx.db, ctx.tenant),
  );
}

export const assessmentRouter = router({
  grid: permitted({ grade: ["read"] })
    .input(gradeGridInput)
    .query(({ ctx, input }) =>
      serviceFor(ctx).grid(input.classroomId, input.subjectId, input.term),
    ),

  list: permitted({ assessment: ["read"] })
    .input(gradeGridInput)
    .query(({ ctx, input }) =>
      serviceFor(ctx).listOf(input.classroomId, input.subjectId, input.term),
    ),

  create: permitted({ assessment: ["create"] })
    .input(createAssessmentInput)
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).create({ ...input, teacherId: ctx.membership.userId }),
    ),

  saveGrades: permitted({ grade: ["create"] })
    .input(saveGradesInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).saveGrades(input)),

  publish: permitted({ assessment: ["publish"] })
    .input(assessmentId)
    .mutation(({ ctx, input }) => serviceFor(ctx).publish(input.id, new Date())),

  /**
   * Boletim de quem está logado. Resolve a matrícula pelo vínculo antes de
   * chegar às notas — o aluno nunca informa de quem é o boletim.
   */
  myReportCard: permitted({ grade: ["read"] })
    .input(reportCardInput)
    .query(async ({ ctx, input }) => {
      const students = createStudentService(createStudentRepository(ctx.db, ctx.tenant));
      const me = await students.byUserId(ctx.membership.userId);
      return serviceFor(ctx).reportCard(me.id, input.term);
    }),
});
