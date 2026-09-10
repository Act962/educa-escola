import { createFileRoute, redirect } from "@tanstack/react-router";

import { getUser } from "@/functions/get-user";

/**
 * A raiz não tem tela: manda para o app ou para a entrada.
 *
 * A decisão acontece no servidor, antes de renderizar, para o navegador nunca
 * piscar uma tela que a pessoa não deveria ver.
 */
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const session = await getUser();
    throw redirect({ to: session ? "/inicio" : "/login" });
  },
});
