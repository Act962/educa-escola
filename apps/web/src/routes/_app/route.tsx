import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app-shell";
import { getUser } from "@/functions/get-user";
import { SchoolProvider } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
});

function AppLayout() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.queryOptions());
  const agenda = useQuery({
    ...trpc.lesson.myAgenda.queryOptions(),
    // Só o professor tem agenda própria; para os outros o servidor devolveria
    // uma lista vazia, e pedir isso em toda tela seria consulta à toa.
    enabled: me.data?.role === "teacher",
  });

  if (me.isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-background">
        <p className="text-[13px] text-muted-foreground">Carregando sua escola…</p>
      </div>
    );
  }

  if (!me.data) {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6">
        <div className="max-w-md rounded-card bg-card p-6 text-center">
          <p className="font-extrabold text-base tracking-[-0.2px]">Sem vínculo ativo</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Sua conta não está vinculada a nenhuma escola. Fale com a secretaria para liberar o
            acesso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <SchoolProvider year={new Date().getFullYear()}>
      <AppShell me={me.data} pendingCalls={agenda.data?.overdue.length}>
        <Outlet />
      </AppShell>
    </SchoolProvider>
  );
}
