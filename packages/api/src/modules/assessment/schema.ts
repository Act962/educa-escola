import { z } from "zod";

/** Bimestre. O ano letivo do MVP é dividido em quatro. */
export const term = z.number().int().min(1).max(4);

export const gradeGridInput = z.object({
  classroomId: z.string().min(1),
  subjectId: z.string().min(1),
  term,
});

export const saveGradesInput = z.object({
  assessmentId: z.string().min(1),
  entries: z
    .array(
      z.object({
        studentId: z.string().min(1),
        /** `null` apaga o lançamento — é como se corrige nota digitada errado. */
        score: z.number().min(0, "Nota mínima é 0").max(10, "Nota máxima é 10").nullable(),
      }),
    )
    .max(200),
});

export const createAssessmentInput = z.object({
  classroomId: z.string().min(1),
  subjectId: z.string().min(1),
  name: z.string().trim().min(1, "Informe o nome da avaliação").max(80),
  weight: z.number().int().min(1, "O peso começa em 1").max(10),
  term,
  appliedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida")
    .nullish(),
});

export const assessmentId = z.object({ id: z.string().min(1) });

export const reportCardInput = z.object({ term });

export type GradeGridInput = z.infer<typeof gradeGridInput>;
export type SaveGradesInput = z.infer<typeof saveGradesInput>;
