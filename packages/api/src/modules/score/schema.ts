import { z } from "zod";

export const academicYear = z
  .number()
  .int()
  .min(2000, "Ano letivo fora do intervalo suportado")
  .max(2100, "Ano letivo fora do intervalo suportado");

export const scoreYearInput = z.object({ academicYear });

export const tallyInput = z.object({ academicYear });

export type ScoreYearInput = z.infer<typeof scoreYearInput>;
export type TallyInput = z.infer<typeof tallyInput>;
