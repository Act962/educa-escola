import { type AppRole, roles } from "@educa-escola/auth";
import { initTRPC, TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

import type { Context } from "./context";
import { DomainError } from "./errors";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

const DOMAIN_TO_TRPC = {
  CONFLICT: "CONFLICT",
  NOT_FOUND: "NOT_FOUND",
  BAD_REQUEST: "BAD_REQUEST",
} as const satisfies Record<DomainError["code"], TRPC_ERROR_CODE_KEY>;

/**
 * Traduz erro de domínio em código tRPC (e, portanto, em status HTTP correto).
 *
 * Sem isso um ConflictError sairia como 500. Fica num middleware, e não em
 * cada resolver, para que services sigam sem saber que existe HTTP.
 */
const domainErrors = t.middleware(async ({ next }) => {
  const result = await next();

  if (!result.ok && result.error.cause instanceof DomainError) {
    const cause = result.error.cause;
    throw new TRPCError({
      code: DOMAIN_TO_TRPC[cause.code],
      message: cause.message,
      cause,
    });
  }

  return result;
});

export const publicProcedure = t.procedure.use(domainErrors);

export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Exige sessão **e** escola ativa, e injeta o `tenant` no contexto.
 *
 * Tudo que lê ou escreve dado de escola parte daqui: assim nenhum resolver
 * precisa (nem consegue) descobrir sozinho de qual escola é a requisição.
 */
export const schoolProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  const membership = await ctx.getMembership();

  if (!membership) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Nenhuma escola ativa para este usuário",
    });
  }

  return next({
    ctx: {
      ...ctx,
      tenant: { schoolId: membership.schoolId },
      membership,
    },
  });
});

type PermissionRequest = Parameters<(typeof roles)[AppRole]["authorize"]>[0];

/** Checagem de permissão sem ida ao banco: usa o papel já resolvido na sessão. */
export function can(role: AppRole, request: PermissionRequest): boolean {
  return roles[role].authorize(request).success;
}

/**
 * Procedure de escola que ainda exige uma permissão do RBAC.
 *
 * Uso: `permitted({ classroom: ["create"] }).input(...).mutation(...)`
 */
export function permitted(request: PermissionRequest) {
  return schoolProcedure.use(({ ctx, next }) => {
    if (!can(ctx.membership.role, request)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Seu papel não permite esta ação",
      });
    }
    return next();
  });
}
