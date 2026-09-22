import { Card } from "@educa-escola/ui/components/card";
import { PermissionState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";

import { PortariaQuiosque } from "@/components/portaria-quiosque";
import { getUser } from "@/functions/get-user";
import { useTRPC } from "@/utils/trpc";

/**
 * A portaria, fora do `_app`.
 *
 * Sem barra lateral, sem barra de contexto, sem menu: o tablet do portão fica
 * horas na mesma tela e qualquer navegação ali é caminho para alguém sair do
 * quiosque e entrar no sistema da escola. O que se vê é a câmera, o cartão de
 * quem passou e a caixa da carteirinha.
 */
export const Route = createFileRoute("/portaria")({
  component: Portaria,
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
});

function Portaria() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.queryOptions());

  if (me.isLoading) {
    return (
      <div className="grid min-h-svh place-items-center bg-kiosk">
        <p className="text-card text-kiosk-foreground/70">Abrindo a portaria…</p>
      </div>
    );
  }

  /*
   * O quiosque é da direção e da secretaria. Esconder aqui é conforto — quem
   * segura de verdade é o `permitted({ gate: ["operate"] })` de cada procedure.
   */
  if (me.data?.role !== "owner" && me.data?.role !== "admin") {
    return (
      <div className="grid min-h-svh place-items-center bg-background p-6">
        <Card className="max-w-md">
          <PermissionState
            title="A portaria é da secretaria"
            description="Peça a alguém da direção ou da secretaria para deixar o quiosque aberto neste tablet."
          />
        </Card>
      </div>
    );
  }

  return <PortariaQuiosque deviceLabel={me.data.schoolName ?? "Portaria"} />;
}
