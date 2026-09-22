import type { AppRouter } from "@educa-escola/api/routers/index";
import type { inferRouterOutputs } from "@trpc/server";
import { createTRPCContext } from "@trpc/tanstack-react-query";

export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();

/**
 * Saídas das procedures, para tipar componente que recebe linha de lista.
 *
 * Evita redeclarar a forma do dado no componente — quando o router muda, a
 * tela quebra na compilação em vez de mentir em silêncio.
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;
