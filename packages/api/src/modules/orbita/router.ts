import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";
import { z } from "zod";

import { permitted, router } from "../../index";
import { createDemoCatalog } from "../../integrations/orbita/catalog";
import { createOrbitaIdentity } from "../../integrations/orbita/identity";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createOrbitaRepository } from "./repository";
import { installAppInput, openAppInput, removeAppInput } from "./schema";
import { createOrbitaService } from "./service";

/**
 * O catálogo é o dublê enquanto o Órbita não expõe a porta.
 *
 * DECISÃO-JOÃO: de onde vêm preço e saldo dos apps.
 * Quebra se: o Órbita hoje só autentica por cookie de sessão, então não há
 *   como ler `AppStarCost` nem `Organization.starsBalance` de fora. A tela
 *   mostraria número inventado se isto fosse para produção como está.
 * Fiz assim: `createDemoCatalog()` atrás da interface `OrbitaCatalog`, para a
 *   tela e os testes terem forma sem rede. Trocar é uma implementação nova
 *   atrás da mesma interface — nada no service nem na tela muda.
 * Alternativas: porta máquina-a-máquina no Órbita (plugin `apiKey` ou `bearer`
 *   do Better Auth) · leitura direta do banco dele, se compartilharem infra.
 */
function serviceFor(ctx: {
  db: DbHandle;
  tenant: TenantContext;
  membership: Membership;
  issueOrbitaToken: () => Promise<string | null>;
}) {
  return createOrbitaService(createOrbitaRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    catalog: createDemoCatalog(),
    identity: createOrbitaIdentity({
      baseUrl: env.ORBITA_BASE_URL,
      issueToken: ctx.issueOrbitaToken,
    }),
    actor: { userId: ctx.membership.userId },
  });
}

export const orbitaRouter = router({
  overview: permitted({ app: ["read"] }).query(({ ctx }) => serviceFor(ctx).overview()),

  /** Leve, para a barra lateral: só a tabela local, sem chamar o Órbita. */
  installed: permitted({ app: ["read"] }).query(({ ctx }) => serviceFor(ctx).installed()),

  events: permitted({ app: ["read"] }).query(({ ctx }) => serviceFor(ctx).events()),

  /**
   * Conectar e instalar exigem `install`, que só o `owner` tem.
   *
   * Instalar é contratar: cria organização no Órbita e debita Stars da conta
   * da escola. A secretaria abre o que já está instalado.
   */
  connect: permitted({ app: ["install"] })
    .input(z.object({ orbitaOrganizationId: z.string().trim().min(1) }))
    .mutation(({ ctx, input }) => serviceFor(ctx).connect(input.orbitaOrganizationId)),

  install: permitted({ app: ["install"] })
    .input(installAppInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).install(input)),

  /**
   * O endereço para abrir um app.
   *
   * É `mutation` e não `query` de propósito: emite um token de uso único que
   * vale segundos. Como query, o React Query guardaria em cache um endereço
   * que já morreu, e o segundo clique abriria uma tela de erro.
   */
  openApp: permitted({ app: ["read"] })
    .input(openAppInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).openApp(input)),

  remove: permitted({ app: ["remove"] })
    .input(removeAppInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).remove(input)),
});
