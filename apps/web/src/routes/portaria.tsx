import { Card } from "@educa-escola/ui/components/card";
import { PermissionState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

import { GateKiosk } from "@/components/gate-kiosk";
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
/**
 * O sentido é do portão, e vem da URL.
 *
 * `/portaria?sentido=entrada` e `/portaria?sentido=saida` são dois quiosques —
 * duas câmeras, cada uma no seu portão. Sem o parâmetro, o servidor alterna a
 * partir da última passagem do dia, que serve para escola com uma câmera só.
 */
const busca = z.object({
  sentido: z.enum(["entrada", "saida"]).optional(),
});

export const Route = createFileRoute("/portaria")({
  component: Portaria,
  validateSearch: busca,
  beforeLoad: async () => {
    const session = await getUser();
    if (!session) throw redirect({ to: "/login" });
    return { session };
  },
});

function Portaria() {
  const { sentido } = Route.useSearch();
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

  return <GateKiosk deviceLabel={me.data.schoolName ?? "Portaria"} sentido={sentido} />;
}
