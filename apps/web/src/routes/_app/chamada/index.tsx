import { longDate, shortDate } from "@educa-escola/api/dates";
import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/chamada/")({
  component: Chamada,
});

/** Onde o professor entra para registrar: o atrasado primeiro, depois o dia. */
function Chamada() {
  const trpc = useTRPC();
  const agenda = useQuery(trpc.lesson.myAgenda.queryOptions());

  const aulas = agenda.data?.lessons ?? [];
  const atrasadas = agenda.data?.overdue ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>Chamada</Eyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Registro de presença</h1>
        <p className="text-[13px] text-muted-foreground">
          {agenda.data ? longDate(agenda.data.date) : "Carregando…"}
        </p>
      </div>

      {atrasadas.length > 0 ? (
        <Panel>
          <PanelHeader
            title="Em atraso"
            hint="Aulas que já aconteceram e continuam sem registro"
            action={<StatusBadge tone="danger">{atrasadas.length}</StatusBadge>}
          />
          <ul className="flex flex-col gap-2">
            {atrasadas.map((aula) => (
              <li key={aula.id}>
                <Link
                  to="/chamada/$lessonId"
                  params={{ lessonId: aula.id }}
                  className="flex flex-wrap items-center gap-3 rounded-field bg-danger-soft p-3 hover:bg-danger-soft/70"
                >
                  <span className="w-16 font-extrabold text-[13px] text-danger">
                    {shortDate(aula.date)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-extrabold text-sm">
                      {aula.classroomName} · {aula.subjectName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {aula.startsAt}–{aula.endsAt}
                      {aula.room ? ` · ${aula.room}` : ""}
                    </span>
                  </span>
                  <StatusBadge tone="danger">Exige justificativa</StatusBadge>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader title="Aulas de hoje" />

        {agenda.isLoading ? (
          <ListSkeleton rows={3} />
        ) : aulas.length === 0 ? (
          <EmptyState
            title="Nenhuma aula hoje"
            description="Sua grade não tem aula neste dia. Nada a registrar."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {aulas.map((aula) => (
              <li key={aula.id}>
                <Link
                  to="/chamada/$lessonId"
                  params={{ lessonId: aula.id }}
                  className="flex flex-wrap items-center gap-3 rounded-field bg-muted p-3 hover:bg-accent"
                >
                  <span className="flex w-14 flex-col text-center">
                    <span className="font-extrabold text-[13px]">{aula.startsAt}</span>
                    <span className="text-[11px] text-muted-foreground">{aula.endsAt}</span>
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-extrabold text-sm">
                      {aula.classroomName} · {aula.subjectName}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{aula.room ?? ""}</span>
                  </span>
                  {aula.attendanceRecordedAt ? (
                    <StatusBadge tone="success">Registrada</StatusBadge>
                  ) : (
                    <StatusBadge tone="warning">Pendente</StatusBadge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
