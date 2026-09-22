import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, FileCheck2, ShieldCheck, Users } from "lucide-react";
import { useState } from "react";

import { integerText } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/placar-escolas")({
  component: PlacarEntreEscolas,
});

/**
 * Adesão da escola ao placar entre instituições.
 *
 * A tela é de **consentimento**, e o desenho segue isso: os três indicadores
 * aparecem antes de aderir, para a direção ver exatamente o que seria
 * publicado; e sair é um botão de igual peso, não um link escondido no rodapé.
 *
 * Não existe tela do placar em si nesta PR. A procedure `scoreboard` exige
 * `ranking: read_cross_school`, que nenhum papel tem — enquanto for assim,
 * construir a lista seria construir uma tela que ninguém abre.
 */
function PlacarEntreEscolas() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();
  const [nome, setNome] = useState("");

  const status = useQuery(trpc.leaderboard.status.queryOptions({ academicYear: year }));

  const invalidar = () => queryClient.invalidateQueries({ queryKey: [["leaderboard"]] });
  const aderir = useMutation(trpc.leaderboard.aderir.mutationOptions({ onSuccess: invalidar }));
  const sair = useMutation(trpc.leaderboard.sair.mutationOptions({ onSuccess: invalidar }));

  const situacao = status.data;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Pontuação</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Placar entre escolas</h1>
        <p className="text-corpo text-muted-foreground">
          Comparação com outras instituições em {year}, se a escola quiser participar.
        </p>
      </div>

      {/*
        O que sai daqui, em uma frase, antes de qualquer botão. Consentimento
        que a pessoa dá sem saber o que está consentindo não é consentimento.
      */}
      <Alert variant="info">
        <ShieldCheck size={18} strokeWidth={1.8} aria-hidden />
        <AlertTitle>O que sai da escola</AlertTitle>
        <AlertDescription>
          Apenas o nome de exibição e os três números abaixo. Nenhum dado de aluno ou de professor
          atravessa: a tabela publicada não tem coluna para pessoa. Sair do placar apaga o que foi
          publicado.
        </AlertDescription>
      </Alert>

      {status.isLoading ? (
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      ) : status.isError || !situacao ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar os indicadores"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
            <StatCard icon={ClipboardCheck} label="Chamada no prazo" hint="de 0 a 100">
              {integerText(situacao.indicadores.chamadaNoPrazo)}
            </StatCard>
            <StatCard icon={FileCheck2} label="Notas sem pendência" hint="de 0 a 100">
              {integerText(situacao.indicadores.notasSemPendencia)}
            </StatCard>
            <StatCard icon={Users} label="Frequência média" hint="de 0 a 100">
              {integerText(situacao.indicadores.frequenciaMedia)}
            </StatCard>
            <StatCard icon={ShieldCheck} label="Total" hint="soma dos três">
              {integerText(situacao.indicadores.points)}
            </StatCard>
          </div>

          <p className="text-meta text-muted-foreground">
            São taxas, não totais: uma escola de 2.000 alunos e uma de 200 com o mesmo desempenho
            tiram a mesma nota. Somar pontos de pessoas faria o placar medir matrícula.
          </p>

          <Card className="flex flex-col gap-4">
            <CardEyebrow>{situacao.aderiu ? "Participando" : "Participar"}</CardEyebrow>

            {situacao.aderiu ? (
              <>
                <p className="text-corpo">
                  A escola aparece no placar como{" "}
                  <strong className="font-bold">{situacao.displayName}</strong>.
                </p>
                <div>
                  <Button
                    variant="destructive"
                    onClick={() => sair.mutate()}
                    disabled={sair.isPending}
                  >
                    {sair.isPending ? "Saindo…" : "Sair do placar"}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex max-w-sm flex-col gap-2">
                  <Label htmlFor="nome-no-placar">Como a escola aparece no placar</Label>
                  <Input
                    id="nome-no-placar"
                    value={nome}
                    onChange={(evento) => setNome(evento.target.value)}
                    placeholder="Dom Pedro II"
                    maxLength={60}
                  />
                  <p className="text-meta text-muted-foreground">
                    Um nome curto: é o rótulo de uma linha. Não precisa ser a razão social.
                  </p>
                </div>
                <div>
                  <Button
                    onClick={() => aderir.mutate({ displayName: nome, academicYear: year })}
                    disabled={aderir.isPending || nome.trim().length < 2}
                  >
                    {aderir.isPending ? "Publicando…" : "Participar do placar"}
                  </Button>
                </div>
              </>
            )}

            {aderir.isError ? (
              <Alert variant="danger">
                <AlertTitle>Não foi possível participar</AlertTitle>
                <AlertDescription>{aderir.error.message}</AlertDescription>
              </Alert>
            ) : null}
          </Card>
        </>
      )}
    </>
  );
}
