import { shortDate } from "@educa-escola/api/dates";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@educa-escola/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@educa-escola/ui/components/tabs";
import { GradeCell } from "@educa-escola/ui/integra/grade-cell";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { cn } from "@educa-escola/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Upload } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { nota, situacaoNota } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/notas")({
  component: Notas,
  validateSearch: (search: Record<string, unknown>) => ({
    turma: typeof search.turma === "string" ? search.turma : undefined,
  }),
});

/**
 * Grade de lançamento: alunos nas linhas, avaliações nas colunas.
 *
 * Rascunho e publicado são visualmente distintos porque a diferença é real —
 * o aluno enxerga um e não enxerga o outro. Célula de avaliação publicada abre
 * travada; a em rascunho é editável e a vazia obrigatória vem tracejada.
 */
function Notas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { term } = useSchoolContext();
  const { turma: turmaDaUrl } = Route.useSearch();

  const turmas = useQuery(trpc.lesson.myClassrooms.queryOptions());
  const [selecionada, setSelecionada] = useState<string | undefined>(turmaDaUrl);

  const atual =
    turmas.data?.find((item) => item.classroomId === (selecionada ?? turmaDaUrl)) ??
    turmas.data?.[0];

  const grade = useQuery({
    ...trpc.assessment.grid.queryOptions({
      classroomId: atual?.classroomId ?? "",
      subjectId: atual?.subjectId ?? "",
      term,
    }),
    enabled: Boolean(atual),
  });

  const [rascunho, setRascunho] = useState<Record<string, number | null>>({});
  const [filtro, setFiltro] = useState<"todos" | "pendentes">("todos");

  const salvar = useMutation(
    trpc.assessment.saveGrades.mutationOptions({
      onSuccess: () => {
        toast.success("Rascunho salvo. O aluno ainda não enxerga estas notas.");
        setRascunho({});
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  const publicar = useMutation(
    trpc.assessment.publish.mutationOptions({
      onSuccess: () => {
        toast.success("Notas publicadas. Já aparecem no boletim do aluno.");
        queryClient.invalidateQueries();
      },
      onError: (erro) => toast.error(erro.message),
    }),
  );

  if (turmas.error || grade.error) {
    const erro = turmas.error ?? grade.error;
    return (
      <Card>
        {erro?.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não lança notas"
            description="O lançamento é do professor da turma. Peça acesso à coordenação se precisar dele."
          />
        ) : (
          <EmptyState title="Não foi possível carregar" description={erro?.message ?? ""} />
        )}
      </Card>
    );
  }

  const emRascunho = grade.data?.assessments.find((item) => item.status === "rascunho");
  const linhas = grade.data?.rows ?? [];
  const linhasPendentes = linhas.filter((linha) => linha.missing > 0);
  const visiveis = filtro === "pendentes" ? linhasPendentes : linhas;

  const guardar = (assessmentId: string, studentId: string, valor: number | null) =>
    setRascunho((atualState) => ({ ...atualState, [`${assessmentId}:${studentId}`]: valor }));

  const salvarRascunho = () => {
    if (!emRascunho) return;
    const entradas = Object.entries(rascunho)
      .filter(([chave]) => chave.startsWith(`${emRascunho.id}:`))
      .map(([chave, score]) => ({ studentId: chave.split(":")[1] as string, score }));

    if (entradas.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }
    salvar.mutate({ assessmentId: emRascunho.id, entries: entradas });
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardEyebrow>Notas e avaliações</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
            Lançamento de notas{atual ? ` — ${atual.classroomName}` : ""}
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {term}º bimestre
            {grade.data ? ` · ${grade.data.rows.length} alunos` : ""}
            {atual ? ` · ${atual.subjectName}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={(turmas.data ?? []).map((item) => ({
              value: item.classroomId,
              label: `${item.classroomName} · ${item.subjectName}`,
            }))}
            value={atual?.classroomId ?? ""}
            onValueChange={(value) => setSelecionada(value ?? undefined)}
          >
            <SelectTrigger aria-label="Turma" className="bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(turmas.data ?? []).map((item) => (
                <SelectItem key={item.classroomId} value={item.classroomId}>
                  {item.classroomName} · {item.subjectName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            onClick={salvarRascunho}
            disabled={!emRascunho || salvar.isPending}
          >
            {salvar.isPending ? "Salvando…" : "Salvar rascunho"}
          </Button>

          <Button
            onClick={() => emRascunho && publicar.mutate({ id: emRascunho.id })}
            disabled={!emRascunho || publicar.isPending}
          >
            <Upload strokeWidth={1.7} aria-hidden />
            {publicar.isPending ? "Publicando…" : "Publicar notas"}
          </Button>
        </div>
      </div>

      {grade.data && grade.data.pendingCount > 0 ? (
        <Alert variant="warning">
          <AlertTriangle strokeWidth={1.7} aria-hidden />
          <AlertTitle>
            {grade.data.pendingCount} lançamento(s) pendente(s) neste bimestre
          </AlertTitle>
          <AlertDescription>
            O bimestre não pode ser fechado, e a avaliação não pode ser publicada, com nota
            faltando.
          </AlertDescription>
        </Alert>
      ) : null}

      {grade.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {grade.data.assessments.map((avaliacao) => (
            <Card key={avaliacao.id} size="sm" className="gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm">{avaliacao.name}</span>
                <Badge variant={avaliacao.status === "publicada" ? "success" : "warning"}>
                  {avaliacao.status === "publicada" ? "Publicada" : "Rascunho"}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Peso {avaliacao.weight}
                {avaliacao.appliedOn ? ` · aplicada em ${shortDate(avaliacao.appliedOn)}` : ""}
              </span>
            </Card>
          ))}
          <Card size="sm" className="gap-1">
            <CardEyebrow>Média da turma</CardEyebrow>
            <span className="font-extrabold text-2xl tracking-[-0.6px]">
              {nota(grade.data.classAverage)}
            </span>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <CardTitle>Grade de notas</CardTitle>
            <CardDescription>
              {emRascunho
                ? `${emRascunho.name} em rascunho — médias e situações são parciais e ainda não aparecem para o aluno.`
                : "Todas as avaliações deste bimestre estão publicadas."}
            </CardDescription>
          </div>
          <CardAction>
            {/* Numa turma de 30, achar quem falta lançar rolando a lista é o
                que faz o professor desistir no meio. */}
            <Tabs value={filtro} onValueChange={(value) => setFiltro(value as typeof filtro)}>
              <TabsList>
                <TabsTrigger value="todos">Todos os alunos</TabsTrigger>
                <TabsTrigger value="pendentes">
                  Somente sem nota
                  {grade.data?.pendingCount ? ` (${linhasPendentes.length})` : ""}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardAction>
        </CardHeader>

        {grade.isLoading ? (
          <ListSkeleton rows={6} />
        ) : visiveis.length === 0 ? (
          <EmptyState
            title={filtro === "pendentes" ? "Nada pendente" : "Nenhum aluno nesta turma"}
            description={
              filtro === "pendentes"
                ? "Todos os alunos desta turma já têm nota em todas as avaliações do bimestre."
                : "Aloque matrículas na turma para lançar notas."
            }
          />
        ) : (
          <Table className="min-w-[48rem]">
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                {(grade.data?.assessments ?? []).map((avaliacao) => (
                  <TableHead key={avaliacao.id} className="text-center">
                    {avaliacao.name} · P{avaliacao.weight}
                  </TableHead>
                ))}
                <TableHead className="text-center">Média parcial</TableHead>
                <TableHead className="text-right">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visiveis.map((linha) => {
                const situacao = situacaoNota(linha.situation);
                const faltando = linha.missing > 0;

                return (
                  <TableRow key={linha.studentId} className={faltando ? "bg-warning-soft" : ""}>
                    <TableCell className="py-2">
                      <span className="flex items-center gap-3">
                        <Avatar size="sm">
                          <AvatarFallback
                            className={cn(faltando && "bg-warning-soft text-warning")}
                          >
                            {initialsOf(linha.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="flex flex-col">
                          <span className="font-extrabold">{linha.name}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {linha.registration}
                          </span>
                        </span>
                      </span>
                    </TableCell>

                    {(grade.data?.assessments ?? []).map((avaliacao, coluna) => {
                      const chave = `${avaliacao.id}:${linha.studentId}`;
                      const valor =
                        chave in rascunho ? rascunho[chave] : (linha.scores[coluna] ?? null);
                      const travada = avaliacao.status === "publicada";

                      return (
                        <TableCell key={avaliacao.id} className="px-1 py-2 text-center">
                          <GradeCell
                            label={`${avaliacao.name} de ${linha.name}`}
                            value={valor ?? null}
                            locked={travada}
                            required={!travada}
                            onChange={
                              travada
                                ? undefined
                                : (novo) => guardar(avaliacao.id, linha.studentId, novo)
                            }
                          />
                        </TableCell>
                      );
                    })}

                    <TableCell className="text-center font-extrabold text-sm tabular-nums">
                      {nota(linha.average)}
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
    </>
  );
}
