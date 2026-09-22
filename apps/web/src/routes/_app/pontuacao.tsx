import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@educa-escola/ui/components/table";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { RefreshCw, TriangleAlert } from "lucide-react";

import { inteiro } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/pontuacao")({
  component: Pontuacao,
});

/**
 * O placar da escola, para a direção.
 *
 * Esta é a única tela do produto que mostra classificação nominal de aluno, e
 * ela existe porque a coordenação precisa enxergar quem descolou e quem sumiu.
 * O aluno não chega aqui: falta-lhe a ação `ranking: read`, e quem barra é o
 * servidor, não este arquivo.
 */
function Pontuacao() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();

  const alunos = useQuery(trpc.score.rankingDeAlunos.queryOptions({ academicYear: year }));
  const professores = useQuery(
    trpc.score.rankingDeProfessores.queryOptions({ academicYear: year }),
  );

  const apurar = useMutation(
    trpc.score.apurar.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [["score"]] }),
    }),
  );

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardEyebrow>Pontuação</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Placar de {year}</h1>
          <p className="text-corpo text-muted-foreground">
            Presença e evolução dos alunos; registro no prazo dos professores.
          </p>
        </div>

        <Button
          variant="secondary"
          onClick={() => apurar.mutate({ academicYear: year })}
          disabled={apurar.isPending}
        >
          <RefreshCw size={18} strokeWidth={1.8} aria-hidden />
          {apurar.isPending ? "Apurando…" : "Apurar agora"}
        </Button>
      </div>

      {/*
        Dizer isto na tela, e não só no código: sem agendador, o placar
        congela no último clique, e um número parado parecendo atual é pior
        que um número que se sabe velho.
      */}
      <Alert variant="warning">
        <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
        <AlertTitle>O placar não se atualiza sozinho</AlertTitle>
        <AlertDescription>
          A apuração roda quando alguém clica em “Apurar agora”. Rodar de novo é seguro: pontos já
          contados não contam duas vezes.
        </AlertDescription>
      </Alert>

      {apurar.isError ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível apurar</AlertTitle>
          <AlertDescription>{apurar.error.message}</AlertDescription>
        </Alert>
      ) : apurar.isSuccess ? (
        <Alert variant="success">
          <AlertTitle>Apuração concluída</AlertTitle>
          <AlertDescription>
            {inteiro(apurar.data.novos)} pontuações novas de {inteiro(apurar.data.apurados)} fatos
            conferidos.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Alunos</CardEyebrow>
        {alunos.isLoading ? (
          <ListSkeleton rows={5} />
        ) : alunos.isError ? (
          <ErrorState
            title="Não foi possível carregar o placar"
            description="Atualize a página em instantes."
          />
        ) : alunos.data?.length === 0 ? (
          <EmptyState
            title="Ninguém pontuou ainda"
            description="Clique em “Apurar agora” para contar as aulas e as notas já registradas."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alunos.data?.map((linha) => (
                <TableRow key={linha.subjectId}>
                  <TableCell className="text-muted-foreground">{linha.posicao}</TableCell>
                  <TableCell className="font-bold">{linha.nome}</TableCell>
                  <TableCell>
                    <Badge variant="info">{linha.nivel.nome}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">{inteiro(linha.pontos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Professores</CardEyebrow>
        {professores.isLoading ? (
          <ListSkeleton rows={3} />
        ) : professores.data?.length === 0 ? (
          <EmptyState
            title="Sem pontuação de docentes"
            description="Os pontos vêm de chamada no prazo, diário preenchido e devolutiva rápida."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Professor</TableHead>
                <TableHead className="text-right">Pontos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {professores.data?.map((linha) => (
                <TableRow key={linha.subjectId}>
                  <TableCell className="text-muted-foreground">{linha.posicao}</TableCell>
                  <TableCell className="font-bold">{linha.nome}</TableCell>
                  <TableCell className="text-right font-bold">{inteiro(linha.pontos)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <p className="text-meta text-muted-foreground">
          Apoio pedagógico, não avaliação de desempenho: todos os pontos são por registrar no prazo,
          e nenhum olha para a nota ou a frequência da turma.
        </p>
      </Card>
    </>
  );
}
