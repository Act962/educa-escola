import type { DbHandle } from "@educa-escola/db/types";

import { router, schoolProcedure } from "../../index";
import type { TenantContext } from "../../trpc/tenant";
import { createProfileRepository } from "./repository";
import { profileInput } from "./schema";
import { createProfileService } from "./service";

function serviceFor(ctx: { db: DbHandle; tenant: TenantContext }) {
  return createProfileService(createProfileRepository(ctx.db, ctx.tenant));
}

/**
 * "Meu perfil": o que o sistema sabe sobre quem está logado.
 *
 * `schoolProcedure` e não `permitted(...)`: não existe papel que possa ler o
 * próprio vínculo e outro que não possa. O recorte não é de permissão, é de
 * identidade — o `userId` vem do contexto, nunca da entrada.
 *
 * As **escritas** de identidade (nome, senha, sessões) não estão aqui: são do
 * Better Auth, e a tela as chama por `authClient`. Duplicá-las em tRPC faria o
 * domínio escrever na tabela `user`, que é da auth — a decisão estrutural nº 2
 * existe justamente para isso não acontecer.
 */
export const profileRouter = router({
  me: schoolProcedure
    .input(profileInput)
    .query(({ ctx, input }) =>
      serviceFor(ctx).me(ctx.membership.userId, ctx.membership.role, input.academicYear),
    ),
});
