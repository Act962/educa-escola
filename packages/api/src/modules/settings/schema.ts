import { z } from "zod";

/**
 * Código INEP: oito dígitos do Censo Escolar.
 *
 * Aceita vazio e guarda `null`: escola recém-criada ainda não tem código, e
 * string vazia numa coluna de identificador é o tipo de dado que passa por
 * preenchido num relatório e não casa com nada.
 */
export const updateSchoolInput = z.object({
  inepCode: z
    .string()
    .trim()
    .regex(/^\d{8}$/, "O código INEP tem exatamente 8 dígitos.")
    .or(z.literal(""))
    .nullable()
    .optional(),
});

export type UpdateSchoolInput = z.infer<typeof updateSchoolInput>;
