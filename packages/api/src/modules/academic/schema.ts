import { z } from "zod";

export const STAGES = ["infantil", "fundamental_i", "fundamental_ii", "medio"] as const;
export const SUBJECT_KINDS = ["obrigatoria", "eletiva", "complementar"] as const;

export type Stage = (typeof STAGES)[number];
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

/** Rótulo de segmento. Fica aqui para a tela e o servidor não divergirem. */
export const STAGE_LABEL: Record<Stage, string> = {
  infantil: "Educação infantil",
  fundamental_i: "Fundamental I",
  fundamental_ii: "Fundamental II",
  medio: "Ensino médio",
};

/**
 * Séries válidas por segmento.
 *
 * O par série+segmento é a chave da grade curricular, e "1º ano" existe no
 * fundamental e no médio — validar a série sozinha deixaria passar um 9º ano
 * do médio, que não existe.
 */
export const SERIES_POR_SEGMENTO: Record<Stage, number[]> = {
  infantil: [1, 2, 3, 4, 5],
  fundamental_i: [1, 2, 3, 4, 5],
  fundamental_ii: [6, 7, 8, 9],
  medio: [1, 2, 3],
};

export const academicYear = z.number().int().min(2000).max(2100);

export const subjectName = z.string().trim().min(2, "Informe o nome da disciplina").max(80);

export const createSubjectInput = z.object({
  name: subjectName,
  code: z.string().trim().max(10).optional(),
  area: z.string().trim().max(60).optional(),
  kind: z.enum(SUBJECT_KINDS).default("obrigatoria"),
  composesAverage: z.boolean().default(true),
  tracksAttendance: z.boolean().default(true),
});

export const updateSubjectInput = createSubjectInput.partial().extend({
  id: z.string().min(1),
});

export const subjectId = z.object({ id: z.string().min(1) });

const serieDoSegmento = z
  .object({ stage: z.enum(STAGES), gradeLevel: z.number().int().min(1).max(12) })
  .refine((v) => SERIES_POR_SEGMENTO[v.stage].includes(v.gradeLevel), {
    message: "Esta série não existe neste segmento",
    path: ["gradeLevel"],
  });

export const curriculumFilters = z.object({
  academicYear,
  stage: z.enum(STAGES).optional(),
});

export const setCurriculumInput = z.intersection(
  serieDoSegmento,
  z.object({
    academicYear,
    subjectId: z.string().min(1),
    weeklyHours: z.number().int().min(1, "Pelo menos uma aula por semana").max(40),
    annualHours: z.number().int().min(1).max(2000).optional(),
  }),
);

export const removeFromCurriculumInput = z.object({ id: z.string().min(1) });

export type CreateSubjectInput = z.infer<typeof createSubjectInput>;
export type UpdateSubjectInput = z.infer<typeof updateSubjectInput>;
export type SetCurriculumInput = z.infer<typeof setCurriculumInput>;
export type CurriculumFilters = z.infer<typeof curriculumFilters>;
