import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createAcademicRepository } from "./repository";
import {
  createSubjectInput,
  curriculumFilters,
  removeFromCurriculumInput,
  setCurriculumInput,
  subjectId,
  updateSubjectInput,
} from "./schema";
import { createAcademicService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createAcademicService(createAcademicRepository(ctx.db, ctx.tenant));
}

export const academicRouter = router({
  /** O catálogo é lido por quem dá aula: o professor escolhe disciplina. */
  subjects: permitted({ classroom: ["read"] }).query(({ ctx }) => serviceFor(ctx).listSubjects()),

  createSubject: permitted({ classroom: ["create"] })
    .input(createSubjectInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).createSubject(input)),

  updateSubject: permitted({ classroom: ["update"] })
    .input(updateSubjectInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).updateSubject(input)),

  removeSubject: permitted({ classroom: ["delete"] })
    .input(subjectId)
    .mutation(({ ctx, input }) => serviceFor(ctx).removeSubject(input.id)),

  curriculum: permitted({ classroom: ["read"] })
    .input(curriculumFilters)
    .query(({ ctx, input }) => serviceFor(ctx).curriculum(input)),

  setCurriculum: permitted({ classroom: ["update"] })
    .input(setCurriculumInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).setCurriculum(input)),

  removeFromCurriculum: permitted({ classroom: ["update"] })
    .input(removeFromCurriculumInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).removeFromCurriculum(input.id)),
});
