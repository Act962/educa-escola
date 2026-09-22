import type { DbHandle } from "@educa-escola/db/types";

import { permitted, router } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createSettingsRepository } from "./repository";
import { updateSchoolInput } from "./schema";
import { createSettingsService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createSettingsService(createSettingsRepository(ctx.db, ctx.tenant));
}

/**
 * Configurações da instituição.
 *
 * `organization: ["update"]` na **leitura** também, e não só na escrita: a
 * tela mostra nome e e-mail de quem tem acesso total, que é mapa de quem
 * atacar. Professor e aluno têm `organization: []`, então a porta fecha para
 * os dois sem precisar de um recurso novo no RBAC.
 */
export const settingsRouter = router({
  overview: permitted({ organization: ["update"] }).query(({ ctx }) => serviceFor(ctx).overview()),

  updateSchool: permitted({ organization: ["update"] })
    .input(updateSchoolInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).updateSchool(input)),
});
