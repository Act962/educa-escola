import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarX, ClipboardCheck } from "lucide-react";

import { percentual } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/frequencia")({
  component: Frequencia,
});

/** Frequência do aluno, com o mínimo legal explicitado na própria tela. */
function Frequencia() {
  const trpc = useTRPC();
  const { term } = useSchoolContext();
  const painel = useQuery(trpc.overview.aluno.queryOptions({ term }));
  const ficha = useQuery(trpc.student.me.queryOptions());

  const frequencia = painel.data?.attendance;

  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>Frequência</Eyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Minha frequência</h1>
        <p className="text-[13px] text-muted-foreground">
          {ficha.data?.classroomName ?? "Sem turma"} · matrícula {ficha.data?.registration ?? "—"}
        </p>
      </div>

      {painel.isLoading ? (
        <Panel>
          <ListSkeleton rows={3} />
        </Panel>
      ) : !frequencia ? (
        <Panel>
          <EmptyState
            title="Sem aulas registradas"
            description="Nenhuma chamada foi registrada para a sua turma até agora."
          />
        </Panel>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={ClipboardCheck}
              label="Frequência acumulada"
              hint="mínimo de 75% das aulas dadas"
              tone={frequencia.belowMinimum ? "danger" : "success"}
            >
              {percentual(frequencia.rate)}
            </StatCard>
            <StatCard icon={CalendarX} label="Faltas registradas" tone="neutral">
              {frequencia.absences}
            </StatCard>
          </div>

          <Panel>
            <PanelHeader
              title="Situação"
              action={
                <StatusBadge tone={frequencia.belowMinimum ? "danger" : "success"}>
                  {frequencia.belowMinimum ? "Abaixo do mínimo" : "Dentro do mínimo"}
                </StatusBadge>
              }
            />
            <p className="text-[13px] text-muted-foreground">
              {frequencia.belowMinimum
                ? "Sua frequência está abaixo dos 75% exigidos pela LDB (art. 24, VI). Procure a coordenação para entender as opções de reposição."
                : "Sua frequência está acima do mínimo exigido pela LDB (art. 24, VI): 75% das aulas dadas."}{" "}
              Atrasos contam como presença.
            </p>
          </Panel>
        </>
      )}
    </>
  );
}
