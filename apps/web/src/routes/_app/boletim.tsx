import { shortDate } from "@educa-escola/api/dates";
import { Badge } from "@educa-escola/ui/components/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardEyebrow,
  CardHeader,
  CardTitle,
} from "@educa-escola/ui/components/card";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { cn } from "@educa-escola/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { nota, situacaoNota } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/boletim")({
  component: Boletim,
});

/**
 * Boletim do aluno, com a conta aberta.
 *
 * "Como sua média foi calculada" é requisito, não enfeite: cada avaliação, seu
 * peso e o resultado ficam visíveis. Nota em rascunho não chega aqui — o
 * filtro é feito na consulta, não escondendo na tela.
 */
function Boletim() {
  const trpc = useTRPC();
  const { term } = useSchoolContext();
  const boletim = useQuery(trpc.assessment.myReportCard.queryOptions({ term }));

  if (boletim.error) {
    return (
      <Card>
        <PermissionState
          title="Boletim indisponível"
          description="Esta tela é do aluno. Se você é responsável ou professor, o acesso ao boletim vem por outro caminho."
        />
      </Card>
    );
  }

  const disciplinas = boletim.data?.subjects ?? [];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardEyebrow>Minhas notas</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Boletim</h1>
          <p className="text-[13px] text-muted-foreground">
            {term}º bimestre · apenas notas publicadas pelos professores
          </p>
        </div>

        <Card size="sm" className="flex-row items-center gap-4">
          <CardEyebrow>Média geral</CardEyebrow>
          <span className="font-extrabold text-2xl tracking-[-0.6px]">
            {nota(boletim.data?.overall)}
          </span>
        </Card>
      </div>

      {boletim.isLoading ? (
        <Card>
          <ListSkeleton rows={4} />
        </Card>
      ) : disciplinas.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhuma nota publicada"
            description="Assim que um professor publicar uma avaliação deste bimestre, ela aparece aqui com a conta aberta."
          />
        </Card>
      ) : (
        disciplinas.map((disciplina) => {
          const situacao = situacaoNota(disciplina.situation);
          const pesoTotal = disciplina.entries.reduce((soma, item) => soma + item.weight, 0);

          return (
            <Card key={disciplina.subjectId}>
              <CardHeader>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <CardTitle>{disciplina.subjectName}</CardTitle>
                  <CardDescription>média {nota(disciplina.average)}</CardDescription>
                </div>
                <CardAction>
                  <Badge variant={situacao.tone}>{situacao.label}</Badge>
                </CardAction>
              </CardHeader>

              <ul className="flex flex-col gap-2">
                {disciplina.entries.map((avaliacao) => (
                  <li
                    key={avaliacao.assessmentId}
                    className="flex flex-wrap items-center gap-3 rounded-field bg-muted p-3"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-extrabold text-[13px]">{avaliacao.name}</span>
                      <span className="text-[11px] text-muted-foreground">
                        peso {avaliacao.weight}
                        {avaliacao.appliedOn ? ` · ${shortDate(avaliacao.appliedOn)}` : ""}
                      </span>
                    </span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {nota(avaliacao.score)} × {avaliacao.weight} ={" "}
                      {nota(avaliacao.score * avaliacao.weight)}
                    </span>
                    <span
                      className={cn(
                        "w-14 text-right font-extrabold text-sm tabular-nums",
                        avaliacao.score < 6 ? "text-danger" : "text-foreground",
                      )}
                    >
                      {nota(avaliacao.score)}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="text-[11px] text-muted-foreground">
                Como sua média foi calculada: soma de (nota × peso) dividida pelo peso total (
                {pesoTotal}). Avaliação ainda não lançada não entra na conta — não vale zero.
              </p>
            </Card>
          );
        })
      )}
    </>
  );
}
