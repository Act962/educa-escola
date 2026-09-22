import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { ErrorState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Medal, Users } from "lucide-react";

import { EsqueletoDePontos, ExtratoDePontos, ResumoDePontos } from "@/components/painel-de-pontos";
import { inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/pontos")({
  component: MeusPontos,
});

/**
 * Os pontos do aluno.
 *
 * **Nenhum nome de colega aparece aqui, e não é por escolha de tela.** O
 * servidor devolve posição, total da turma e média — nunca a lista (§7.5). Se
 * um dia alguém quiser mostrar o pódio, vai precisar mudar o retorno do
 * service e passar pelo teste que afirma que o id do colega não sai de lá.
 */
function MeusPontos() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();
  const painel = useQuery(trpc.score.meuPainelDeAluno.queryOptions({ academicYear: year }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Pontuação</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Meus pontos</h1>
        <p className="text-corpo text-muted-foreground">
          Presença, constância e evolução das suas notas ao longo de {year}.
        </p>
      </div>

      {painel.isLoading ? (
        <EsqueletoDePontos />
      ) : painel.isError || !painel.data ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar seus pontos"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : (
        <>
          <ResumoDePontos dados={painel.data} ano={year} />

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={Medal}
              label="Na sua turma"
              hint={
                painel.data.posicao
                  ? "posição pelos pontos do ano"
                  : "você aparece assim que pontuar"
              }
            >
              {painel.data.posicao
                ? `${painel.data.posicao}º de ${inteiro(painel.data.totalNaTurma)}`
                : "—"}
            </StatCard>

            <StatCard icon={Users} label="Média da turma" hint="comparação anônima, sem nomes">
              {painel.data.mediaDaTurma === null ? "—" : inteiro(painel.data.mediaDaTurma)}
            </StatCard>
          </div>

          <ExtratoDePontos dados={painel.data} />
        </>
      )}
    </>
  );
}
