import { longDate } from "@educa-escola/api/dates";
import { BarComparison, ChartLegend } from "@educa-escola/ui/integra/bar-compare";
import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, PanelSkeleton } from "@educa-escola/ui/integra/states";
import { StatusBadge, type StatusTone } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, BookOpen, Clock, PenLine } from "lucide-react";

import type { CurrentUser } from "@/components/app-shell";
import { primeiroNome, saudacao } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

const ESTADO_DA_AULA: Record<string, { label: string; tone: StatusTone }> = {
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
        <Panel className="bg-accent">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <InitialsAvatar name={me.name} size="lg" className="bg-card" />
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
              <span className="w-fit rounded-full bg-card px-3 py-1 font-bold text-[13px] text-info">
                {me.schoolName}
              </span>
            </div>
          </div>
        </Panel>

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
          <StatCard icon={BookOpen} label="Chamadas pendentes hoje" tone="warning">
            {pendentesHoje}
          </StatCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader
              title="Aulas de hoje"
              hint={agenda.data ? longDate(agenda.data.date) : undefined}
            />

            {agenda.isLoading ? (
              <PanelSkeleton title="" rows={3} />
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
                      className={`flex flex-wrap items-center gap-3 rounded-field p-3 ${
                        pendente ? "bg-danger-soft" : "bg-muted"
                      }`}
                    >
                      <span className="flex w-14 flex-col text-center">
                        <span className="font-extrabold text-[13px]">{aula.startsAt}</span>
                        <span className="text-[11px] text-muted-foreground">{aula.endsAt}</span>
                      </span>
                      <span
                        className={`h-9 w-1 rounded-full ${pendente ? "bg-danger" : "bg-chart-1"}`}
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
                      <StatusBadge tone={estado?.tone}>{estado?.label}</StatusBadge>
                      <Link
                        to="/chamada/$lessonId"
                        params={{ lessonId: aula.id }}
                        className={`min-h-11 rounded-control px-4 py-2 font-bold text-[13px] focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 ${
                          pendente || aula.state === "em_andamento"
                            ? "bg-primary text-primary-foreground"
                            : "text-info hover:bg-accent"
                        }`}
                      >
                        {aula.attendanceRecordedAt ? "Abrir diário" : "Fazer chamada"}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader
              title="Média por turma"
              hint={`${term}º bimestre · comparado ao anterior`}
              action={<ChartLegend series={["Média da turma", "Bimestre anterior"]} />}
            />

            {painel.isLoading ? (
              <PanelSkeleton title="" rows={3} />
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
          </Panel>
        </div>

        <div className="flex flex-col gap-5">
          {atrasadas.length > 0 ? (
            <Panel>
              <PanelHeader title="Chamadas em atraso" />
              <ul className="flex flex-col gap-2">
                {atrasadas.slice(0, 4).map((aula) => (
                  <li key={aula.id} className="rounded-field bg-danger-soft p-3">
                    <Link
                      to="/chamada/$lessonId"
                      params={{ lessonId: aula.id }}
                      className="flex flex-col gap-0.5"
                    >
                      <span className="font-bold text-[11px] text-danger">
                        {aula.date.split("-").reverse().slice(0, 2).join("/")} · {aula.startsAt}
                      </span>
                      <span className="font-extrabold text-sm">
                        {aula.classroomName} · {aula.subjectName}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}

          <Panel>
            <PanelHeader
              title="Precisam de atenção"
              action={
                painel.data?.needsAttention.length ? (
                  <StatusBadge tone="danger">{painel.data.needsAttention.length}</StatusBadge>
                ) : null
              }
            />

            {painel.isLoading ? (
              <PanelSkeleton title="" rows={3} />
            ) : (painel.data?.needsAttention.length ?? 0) === 0 ? (
              <EmptyState
                title="Ninguém abaixo do mínimo"
                description="Nenhum aluno das suas turmas está abaixo dos 75% de frequência exigidos."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {(painel.data?.needsAttention ?? []).slice(0, 6).map((aluno) => (
                  <li key={aluno.studentId} className="flex items-center gap-3">
                    <InitialsAvatar name={aluno.name} tone="danger" size="sm" />
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
          </Panel>

          <Panel>
            <PanelHeader title="Minhas turmas" />
            <TurmasResumo />
          </Panel>
        </div>
      </div>
    </>
  );
}

function TurmasResumo() {
  const trpc = useTRPC();
  const turmas = useQuery(trpc.lesson.myClassrooms.queryOptions());

  if (turmas.isLoading) return <PanelSkeleton title="" rows={2} />;
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
