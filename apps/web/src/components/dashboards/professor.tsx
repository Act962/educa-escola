import { longDate, shortDate } from "@educa-escola/api/dates";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge, type BadgeTone } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@educa-escola/ui/components/card";
import { BarComparison, ChartLegend } from "@educa-escola/ui/integra/bar-compare";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { cn } from "@educa-escola/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ClipboardList, Clock, PenLine } from "lucide-react";

import type { CurrentUser } from "@/components/app-shell";
import { primeiroNome, saudacao } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

const ESTADO_DA_AULA: Record<string, { label: string; tone: BadgeTone }> = {
  registrada: { label: "Chamada registrada", tone: "success" },
  pendente: { label: "Chamada pendente", tone: "danger" },
  em_andamento: { label: "Em andamento", tone: "info" },
  a_seguir: { label: "A seguir", tone: "neutral" },
};

export function DashboardProfessor({ me }: { me: CurrentUser }) {
  const trpc = useTRPC();
  const { term } = useSchoolContext();

  const agenda = useQuery(trpc.lesson.myAgenda.queryOptions());
  const painel = useQuery(trpc.overview.professor.queryOptions({ term }));

  const aulas = agenda.data?.lessons ?? [];
  const atrasadas = agenda.data?.overdue ?? [];
  const pendentesHoje = aulas.filter((aula) => aula.state === "pendente").length;

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[1fr_auto]">
        <Card className="flex-row items-center gap-5 bg-accent">
          <Avatar size="lg" className="hidden sm:flex">
            <AvatarFallback className="bg-card">{initialsOf(me.name)}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col gap-2">
            <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
              {saudacao()}, {primeiroNome(me.name)}
            </h1>
            <p className="max-w-xl text-[13px] text-muted-foreground">
              Você tem <strong className="text-foreground">{aulas.length} aulas</strong> hoje
              {atrasadas.length > 0 ? (
                <>
                  {" e "}
                  <strong className="text-danger">
                    {atrasadas.length} chamada{atrasadas.length > 1 ? "s" : ""}
                  </strong>{" "}
                  em atraso
                </>
              ) : (
                " e nenhuma chamada em atraso"
              )}
              . {agenda.data ? longDate(agenda.data.date) : null}.
            </p>
            <Badge variant="info" className="w-fit bg-card">
              {me.schoolName}
            </Badge>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-4 xl:w-[26rem]">
          <StatCard icon={Clock} label="Aulas hoje" tone="info">
            {aulas.length}
          </StatCard>
          <StatCard
            icon={AlertTriangle}
            label={atrasadas.length === 1 ? "Chamada em atraso" : "Chamadas em atraso"}
            tone={atrasadas.length > 0 ? "danger" : "success"}
          >
            {atrasadas.length}
          </StatCard>
          <StatCard icon={PenLine} label="Notas a lançar" tone="neutral">
            {painel.data?.pendingGrades ?? 0}
          </StatCard>
          <StatCard icon={ClipboardList} label="Chamadas pendentes hoje" tone="warning">
            {pendentesHoje}
          </StatCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <CardTitle>Aulas de hoje</CardTitle>
                <CardDescription>{agenda.data ? longDate(agenda.data.date) : null}</CardDescription>
              </div>
              <CardAction>
                <Button variant="link" size="sm" render={<Link to="/chamada" />}>
                  Ver todas
                </Button>
              </CardAction>
            </CardHeader>

            {agenda.isLoading ? (
              <ListSkeleton rows={3} />
            ) : aulas.length === 0 ? (
              <EmptyState
                title="Nenhuma aula hoje"
                description="Não há aula na sua grade para este dia. As pendências anteriores continuam listadas ao lado."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {aulas.map((aula) => {
                  const estado = ESTADO_DA_AULA[aula.state] ?? ESTADO_DA_AULA.a_seguir;
                  const pendente = aula.state === "pendente";

                  return (
                    <li
                      key={aula.id}
                      className={cn(
                        "flex flex-wrap items-center gap-3 rounded-field p-3",
                        pendente ? "bg-danger-soft" : "bg-muted",
                      )}
                    >
                      <span className="flex w-14 flex-col text-center">
                        <span className="font-extrabold text-[13px]">{aula.startsAt}</span>
                        <span className="text-[11px] text-muted-foreground">{aula.endsAt}</span>
                      </span>
                      <span
                        className={cn(
                          "h-9 w-1 rounded-full",
                          pendente ? "bg-danger" : "bg-chart-1",
                        )}
                        aria-hidden
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-extrabold text-sm">
                          {aula.subjectName} · {aula.classroomName}
                        </span>
                        <span className="truncate text-[11px] text-muted-foreground">
                          {aula.room ? `${aula.room} · ` : ""}
                          {me.schoolName}
                        </span>
                      </span>
                      <Badge variant={estado?.tone}>{estado?.label}</Badge>
                      <Button
                        variant={pendente || aula.state === "em_andamento" ? "default" : "ghost"}
                        size="sm"
                        render={
                          <Link to="/chamada/$lessonId" params={{ lessonId: aula.id }}>
                            {aula.attendanceRecordedAt ? "Abrir diário" : "Fazer chamada"}
                          </Link>
                        }
                      />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <CardTitle>Média por turma</CardTitle>
                <CardDescription>{term}º bimestre · comparado ao anterior</CardDescription>
              </div>
              <CardAction>
                <ChartLegend series={["Média da turma", "Bimestre anterior"]} />
              </CardAction>
            </CardHeader>

            {painel.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (painel.data?.classroomAverages.length ?? 0) === 0 ? (
              <EmptyState
                title="Sem notas publicadas neste bimestre"
                description="O gráfico compara médias publicadas. Publique uma avaliação para ver a turma aqui."
              />
            ) : (
              <BarComparison
                series={["Média da turma", "Bimestre anterior"]}
                rows={(painel.data?.classroomAverages ?? []).map((turma) => ({
                  label: turma.classroomName,
                  value: turma.average,
                  reference: turma.previousAverage,
                  alert: turma.belowPassing,
                }))}
              />
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-5">
          {atrasadas.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Chamadas em atraso</CardTitle>
                <CardAction>
                  <Badge variant="danger">{atrasadas.length}</Badge>
                </CardAction>
              </CardHeader>
              <ul className="flex flex-col gap-2">
                {atrasadas.slice(0, 4).map((aula) => (
                  <li key={aula.id}>
                    <Link
                      to="/chamada/$lessonId"
                      params={{ lessonId: aula.id }}
                      className="flex flex-col gap-0.5 rounded-field bg-danger-soft p-3"
                    >
                      <span className="font-bold text-[11px] text-danger">
                        {shortDate(aula.date)} · {aula.startsAt}
                      </span>
                      <span className="font-extrabold text-sm">
                        {aula.classroomName} · {aula.subjectName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Precisam de atenção</CardTitle>
              {painel.data?.needsAttention.length ? (
                <CardAction>
                  <Badge variant="danger">{painel.data.needsAttention.length}</Badge>
                </CardAction>
              ) : null}
            </CardHeader>

            {painel.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (painel.data?.needsAttention.length ?? 0) === 0 ? (
              <EmptyState
                title="Ninguém abaixo do mínimo"
                description="Nenhum aluno das suas turmas está abaixo dos 75% de frequência exigidos."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {(painel.data?.needsAttention ?? []).slice(0, 6).map((aluno) => (
                  <li key={aluno.studentId} className="flex items-center gap-3">
                    <Avatar size="sm">
                      <AvatarFallback className="bg-danger-soft text-danger">
                        {initialsOf(aluno.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-extrabold text-[13px]">
                        {aluno.name} · {aluno.classroomName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{aluno.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Minhas turmas</CardTitle>
            </CardHeader>
            <TurmasResumo />
          </Card>
        </div>
      </div>
    </>
  );
}

function TurmasResumo() {
  const trpc = useTRPC();
  const turmas = useQuery(trpc.lesson.myClassrooms.queryOptions());

  if (turmas.isLoading) return <ListSkeleton rows={2} />;
  if (!turmas.data?.length) {
    return (
      <EmptyState
        title="Nenhuma turma vinculada"
        description="Você ainda não tem aula atribuída nesta escola."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {turmas.data.map((turma) => (
        <li key={`${turma.classroomId}-${turma.subjectId}`}>
          <Link
            to="/notas"
            search={{ turma: turma.classroomId }}
            className="flex items-center justify-between rounded-field bg-muted p-3 hover:bg-accent"
          >
            <span className="font-extrabold text-[13px]">{turma.classroomName}</span>
            <span className="text-[11px] text-muted-foreground">{turma.subjectName}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
