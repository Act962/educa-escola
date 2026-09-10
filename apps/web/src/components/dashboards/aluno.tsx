import { longDate } from "@educa-escola/api/dates";
import { BarComparison, ChartLegend } from "@educa-escola/ui/integra/bar-compare";
import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, PanelSkeleton } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { BookOpen, CalendarCheck, ClipboardCheck } from "lucide-react";

import type { CurrentUser } from "@/components/app-shell";
import { nota, percentualCurto, primeiroNome, saudacao } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

/**
 * Painel do aluno.
 *
 * Duas regras moldam esta tela: nada de outro aluno (a comparação é contra a
 * média da turma, anônima) e nada de rascunho (só nota publicada chega aqui).
 */
export function DashboardAluno({ me }: { me: CurrentUser }) {
  const trpc = useTRPC();
  const { term } = useSchoolContext();

  const ficha = useQuery(trpc.student.me.queryOptions());
  const boletim = useQuery(trpc.assessment.myReportCard.queryOptions({ term }));
  const painel = useQuery(trpc.overview.aluno.queryOptions({ term }));

  const mediaDaTurma = new Map(
    (painel.data?.subjects ?? []).map((item) => [item.subjectId, item.classAverage]),
  );

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
                {ficha.data
                  ? `Você está no ${ficha.data.classroomName ?? "aguardando turma"}, matrícula ${ficha.data.registration}.`
                  : "Carregando sua matrícula…"}{" "}
                Aqui aparecem apenas as notas já publicadas pelos professores.
              </p>
              {ficha.data?.classroomName ? (
                <span className="w-fit rounded-full bg-card px-3 py-1 font-bold text-[13px] text-info">
                  {ficha.data.classroomName}
                </span>
              ) : null}
            </div>
          </div>
        </Panel>

        <div className="grid grid-cols-2 gap-4 xl:w-[26rem]">
          <StatCard
            icon={ClipboardCheck}
            label="Frequência no bimestre"
            tone={painel.data?.attendance?.belowMinimum ? "danger" : "success"}
          >
            {percentualCurto(painel.data?.attendance?.rate)}
          </StatCard>
          <StatCard icon={BookOpen} label="Média geral" tone="info">
            {nota(boletim.data?.overall)}
          </StatCard>
          <StatCard icon={CalendarCheck} label="Faltas registradas" tone="neutral">
            {painel.data?.attendance?.absences ?? 0}
          </StatCard>
          <StatCard icon={BookOpen} label="Disciplinas com nota" tone="neutral">
            {boletim.data?.subjects.length ?? 0}
          </StatCard>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader
            title="Desempenho por disciplina"
            hint={`${term}º bimestre`}
            action={<ChartLegend series={["Sua média", "Média da turma"]} />}
          />

          {boletim.isLoading ? (
            <PanelSkeleton title="" rows={4} />
          ) : (boletim.data?.subjects.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhuma nota publicada ainda"
              description="Assim que um professor publicar uma avaliação deste bimestre, ela aparece aqui."
            />
          ) : (
            <BarComparison
              series={["Sua média", "Média da turma"]}
              rows={(boletim.data?.subjects ?? []).map((disciplina) => ({
                label: disciplina.subjectName,
                value: disciplina.average,
                reference: mediaDaTurma.get(disciplina.subjectId) ?? null,
                alert: disciplina.situation !== "aprovado",
              }))}
            />
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader
              title="Últimas notas"
              action={
                <Link to="/boletim" className="font-bold text-[13px] text-info hover:underline">
                  Ver boletim
                </Link>
              }
            />

            {boletim.isLoading ? (
              <PanelSkeleton title="" rows={3} />
            ) : (boletim.data?.latest.length ?? 0) === 0 ? (
              <EmptyState
                title="Sem lançamentos"
                description="Nenhuma nota publicada neste bimestre."
              />
            ) : (
              <ul className="flex flex-col gap-3">
                {(boletim.data?.latest ?? []).map((linha) => (
                  <li key={linha.assessmentId} className="flex items-center gap-3">
                    <InitialsAvatar
                      name={linha.subjectName}
                      size="sm"
                      tone={linha.score < 6 ? "danger" : "neutral"}
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-extrabold text-[13px]">
                        {linha.subjectName}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        {linha.assessmentName} · peso {linha.weight}
                        {linha.appliedOn
                          ? ` · ${linha.appliedOn.split("-").reverse().slice(0, 2).join("/")}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`font-extrabold text-sm tabular-nums ${
                        linha.score < 6 ? "text-danger" : "text-foreground"
                      }`}
                    >
                      {nota(linha.score)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel>
            <PanelHeader title="Aulas de hoje" />
            <AulasDoDia />
          </Panel>
        </div>
      </div>
    </>
  );
}

function AulasDoDia() {
  const trpc = useTRPC();
  const agenda = useQuery(trpc.lesson.myClassAgenda.queryOptions());

  if (agenda.isLoading) return <PanelSkeleton title="" rows={3} />;

  const aulas = agenda.data?.lessons ?? [];
  if (aulas.length === 0) {
    return (
      <EmptyState
        title="Nenhuma aula hoje"
        description="Não há aula na grade da sua turma para este dia."
      />
    );
  }

  return (
    <>
      <p className="mb-3 text-[11px] text-muted-foreground">
        {agenda.data?.date ? longDate(agenda.data.date) : null}
      </p>
      <ul className="flex flex-col gap-2">
        {aulas.map((aula) => (
          <li
            key={aula.id}
            className={`flex items-center gap-3 rounded-field p-3 ${
              aula.state === "em_andamento" ? "bg-accent" : "bg-muted"
            }`}
          >
            <span className="flex w-12 flex-col text-center">
              <span className="font-extrabold text-[13px]">{aula.startsAt}</span>
              <span className="text-[11px] text-muted-foreground">{aula.endsAt}</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-extrabold text-[13px]">{aula.subjectName}</span>
              <span className="truncate text-[11px] text-muted-foreground">
                Prof. {aula.teacherName}
                {aula.room ? ` · ${aula.room}` : ""}
              </span>
            </span>
            {aula.state === "em_andamento" ? <StatusBadge tone="info">Agora</StatusBadge> : null}
          </li>
        ))}
      </ul>
    </>
  );
}
