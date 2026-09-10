import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, PanelSkeleton } from "@educa-escola/ui/integra/states";
import { StatusBadge, type StatusTone } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardCheck, GraduationCap, LayoutGrid, Users } from "lucide-react";

import { inteiro, percentual, percentualCurto } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

/**
 * Situação de um professor no fechamento.
 *
 * O limiar é grosso de propósito: a direção quer saber em quem cobrar, não a
 * contagem exata. Quem tem chamada em aberto vem antes de quem só deve nota,
 * porque frequência tem prazo legal.
 */
function situacaoDoLancamento(pendingCalls: number, pendingGrades: number) {
  if (pendingCalls === 0 && pendingGrades === 0) {
    return { label: "Concluído", tone: "success" as StatusTone, row: "" };
  }
  if (pendingCalls >= 3) {
    return { label: "Atrasado", tone: "danger" as StatusTone, row: "bg-danger-soft" };
  }
  if (pendingCalls > 0) {
    return { label: "Atenção", tone: "warning" as StatusTone, row: "bg-warning-soft" };
  }
  return { label: "Em dia", tone: "success" as StatusTone, row: "" };
}

export function DashboardGestao() {
  const trpc = useTRPC();
  const { term } = useSchoolContext();
  const painel = useQuery(trpc.overview.gestao.queryOptions({ term }));

  const dados = painel.data;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={GraduationCap}
          label="Alunos ativos"
          hint={dados ? `${dados.students.pendingDocuments} com documentação pendente` : undefined}
          tone="info"
        >
          {dados ? inteiro(dados.students.active) : "—"}
        </StatCard>
        <StatCard icon={LayoutGrid} label="Turmas" tone="neutral">
          {dados ? inteiro(dados.classrooms) : "—"}
        </StatCard>
        <StatCard icon={Users} label="Professores" tone="neutral">
          {dados ? inteiro(dados.teachers) : "—"}
        </StatCard>
        <StatCard
          icon={ClipboardCheck}
          label="Frequência média"
          hint={dados ? `mínimo de ${percentualCurto(dados.minimumAttendanceRate)}` : undefined}
          tone={
            dados?.attendanceRate && dados.attendanceRate < dados.minimumAttendanceRate
              ? "danger"
              : "success"
          }
        >
          {dados ? percentual(dados.attendanceRate) : "—"}
        </StatCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_22rem]">
        <Panel>
          <PanelHeader
            title="Pendências de lançamento"
            hint={`${term}º bimestre`}
            action={
              <Link
                to="/alunos"
                search={{ busca: undefined }}
                className="font-bold text-[13px] text-info hover:underline"
              >
                Ver alunos
              </Link>
            }
          />

          {painel.isLoading ? (
            <PanelSkeleton title="" rows={4} />
          ) : (dados?.pending.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhuma pendência"
              description="Todas as chamadas do ano letivo estão registradas. Nada bloqueia o fechamento do bimestre."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse">
                <thead>
                  <tr className="text-left">
                    <th scope="col" className="pb-2">
                      <Eyebrow>Professor</Eyebrow>
                    </th>
                    <th scope="col" className="pb-2 text-center">
                      <Eyebrow>Chamadas</Eyebrow>
                    </th>
                    <th scope="col" className="pb-2 text-center">
                      <Eyebrow>Notas</Eyebrow>
                    </th>
                    <th scope="col" className="pb-2 text-right">
                      <Eyebrow>Situação</Eyebrow>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(dados?.pending ?? []).map((linha) => {
                    const situacao = situacaoDoLancamento(linha.pendingCalls, linha.pendingGrades);
                    return (
                      <tr key={linha.teacherId} className={situacao.row}>
                        <td className="rounded-l-field py-3 pl-3">
                          <span className="flex items-center gap-3">
                            <InitialsAvatar name={linha.teacherName} size="sm" tone="neutral" />
                            <span className="font-extrabold text-[13px]">{linha.teacherName}</span>
                          </span>
                        </td>
                        <td className="text-center font-extrabold text-[13px] tabular-nums">
                          {linha.pendingCalls}
                        </td>
                        <td className="text-center font-extrabold text-[13px] tabular-nums">
                          {linha.pendingGrades}
                        </td>
                        <td className="rounded-r-field py-3 pr-3 text-right">
                          <StatusBadge tone={situacao.tone}>{situacao.label}</StatusBadge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="flex flex-col gap-5">
          <Panel>
            <PanelHeader
              title="Alunos em risco"
              action={
                dados?.risk.total ? (
                  <StatusBadge tone="danger">{dados.risk.total}</StatusBadge>
                ) : null
              }
            />

            {painel.isLoading ? (
              <PanelSkeleton title="" rows={2} />
            ) : (
              <ul className="flex flex-col gap-3">
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[13px]">Frequência abaixo do mínimo</span>
                  <span className="font-extrabold text-danger text-sm tabular-nums">
                    {dados?.risk.belowAttendance ?? 0}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[13px]">Média abaixo de 6,0</span>
                  <span className="font-extrabold text-sm text-warning tabular-nums">
                    {dados?.risk.belowAverage ?? 0}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3">
                  <span className="text-[13px]">Documentação pendente</span>
                  <span className="font-extrabold text-muted-foreground text-sm tabular-nums">
                    {dados?.students.pendingDocuments ?? 0}
                  </span>
                </li>
              </ul>
            )}

            <p className="mt-4 text-[11px] text-muted-foreground">
              Um aluno pode aparecer em mais de um critério. A frequência mínima segue a LDB: 75%
              das aulas dadas.
            </p>
          </Panel>

          <Panel>
            <PanelHeader title="O que já está no ar" />
            <ul className="flex flex-col gap-2 text-[13px]">
              <li className="rounded-field bg-muted p-3">
                <strong className="font-extrabold">Chamada e diário de aula</strong>
                <p className="text-[11px] text-muted-foreground">
                  Registro por aula, com prazo e justificativa fora do prazo.
                </p>
              </li>
              <li className="rounded-field bg-muted p-3">
                <strong className="font-extrabold">Notas com rascunho e publicação</strong>
                <p className="text-[11px] text-muted-foreground">
                  O aluno só enxerga o que foi publicado, e publicar exige todas as notas lançadas.
                </p>
              </li>
              <li className="rounded-field bg-muted p-3">
                <strong className="font-extrabold">Boletim do aluno com a conta aberta</strong>
                <p className="text-[11px] text-muted-foreground">
                  Cada avaliação, seu peso e a média resultante.
                </p>
              </li>
            </ul>
          </Panel>
        </div>
      </div>
    </>
  );
}
