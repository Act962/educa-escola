import { longDate, shortDate } from "@educa-escola/api/dates";
import { Badge } from "@educa-escola/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@educa-escola/ui/components/card";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
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
        <CardEyebrow>Chamada</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Registro de presença</h1>
        <p className="text-[13px] text-muted-foreground">
          {agenda.data ? longDate(agenda.data.date) : "Carregando…"}
        </p>
      </div>

      {atrasadas.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CardTitle>Em atraso</CardTitle>
              <CardDescription>Aulas que já aconteceram e continuam sem registro</CardDescription>
            </div>
            <CardAction>
              <Badge variant="danger">{atrasadas.length}</Badge>
            </CardAction>
          </CardHeader>
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
                  <Badge variant="danger">Exige justificativa</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Aulas de hoje</CardTitle>
        </CardHeader>

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
                    <Badge variant="success">Registrada</Badge>
                  ) : (
                    <Badge variant="warning">Pendente</Badge>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
