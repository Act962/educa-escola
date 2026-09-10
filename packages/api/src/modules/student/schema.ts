import { z } from "zod";

export const SHIFTS = ["manha", "tarde", "noite"] as const;
export const STUDENT_STATUSES = [
  "ativo",
  "documentacao_pendente",
  "transferido",
  "inativo",
] as const;

export const studentName = z.string().trim().min(1, "Informe o nome do aluno").max(120);

/** Matrícula é identificador impresso em documento: sem espaço, caixa alta. */
export const registration = z
  .string()
  .trim()
  .min(1, "Informe a matrícula")
  .max(30)
  .transform((value) => value.toUpperCase().replace(/\s+/g, ""));

export const listStudentsInput = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: z.enum(STUDENT_STATUSES).optional(),
    shift: z.enum(SHIFTS).optional(),
    classroomId: z.string().min(1).optional(),
    /** Só alunos abaixo do mínimo de frequência. */
    atRisk: z.boolean().optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .default({ limit: 50, offset: 0 });

export const createStudentInput = z.object({
  name: studentName,
  registration,
  classroomId: z.string().min(1).nullish(),
  shift: z.enum(SHIFTS).default("manha"),
  guardianName: z.string().trim().max(120).nullish(),
});

export const studentId = z.object({ id: z.string().min(1) });

export type ListStudentsInput = z.infer<typeof listStudentsInput>;
export type CreateStudentInput = z.infer<typeof createStudentInput>;
