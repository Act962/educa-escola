import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Download, Info, TriangleAlert } from "lucide-react";

import { inteiro, percentual } from "@/lib/format";
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

  const indicadores = useQuery(trpc.report.indicadores.queryOptions({ academicYear: year }));
  const catalogo = useQuery(trpc.report.catalogo.queryOptions());
  const alerta = useQuery(trpc.report.turmasEmAlerta.queryOptions({ academicYear: year }));

  const exportar = useMutation(
    trpc.report.exportar.mutationOptions({
      onSuccess: (arquivo) => baixar(arquivo.nome, arquivo.conteudo),
    }),
  );

  const disponiveis = indicadores.data?.filter((i) => i.valor !== null) ?? [];
  const pendentes = indicadores.data?.filter((i) => i.valor === null) ?? [];

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
              .map((turma) => `${turma.nome} (${percentual(turma.frequencia)})`)
              .join(" · ")}
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-4">
        <CardEyebrow>Indicadores-chave</CardEyebrow>

        {indicadores.isLoading ? (
          <ListSkeleton rows={5} />
        ) : indicadores.isError ? (
          <ErrorState
            title="Não foi possível calcular os indicadores"
            description="Atualize a página em instantes."
          />
        ) : (
          <ul className="flex flex-col">
            {disponiveis.map((indicador) => (
              <li
                key={indicador.chave}
                className="flex flex-wrap items-baseline gap-3 border-border border-t py-3 first:border-t-0"
              >
                <span className="min-w-52 font-bold text-corpo">{indicador.rotulo}</span>
                <span className="font-extrabold text-xl">
                  {indicador.formato === "percentual"
                    ? percentual(indicador.valor)
                    : inteiro(indicador.valor ?? 0)}
                </span>
                {/* A fórmula fica na tela: número sem fórmula é fé. */}
                <span className="text-meta text-muted-foreground">{indicador.formula}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {pendentes.length > 0 ? (
        <Card className="flex flex-col gap-3">
          <CardEyebrow>O que ainda não dá para medir</CardEyebrow>
          <p className="text-corpo text-muted-foreground">
            Estes indicadores estão no requisito (§15.4) e dependem de coisa que ainda não existe.
            Aparecem aqui em vez de sumirem — e em vez de virarem zero, que seria mentira.
          </p>
          <ul className="flex flex-col">
            {pendentes.map((indicador) => (
              <li
                key={indicador.chave}
                className="flex flex-col gap-1 border-border border-t py-3 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Info size={14} strokeWidth={1.8} aria-hidden className="text-muted-foreground" />
                  <span className="font-bold text-corpo">{indicador.rotulo}</span>
                  <Badge variant="secondary">sem dado</Badge>
                </div>
                <p className="text-meta text-muted-foreground">{indicador.indisponivel}</p>
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
                key={relatorio.chave}
                className="flex flex-wrap items-center gap-3 border-border border-t py-3 first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-corpo">{relatorio.titulo}</p>
                  <p className="text-meta text-muted-foreground">{relatorio.descricao}</p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => exportar.mutate({ chave: relatorio.chave, academicYear: year })}
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
function baixar(nome: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
