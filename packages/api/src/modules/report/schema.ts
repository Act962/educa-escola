import { z } from "zod";

export const REPORT_KEYS = [
  "alunos-por-turma",
  "frequencia-por-turma",
  "carga-dos-docentes",
] as const;

export const reportYearInput = z.object({
  academicYear: z.number().int().min(2000).max(2100),
});

export const exportInput = reportYearInput.extend({
  chave: z.enum(REPORT_KEYS),
});

export type ExportInput = z.infer<typeof exportInput>;
