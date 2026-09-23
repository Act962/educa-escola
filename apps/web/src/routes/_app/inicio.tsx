import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ManagementDashboard } from "@/components/dashboards/management";
import { StudentDashboard } from "@/components/dashboards/student";
import { TeacherDashboard } from "@/components/dashboards/teacher";
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

  if (me.data.role === "teacher") return <TeacherDashboard me={me.data} />;
  if (me.data.role === "student") return <StudentDashboard me={me.data} />;
  return <ManagementDashboard />;
}
