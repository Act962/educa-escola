import type { AppRouter } from "@educa-escola/api/routers/index";
import { Toaster } from "@educa-escola/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import type { TRPCOptionsProxy } from "@trpc/tanstack-react-query";

import { VLibras } from "@/components/vlibras";
import appCss from "../index.css?url";
export interface RouterAppContext {
  trpc: TRPCOptionsProxy<AppRouter>;
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Integra Edu",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  component: RootDocument,
});

function RootDocument() {
  return (
    // pt-BR: leitor de tela e hifenização dependem disso. Sem `dark`: os
    // mockups aprovados são o tema claro, e a paleta do Integra vive no :root.
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        {/* Tradutor de Libras. Carrega depois de tudo e não bloqueia nada:
            sem rede externa, o app segue exatamente como antes. */}
        <VLibras />
        <Toaster richColors />
        {/* As duas ferramentas de desenvolvimento no mesmo canto, à esquerda:
            o canto inferior direito é do Astro. Elas não existem em produção,
            mas disputar o pixel com o assistente atrapalharia o time todo dia
            — e esconderia justamente o que se quer conferir. */}
        <TanStackRouterDevtools position="bottom-left" />
        <ReactQueryDevtools position="bottom" buttonPosition="bottom-left" />
        <Scripts />
      </body>
    </html>
  );
}
