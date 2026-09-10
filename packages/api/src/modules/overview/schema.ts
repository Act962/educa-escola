import { z } from "zod";

/** Bimestre em foco. A tela envia o do seletor de contexto do topo. */
export const overviewInput = z.object({
  term: z.number().int().min(1).max(4).default(3),
});

export type OverviewInput = z.infer<typeof overviewInput>;
