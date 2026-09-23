import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Info, TriangleAlert } from "lucide-react";

import { integerText, percentText } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/relatorios")({
  component: Relatorios,
});

/**
 * Relatórios e indicadores (§15).
 *
 * A tela mostra os dez indicadores-chave do §15.4, e **os quatro que o sistema
 * ainda não sabe calcular aparecem dizendo por quê**. Um painel com número
 * chutado faz a direção decidir sobre dado inventado; um painel que diz o que
 * falta diz o que construir.
 */
function Relatorios() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();

  const indicators = useQuery(trpc.report.indicators.queryOptions({ academicYear: year }));
  const catalogo = useQuery(trpc.report.catalogo.queryOptions());
  const alerta = useQuery(trpc.report.classroomsAtRisk.queryOptions({ academicYear: year }));

  const exportar = useMutation(
    trpc.report.exportar.mutationOptions({
      onSuccess: (arquivo) => baixar(arquivo.name, arquivo.conteudo),
    }),
  );

  const disponiveis = indicators.data?.filter((i) => i.valor !== null) ?? [];
  const pending = indicators.data?.filter((i) => i.valor === null) ?? [];

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Relatórios de {year}</h1>
        <p className="text-corpo text-muted-foreground">
          Indicadores-chave da escola e exportação para a secretaria.
        </p>
      </div>

      {alerta.data && alerta.data.length > 0 ? (
        <Alert variant="warning">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
          <AlertTitle>
            {alerta.data.length} turma{alerta.data.length > 1 ? "s" : ""} abaixo dos 75%
          </AlertTitle>
          <AlertDescription>
            {alerta.data
              .map((turma) => `${turma.name} (${percentText(turma.attendanceRate)})`)
              .join(" · ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <CardEyebrow>Indicadores-chave</CardEyebrow>

        {indicators.isLoading ? (
          <ListSkeleton rows={5} />
        ) : indicators.isError ? (
          <ErrorState
            title="Não foi possível calcular os indicadores"
            description="Atualize a página em instantes."
          />
        ) : (
          <ul className="flex flex-col">
            {disponiveis.map((indicator) => (
              <li
                key={indicator.key}
                className="flex flex-wrap items-baseline gap-3 border-border border-t py-3 first:border-t-0"
              >
                <span className="min-w-52 font-bold text-corpo">{indicator.label}</span>
                <span className="font-extrabold text-xl">
                  {indicator.formato === "percentual"
                    ? percentText(indicator.valor)
                    : integerText(indicator.valor ?? 0)}
                </span>
                {/* A fórmula fica na tela: número sem fórmula é fé. */}
                <span className="text-meta text-muted-foreground">{indicator.formula}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pending.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <CardEyebrow>O que ainda não dá para medir</CardEyebrow>
          <p className="text-corpo text-muted-foreground">
            Estes indicadores estão no requisito (§15.4) e dependem de coisa que ainda não existe.
            Aparecem aqui em vez de sumirem — e em vez de virarem zero, que seria mentira.
          </p>
          <ul className="flex flex-col">
            {pending.map((indicator) => (
              <li
                key={indicator.key}
                className="flex flex-col gap-1 border-border border-t py-3 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Info size={14} strokeWidth={1.8} aria-hidden className="text-muted-foreground" />
                  <span className="font-bold text-corpo">{indicator.label}</span>
                  <Badge variant="secondary">sem dado</Badge>
                </div>
                <p className="text-meta text-muted-foreground">{indicator.indisponivel}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Exportar</CardEyebrow>

        {catalogo.data?.length === 0 ? (
          <EmptyState title="Nenhum relatório disponível" description="" />
        ) : (
          <ul className="flex flex-col">
            {catalogo.data?.map((relatorio) => (
              <li
                key={relatorio.key}
                className="flex flex-wrap items-center gap-3 border-border border-t py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-corpo">{relatorio.title}</p>
                  <p className="text-meta text-muted-foreground">{relatorio.descricao}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportar.mutate({ key: relatorio.key, academicYear: year })}
                  disabled={exportar.isPending}
                >
                  <Download size={16} strokeWidth={1.8} aria-hidden />
                  CSV
                </Button>
              </li>
            ))}
          </ul>
        )}

        {exportar.isError ? (
          <Alert variant="danger">
            <AlertTitle>Não foi possível exportar</AlertTitle>
            <AlertDescription>{exportar.error.message}</AlertDescription>
          </Alert>
        ) : null}

        <p className="text-meta text-muted-foreground">
          O arquivo sai com ponto e vírgula e acentuação para o Excel em português. Quem abre é a
          secretaria, não um script.
        </p>
      </Card>
    </>
  );
}

/**
 * Entrega o arquivo ao navegador.
 *
 * O conteúdo vem pronto do servidor, onde as contas moram. Aqui só existe a
 * mecânica de download — reimplementar o recorte no cliente criaria duas
 * versões da verdade que divergem na primeira mudança.
 */
function baixar(name: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
