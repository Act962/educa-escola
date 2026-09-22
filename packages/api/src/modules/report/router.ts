import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createReportRepository } from "./repository";
import { exportInput, reportYearInput } from "./schema";
import { createReportService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createReportService(createReportRepository(ctx.db, ctx.tenant));
}

/**
 * Relatórios (§15).
 *
 * Exige `student: read` **e** `grade: read`, como `overview.gestao`: é o dado
 * mais sensível que estas consultas tocam, e quem não pode ver aluno não pode
 * ver um agregado que o descreve.
 */
export const reportRouter = router({
  indicadores: permitted({ student: ["read"], grade: ["read"] })
    .input(reportYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).indicadores(input.academicYear, new Date())),

  catalogo: permitted({ student: ["read"] }).query(({ ctx }) => serviceFor(ctx).catalogo()),

  turmasEmAlerta: permitted({ student: ["read"] })
    .input(reportYearInput)
    .query(({ ctx, input }) => serviceFor(ctx).turmasEmAlerta(input.academicYear)),

  /**
   * O CSV é montado no servidor, não no navegador: a conta e o recorte têm de
   * ser os mesmos da tela, e reimplementá-los no cliente criaria duas versões
   * da verdade que divergem na primeira mudança.
   */
  exportar: permitted({ student: ["read"], grade: ["read"] })
    .input(exportInput)
    .mutation(({ ctx, input }) =>
      serviceFor(ctx).exportar(input.chave, input.academicYear, new Date()),
    ),
});
