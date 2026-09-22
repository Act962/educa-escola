import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";

import { permitted, router } from "../../index";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createGateRepository } from "./repository";
import {
  byRegistrationInput,
  deleteEntryInput,
  enrollTemplateInput,
  entriesInput,
  identifyInput,
  recordEntryInput,
} from "./schema";
import { createGateService } from "./service";

type Ctx = { db: DbHandle; tenant: TenantContext; membership: Membership };

function serviceFor(ctx: Ctx) {
  return createGateService(createGateRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    chave: env.MEDIA_ENCRYPTION_KEY,
    actor: { userId: ctx.membership.userId },
  });
}

/**
 * A portaria.
 *
 * `operate` é quem tem o quiosque aberto; `enroll_face` é cadastrar biometria
 * de menor, que é ato de peso próprio e por isso ação separada. `read` é a
 * lista de quem entrou — o professor a enxerga, porque é ela que responde "o
 * aluno chegou?" antes da chamada.
 */
export const gateRouter = router({
  /**
   * Os moldes para o tablet comparar sozinho.
   *
   * Query e não mutation porque é leitura, mas o cliente não deve cacheá-la
   * além de `validoAte`: o prazo é o que faz uma revogação chegar ao portão.
   */
  lote: permitted({ gate: ["operate"] }).query(({ ctx }) => serviceFor(ctx).lote()),

  /** Identifica no servidor, para quando o tablet não puder comparar. */
  identificar: permitted({ gate: ["operate"] })
    .input(identifyInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).identificarRosto(input)),

  /** O caminho da carteirinha, que é o que nunca falha. */
  porMatricula: permitted({ gate: ["operate"] })
    .input(byRegistrationInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).porMatricula(input.registration)),

  registrar: permitted({ gate: ["operate"] })
    .input(recordEntryInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).registrar(input)),

  cadastrarMolde: permitted({ gate: ["enroll_face"] })
    .input(enrollTemplateInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).cadastrarMolde(input)),

  situacao: permitted({ gate: ["read"] }).query(({ ctx }) => serviceFor(ctx).situacao()),

  /** As passagens de um dia, com filtro por aluno e a lista de excluídas. */
  passagens: permitted({ gate: ["read"] })
    .input(entriesInput)
    .query(({ ctx, input }) => serviceFor(ctx).passagens(input)),

  /**
   * Exclui uma passagem, marcando.
   *
   * `delete_entry` e não `operate`: o quiosque fica horas aberto num tablet de
   * corredor, e quem passa por ali não deve poder apagar o registro de uma
   * criança.
   */
  excluirPassagem: permitted({ gate: ["delete_entry"] })
    .input(deleteEntryInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).excluir(input)),
});
