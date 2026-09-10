import { Eyebrow, Panel, PanelHeader } from "@educa-escola/ui/integra/panel";
import { EmptyState, ListSkeleton, PermissionState } from "@educa-escola/ui/integra/states";
import { StatusBadge } from "@educa-escola/ui/integra/status-badge";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/turmas")({
  component: Turmas,
});

/**
 * Turmas.
 *
 * A mesma rota atende a direção (todas as turmas da escola) e o professor
 * (só as do vínculo) — quem decide é o servidor, não um `if` de tela: o
 * professor consulta as turmas em que tem aula, e nada além disso chega.
 */
function Turmas() {
  const trpc = useTRPC();
  const me = useQuery(trpc.me.queryOptions());
  const professor = me.data?.role === "teacher";

  const daEscola = useQuery({ ...trpc.classroom.list.queryOptions(), enabled: !professor });
  const doVinculo = useQuery({ ...trpc.lesson.myClassrooms.queryOptions(), enabled: professor });

  const carregando = professor ? doVinculo.isLoading : daEscola.isLoading;
  const erro = professor ? doVinculo.error : daEscola.error;

  const itens = professor
    ? (doVinculo.data ?? []).map((turma) => ({
        id: turma.classroomId,
        nome: turma.classroomName,
        detalhe: turma.subjectName,
      }))
    : (daEscola.data ?? []).map((turma) => ({
        id: turma.id,
        nome: turma.name,
        detalhe: `Ano letivo ${turma.academicYear}`,
      }));

  if (erro) {
    return (
      <Panel>
        <PermissionState
          title="Seu perfil não abre esta tela"
          description="A lista de turmas é da direção, da secretaria e dos professores vinculados."
        />
      </Panel>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <Eyebrow>{professor ? "Minhas turmas" : "Turmas"}</Eyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">
          {professor ? "Minhas turmas" : "Turmas da escola"}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {professor
            ? "Turmas em que você tem aula atribuída neste ano letivo."
            : "Todas as turmas cadastradas nesta instituição."}
        </p>
      </div>

      <Panel>
        <PanelHeader
          title={professor ? "Vínculos" : "Cadastradas"}
          action={itens.length ? <StatusBadge tone="info">{itens.length}</StatusBadge> : null}
        />

        {carregando ? (
          <ListSkeleton rows={3} />
        ) : itens.length === 0 ? (
          <EmptyState
            title="Nenhuma turma"
            description={
              professor
                ? "Você ainda não tem aula atribuída nesta escola."
                : "Nenhuma turma criada para este ano letivo."
            }
          />
        ) : (
          <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {itens.map((turma) => (
              <li key={`${turma.id}-${turma.detalhe}`}>
                {professor ? (
                  <Link
                    to="/notas"
                    search={{ turma: turma.id }}
                    className="flex flex-col gap-1 rounded-field bg-muted p-4 hover:bg-accent"
                  >
                    <span className="font-extrabold text-base tracking-[-0.2px]">{turma.nome}</span>
                    <span className="text-[11px] text-muted-foreground">{turma.detalhe}</span>
                  </Link>
                ) : (
                  <div className="flex flex-col gap-1 rounded-field bg-muted p-4">
                    <span className="font-extrabold text-base tracking-[-0.2px]">{turma.nome}</span>
                    <span className="text-[11px] text-muted-foreground">{turma.detalhe}</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
