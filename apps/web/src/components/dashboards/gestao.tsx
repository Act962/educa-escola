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
import { Progress, ProgressLabel, ProgressValue } from "@educa-escola/ui/components/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
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
    return { label: "Concluído", tone: "success" as BadgeTone, row: "" };
  }
  if (pendingCalls >= 3) {
    return { label: "Atrasado", tone: "danger" as BadgeTone, row: "bg-danger-soft" };
  }
  if (pendingCalls > 0) {
    return { label: "Atenção", tone: "warning" as BadgeTone, row: "bg-warning-soft" };
  }
  return { label: "Em dia", tone: "success" as BadgeTone, row: "" };
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
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <CardTitle>Pendências de lançamento</CardTitle>
              <CardDescription>{term}º bimestre</CardDescription>
            </div>
            <CardAction>
              <Button
                variant="link"
                size="sm"
                render={
                  <Link to="/alunos" search={{ busca: undefined }}>
                    Ver alunos
                  </Link>
                }
              />
            </CardAction>
          </CardHeader>

          {painel.isLoading ? (
            <ListSkeleton rows={4} />
          ) : (dados?.pending.length ?? 0) === 0 ? (
            <EmptyState
              title="Nenhuma pendência"
              description="Todas as chamadas do ano letivo estão registradas. Nada bloqueia o fechamento do bimestre."
            />
          ) : (
            <Table className="min-w-[34rem]">
              <TableHeader>
                <TableRow>
                  <TableHead>Professor</TableHead>
                  <TableHead className="text-center">Chamadas</TableHead>
                  <TableHead className="text-center">Notas</TableHead>
                  <TableHead className="text-right">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(dados?.pending ?? []).map((linha) => {
                  const situacao = situacaoDoLancamento(linha.pendingCalls, linha.pendingGrades);
                  return (
                    <TableRow key={linha.teacherId} className={situacao.row}>
                      <TableCell>
                        <span className="flex items-center gap-3">
                          <Avatar size="sm">
                            <AvatarFallback className="bg-secondary text-secondary-foreground">
                              {initialsOf(linha.teacherName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-extrabold">{linha.teacherName}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-center font-extrabold tabular-nums">
                        {linha.pendingCalls}
                      </TableCell>
                      <TableCell className="text-center font-extrabold tabular-nums">
                        {linha.pendingGrades}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={situacao.tone}>{situacao.label}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Alunos em risco</CardTitle>
              {dados?.risk.total ? (
                <CardAction>
                  <Badge variant="danger">{dados.risk.total}</Badge>
                </CardAction>
              ) : null}
            </CardHeader>

            {painel.isLoading ? (
              <ListSkeleton rows={3} />
            ) : (
              <div className="flex flex-col gap-4">
                <Progress
                  value={dados?.risk.belowAttendance ?? 0}
                  max={Math.max(dados?.students.active ?? 1, 1)}
                >
                  <ProgressLabel>Frequência abaixo do mínimo</ProgressLabel>
                  <ProgressValue className="text-danger">
                    {() => dados?.risk.belowAttendance ?? 0}
                  </ProgressValue>
                </Progress>
                <Progress
                  value={dados?.risk.belowAverage ?? 0}
                  max={Math.max(dados?.students.active ?? 1, 1)}
                >
                  <ProgressLabel>Média abaixo de 6,0</ProgressLabel>
                  <ProgressValue className="text-warning">
                    {() => dados?.risk.belowAverage ?? 0}
                  </ProgressValue>
                </Progress>
                <Progress
                  value={dados?.students.pendingDocuments ?? 0}
                  max={Math.max(dados?.students.active ?? 1, 1)}
                >
                  <ProgressLabel>Documentação pendente</ProgressLabel>
                  <ProgressValue className="text-muted-foreground">
                    {() => dados?.students.pendingDocuments ?? 0}
                  </ProgressValue>
                </Progress>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Um aluno pode aparecer em mais de um critério. A frequência mínima segue a LDB: 75%
              das aulas dadas.
            </p>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>O que já está no ar</CardTitle>
            </CardHeader>
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
          </Card>
        </div>
      </div>
    </>
  );
}
