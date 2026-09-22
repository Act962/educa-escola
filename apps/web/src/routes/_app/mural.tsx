import { PRIORITY_LABEL, type Priority } from "@educa-escola/api/modules/communication/schema";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/mural")({
  component: Mural,
});

/**
 * O mural de quem recebe.
 *
 * O recorte vem do servidor pelo papel e pela turma do vínculo — nunca por id
 * na entrada. Aluno não recebe comunicado de professores, e ninguém lê o mural
 * de outra turma trocando um parâmetro.
 */
function Mural() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();

  const mural = useQuery(trpc.communication.inbox.queryOptions({ academicYear: year }));
  const marcar = useMutation(
    trpc.communication.marcarComoLido.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [["communication"]] }),
    }),
  );

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Comunicação</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Comunicados</h1>
        <p className="text-corpo text-muted-foreground">O que a escola avisou em {year}.</p>
      </div>

      {mural.isLoading ? (
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      ) : mural.isError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar os comunicados"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : mural.data?.length === 0 ? (
        <Card>
          <EmptyState
            title="Nenhum comunicado"
            description="Quando a escola publicar um aviso, ele aparece aqui."
          />
        </Card>
      ) : (
        mural.data?.map((comunicado) => (
          <Card key={comunicado.id} className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-3">
              <h2 className="font-extrabold text-base">{comunicado.title}</h2>
              {comunicado.priority !== "normal" ? (
                <Badge variant={comunicado.priority === "urgente" ? "danger" : "warning"}>
                  {PRIORITY_LABEL[comunicado.priority as Priority]}
                </Badge>
              ) : null}
              {/* Não lido é o estado que pede ação; lido não precisa de selo
                  nenhum, senão a tela vira um tabuleiro de etiquetas. */}
              {comunicado.readAt === null ? <Badge variant="info">Novo</Badge> : null}
              <span className="ml-auto text-meta text-muted-foreground">{comunicado.autor}</span>
            </div>

            <p className="whitespace-pre-wrap text-corpo">{comunicado.body}</p>

            {comunicado.requiresAck && comunicado.acknowledgedAt === null ? (
              <div>
                <Button
                  size="sm"
                  onClick={() => marcar.mutate({ id: comunicado.id, acknowledge: true })}
                  disabled={marcar.isPending}
                >
                  <Check size={16} strokeWidth={1.8} aria-hidden />
                  Li e estou ciente
                </Button>
              </div>
            ) : comunicado.readAt === null ? (
              <div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => marcar.mutate({ id: comunicado.id, acknowledge: false })}
                  disabled={marcar.isPending}
                >
                  Marcar como lido
                </Button>
              </div>
            ) : null}
          </Card>
        ))
      )}
    </>
  );
}
