import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { ErrorState } from "@educa-escola/ui/integra/states";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Medal } from "lucide-react";

import { EsqueletoDePontos, ExtratoDePontos, ResumoDePontos } from "@/components/painel-de-pontos";
import { inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/meus-pontos")({
  component: PontosDoProfessor,
});

/**
 * Os pontos do professor.
 *
 * A frase do rodapé não é enfeite: todas as regras daqui são sobre **o
 * registro**, nunca sobre o que foi registrado. Quem lê a tela precisa saber
 * disso, senão a suspeita natural é que marcar falta custe ponto.
 */
function PontosDoProfessor() {
  const trpc = useTRPC();
  const { year } = useSchoolContext();
  const painel = useQuery(trpc.score.meuPainelDeProfessor.queryOptions({ academicYear: year }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Pontuação</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Meus pontos</h1>
        <p className="text-corpo text-muted-foreground">
          Chamada no prazo, diário preenchido e devolutiva rápida em {year}.
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

          <StatCard
            icon={Medal}
            label="Entre os docentes"
            hint={painel.data.posicao ? "posição pelos pontos do ano" : "aparece ao pontuar"}
          >
            {painel.data.posicao ? `${painel.data.posicao}º de ${inteiro(painel.data.total)}` : "—"}
          </StatCard>

          <ExtratoDePontos dados={painel.data} />

          <p className="text-meta text-muted-foreground">
            Todos os pontos aqui são por <strong className="font-bold">registrar</strong>, nunca
            pelo conteúdo do registro. Marcar falta não custa ponto — a chamada no prazo vale o
            mesmo com a turma cheia ou vazia.
          </p>
        </>
      )}
    </>
  );
}
