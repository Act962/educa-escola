import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { DashboardAluno } from "@/components/dashboards/aluno";
import { DashboardGestao } from "@/components/dashboards/gestao";
import { DashboardProfessor } from "@/components/dashboards/professor";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/inicio")({
  component: Inicio,
});

/**
 * A mesma rota serve os três perfis.
 *
 * O papel decide o painel, e vem do servidor: o dashboard da direção nunca é
 * montado para um aluno, então nem as consultas dele saem do navegador.
 */
function Inicio() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.queryOptions());

  if (!me.data) return null;

  if (me.data.role === "teacher") return <DashboardProfessor me={me.data} />;
  if (me.data.role === "student") return <DashboardAluno me={me.data} />;
  return <DashboardGestao />;
}
