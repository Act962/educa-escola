import { auth } from "@educa-escola/auth";
import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";

import { permitted, publicProcedure, router } from "../../index";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createTeacherInviteService } from "./convite-service";
import { createTeacherInviteLookup, createTeacherRepository } from "./repository";
import {
  aceitarConviteInput,
  convidarProfessorInput,
  conviteToken,
  teacherFilters,
  teacherId,
} from "./schema";
import { createTeacherService } from "./service";

type Ctx = { db: DbHandle; tenant: TenantContext; membership: Membership };

/**
 * Cria a conta pelo Better Auth, que é o dono da identidade.
 *
 * Fica aqui, no router, e entra no serviço por parâmetro: assim o cadastro é
 * testável sem subir autenticação, e o serviço não conhece o provedor. Mesmo
 * padrão do messenger e do cliente do modelo.
 */
const criarConta = async (input: { name: string; email: string; password: string }) => {
  const saida = await auth.api.signUpEmail({ body: input });
  return { userId: saida.user.id };
};

function serviceFor(ctx: Ctx) {
  return createTeacherService(createTeacherRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    linkBaseUrl: env.BETTER_AUTH_URL,
    actor: { userId: ctx.membership.userId },
    criarConta,
  });
}

function conviteFor(ctx: { db: DbHandle }) {
  return createTeacherInviteService({
    now: () => new Date(),
    lookup: createTeacherInviteLookup(ctx.db),
    repoFor: (tenant) => createTeacherRepository(ctx.db, tenant),
    criarConta,
  });
}

export const teacherRouter = router({
  list: permitted({ faculty: ["read"] })
    .input(teacherFilters)
    .query(({ ctx, input }) => serviceFor(ctx).list(input, new Date())),

  byId: permitted({ faculty: ["read"] })
    .input(teacherId)
    .query(({ ctx, input }) => serviceFor(ctx).byId(input.userId, input.academicYear, new Date())),

  /** As disciplinas da escola, para marcar no cadastro. */
  disciplinas: permitted({ faculty: ["manage"] }).query(({ ctx }) => serviceFor(ctx).disciplinas()),

  /**
   * Cadastra um professor e devolve o link de acesso.
   *
   * `faculty: ["manage"]` — a permissão existia na matriz e nenhum código a
   * usava. Contratar é ato de direção e secretaria; professor não cadastra
   * colega.
   */
  convidar: permitted({ faculty: ["manage"] })
    .input(convidarProfessorInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).convidar(input)),

  /**
   * As duas procedures anônimas do convite.
   *
   * `publicProcedure` porque o professor ainda não tem conta — a autorização
   * dele é a posse do token, e criar a conta é justamente o que ele vem
   * fazer. Nenhuma das duas escreve em domínio escolar: o que nasce é a
   * identidade e o vínculo.
   */
  abrirConvite: publicProcedure
    .input(conviteToken)
    .query(({ ctx, input }) => conviteFor(ctx).abrir(input.token)),

  aceitarConvite: publicProcedure
    .input(aceitarConviteInput)
    .mutation(({ ctx, input }) => conviteFor(ctx).aceitar(input)),
});
