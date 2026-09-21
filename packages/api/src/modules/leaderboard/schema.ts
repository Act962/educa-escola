import { z } from "zod";

export const academicYear = z.number().int().min(2000).max(2100);

/**
 * O nome que a escola usa no placar.
 *
 * Curto de propósito: é rótulo de linha, não razão social. E `trim` porque
 * espaço no fim vira duas escolas visualmente idênticas na ordenação.
 */
export const displayName = z
  .string()
  .trim()
  .min(2, "Informe como a escola deve aparecer no placar")
  .max(60, "Use um nome curto: é o rótulo de uma linha do placar");

export const optInInput = z.object({ displayName, academicYear });
export const leaderboardYearInput = z.object({ academicYear });

export type OptInInput = z.infer<typeof optInInput>;
