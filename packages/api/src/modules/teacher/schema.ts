import { z } from "zod";

export const teacherFilters = z.object({
  /** Busca por nome ou e-mail. */
  search: z.string().trim().max(120).optional(),
  academicYear: z.number().int().min(2000).max(2100),
  /** Só quem está devendo chamada ou nota. */
  withPending: z.boolean().optional(),
});

export const teacherId = z.object({
  userId: z.string().min(1),
  academicYear: z.number().int().min(2000).max(2100),
});

export type TeacherFilters = z.infer<typeof teacherFilters>;
