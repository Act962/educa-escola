import { GradeCell } from "@educa-escola/ui/integra/grade-cell";
import { InitialsAvatar } from "@educa-escola/ui/integra/initials-avatar";
import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
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
 * o aluno enxerga um e não enxerga o outro. Célula de avaliação publicada
 * abre travada; a em rascunho é editável e a vazia obrigatória vem tracejada.
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
      <Panel>
        {erro?.data?.code === "FORBIDDEN" ? (
          <PermissionState
            title="Seu perfil não lança notas"
            description="O lançamento é do professor da turma. Peça acesso à coordenação se precisar dele."
          />
        ) : (
          <EmptyState title="Não foi possível carregar" description={erro?.message ?? ""} />
        )}
      </Panel>
    );
  }

  const emRascunho = grade.data?.assessments.find((item) => item.status === "rascunho");

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
          <Eyebrow>Notas e avaliações</Eyebrow>
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
          <label className="sr-only" htmlFor="turma">
            Turma
          </label>
          <select
            id="turma"
            value={atual?.classroomId ?? ""}
            onChange={(event) => setSelecionada(event.target.value)}
            className="min-h-11 rounded-control bg-card px-3 font-bold text-[13px]"
          >
            {(turmas.data ?? []).map((item) => (
              <option key={item.classroomId} value={item.classroomId}>
                {item.classroomName} · {item.subjectName}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={salvarRascunho}
            disabled={!emRascunho || salvar.isPending}
            className="min-h-11 rounded-control bg-card px-4 font-bold text-[13px] disabled:opacity-50"
          >
            {salvar.isPending ? "Salvando…" : "Salvar rascunho"}
          </button>

          <button
            type="button"
            onClick={() => emRascunho && publicar.mutate({ id: emRascunho.id })}
            disabled={!emRascunho || publicar.isPending}
            className="flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 font-bold text-[13px] text-primary-foreground disabled:opacity-50"
          >
            <Upload size={18} strokeWidth={1.7} aria-hidden />
            {publicar.isPending ? "Publicando…" : "Publicar notas"}
          </button>
        </div>
      </div>

      {grade.data && grade.data.pendingCount > 0 ? (
        <p className="flex items-center gap-2 rounded-card bg-warning-soft px-6 py-4 text-[13px] text-warning">
          <AlertTriangle size={18} strokeWidth={1.7} aria-hidden />
          <span>
            <strong>{grade.data.pendingCount} lançamento(s) pendente(s)</strong> neste bimestre. O
            bimestre não pode ser fechado, e a avaliação não pode ser publicada, com nota faltando.
          </span>
        </p>
      ) : null}

      {grade.data ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {grade.data.assessments.map((avaliacao) => (
            <Panel key={avaliacao.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-sm">{avaliacao.name}</span>
                <StatusBadge tone={avaliacao.status === "publicada" ? "success" : "warning"}>
                  {avaliacao.status === "publicada" ? "Publicada" : "Rascunho"}
                </StatusBadge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Peso {avaliacao.weight}
                {avaliacao.appliedOn
                  ? ` · aplicada em ${avaliacao.appliedOn.split("-").reverse().slice(0, 2).join("/")}`
                  : ""}
              </span>
            </Panel>
          ))}
          <Panel className="flex flex-col gap-1">
            <Eyebrow>Média da turma</Eyebrow>
            <span className="font-extrabold text-2xl tracking-[-0.6px]">
              {nota(grade.data.classAverage)}
            </span>
          </Panel>
        </div>
      ) : null}

      <Panel>
        <PanelHeader
          title="Grade de notas"
          hint={
            emRascunho
              ? `${emRascunho.name} em rascunho — médias e situações são parciais e ainda não aparecem para o aluno.`
              : "Todas as avaliações deste bimestre estão publicadas."
          }
        />

        {grade.isLoading ? (
          <ListSkeleton rows={6} />
        ) : (grade.data?.rows.length ?? 0) === 0 ? (
          <EmptyState
            title="Nenhum aluno nesta turma"
            description="Aloque matrículas na turma para lançar notas."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[48rem] border-collapse">
              <thead>
                <tr className="text-left">
                  <th scope="col" className="pb-2 pl-3">
                    <Eyebrow>Aluno</Eyebrow>
                  </th>
                  {(grade.data?.assessments ?? []).map((avaliacao) => (
                    <th key={avaliacao.id} scope="col" className="pb-2 text-center">
                      <Eyebrow>
                        {avaliacao.name} · P{avaliacao.weight}
                      </Eyebrow>
                    </th>
                  ))}
                  <th scope="col" className="pb-2 text-center">
                    <Eyebrow>Média parcial</Eyebrow>
                  </th>
                  <th scope="col" className="pr-3 pb-2 text-right">
                    <Eyebrow>Situação</Eyebrow>
                  </th>
                </tr>
              </thead>
              <tbody>
                {(grade.data?.rows ?? []).map((linha) => {
                  const situacao = situacaoNota(linha.situation);
                  const faltando = linha.missing > 0;

                  return (
                    <tr key={linha.studentId} className={faltando ? "bg-warning-soft" : undefined}>
                      <td className="rounded-l-field py-2 pl-3">
                        <span className="flex items-center gap-3">
                          <InitialsAvatar
                            name={linha.name}
                            size="sm"
                            tone={faltando ? "warning" : "info"}
                          />
                          <span className="flex flex-col">
                            <span className="font-extrabold text-[13px]">{linha.name}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {linha.registration}
                            </span>
                          </span>
                        </span>
                      </td>

                      {(grade.data?.assessments ?? []).map((avaliacao, coluna) => {
                        const chave = `${avaliacao.id}:${linha.studentId}`;
                        const valor =
                          chave in rascunho ? rascunho[chave] : (linha.scores[coluna] ?? null);
                        const travada = avaliacao.status === "publicada";

                        return (
                          <td key={avaliacao.id} className="px-1 py-2 text-center">
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
                          </td>
                        );
                      })}

                      <td className="text-center font-extrabold text-sm tabular-nums">
                        {nota(linha.average)}
                      </td>
                      <td className="rounded-r-field py-2 pr-3 text-right">
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
    </>
  );
}
