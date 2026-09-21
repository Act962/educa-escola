import { Avatar, AvatarFallback } from "@educa-escola/ui/components/avatar";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { EmptyState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { initialsOf } from "@educa-escola/ui/lib/initials";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { dataHora, inteiro, prazo, situacaoLink } from "@/lib/format";
import type { RouterOutputs } from "@/utils/trpc";
import { useTRPC } from "@/utils/trpc";

/**
 * Quantas pendentes o quadro carrega de uma vez.
 *
 * Alto o bastante para caber a fila inteira de uma escola real e baixo o
 * bastante para não virar uma página que trava. Passando disso, a lista com
 * busca e paginação é o lugar certo.
 */
const LIMITE_PENDENTES = 120;

/** Quantas confirmadas aparecem na última coluna. */
const CONFIRMADAS_VISIVEIS = 6;

/** Uma linha da `enrollment.list`, inferida do próprio router. */
type Item = RouterOutputs["enrollment"]["list"]["items"][number];

interface Filtros {
  academicYear: number;
  search?: string;
  classroomId?: string;
  shift?: "manha" | "tarde" | "noite";
}

/**
 * As três etapas em que uma matrícula pendente pode estar, na ordem do funil.
 *
 * `vencido`, `bloqueado` e `revogado` caem em "aguardando família": do ponto de
 * vista de quem olha o quadro, são todos "a família não devolveu", e o cartão
 * diz o motivo. Coluna separada para cada um deixaria três colunas quase
 * sempre vazias.
 */
const COLUNAS = [
  {
    id: "nao_enviado",
    titulo: "Link não enviado",
    aceita: ["nao_enviado"],
  },
  {
    id: "aguardando",
    titulo: "Aguardando família",
    aceita: ["aguardando", "vencido", "bloqueado", "revogado"],
  },
  {
    id: "ficha_entregue",
    titulo: "Ficha entregue",
    aceita: ["ficha_entregue"],
  },
] as const;

/**
 * Matrículas em quadro, por etapa do link.
 *
 * Os cartões **não arrastam**, e é deliberado: a secretaria não controla as
 * três primeiras transições — quem envia a ficha é a família. Arrastar
 * sugeriria um poder que ela não tem. A única ação dela, confirmar, está no
 * botão do cartão.
 */
export function MatriculasQuadro({ filtros }: { filtros: Filtros }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  /** Cartão sendo arrastado e coluna sob o cursor, para o retorno visual. */
  const [arrastando, setArrastando] = useState<Item | null>(null);
  const [sobre, setSobre] = useState<string | null>(null);
  /** Solto em "Confirmadas" sem a ficha da família: pede um aceite antes. */
  const [semFicha, setSemFicha] = useState<Item | null>(null);

  const confirmar = useMutation(
    trpc.enrollment.confirm.mutationOptions({
      onSuccess: (_, variaveis) => {
        toast.success("Matrícula confirmada. O aluno já aparece na chamada da turma.");
        setSemFicha(null);
        queryClient.invalidateQueries();
        return variaveis;
      },
      onError: (erro) => {
        toast.error(erro.message);
        setSemFicha(null);
      },
    }),
  );

  /**
   * Soltar em "Confirmadas".
   *
   * Com a ficha entregue, confirma direto — é o gesto que a secretaria repete
   * o dia inteiro. Sem a ficha, para e pergunta: confirmar sem o retorno da
   * família é pular uma etapa, e §22.2 pede confirmação proporcional ao risco.
   */
  function soltar(item: Item) {
    if (item.linkStatus === "ficha_entregue") {
      confirmar.mutate({ id: item.id });
      return;
    }
    setSemFicha(item);
  }

  const pendentes = useQuery(
    trpc.enrollment.list.queryOptions({
      ...filtros,
      status: "pendente",
      limit: LIMITE_PENDENTES,
      offset: 0,
    }),
  );

  const ativas = useQuery(
    trpc.enrollment.list.queryOptions({
      ...filtros,
      status: "ativa",
      limit: CONFIRMADAS_VISIVEIS,
      offset: 0,
    }),
  );

  if (pendentes.isLoading || ativas.isLoading) {
    return <ListSkeleton rows={5} />;
  }

  const itens = pendentes.data?.items ?? [];
  const confirmadas = ativas.data?.items ?? [];
  const totalConfirmadas = ativas.data?.total ?? 0;

  if (itens.length === 0 && totalConfirmadas === 0) {
    return (
      <EmptyState
        title="Nenhuma matrícula neste recorte"
        description="Troque o filtro de turma ou de turno, ou volte para todas as situações."
      />
    );
  }

  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {COLUNAS.map((coluna) => {
        const daColuna = itens.filter((item) =>
          (coluna.aceita as readonly string[]).includes(item.linkStatus),
        );

        return (
          <section
            key={coluna.id}
            // Sem `preventDefault` no dragover o navegador já mostra o cursor
            // de "não pode" — a recusa vem de graça, e o texto abaixo diz por
            // quê em vez de deixar a pessoa adivinhando.
            className={
              arrastando
                ? "flex flex-col gap-2.5 rounded-card bg-muted p-3 opacity-55"
                : "flex flex-col gap-2.5 rounded-card bg-muted p-3"
            }
          >
            <header className="flex items-center justify-between px-1">
              <h3 className="font-extrabold text-xs">{coluna.titulo}</h3>
              <span className="rounded-full bg-card px-2.5 py-0.5 font-extrabold text-[11px] text-muted-foreground">
                {daColuna.length}
              </span>
            </header>

            {arrastando ? (
              <p className="rounded-field border border-border border-dashed px-3 py-2 text-[11px] text-muted-foreground">
                Quem move um cartão até aqui é a família, pelo link.
              </p>
            ) : null}

            {daColuna.length === 0 ? (
              <p className="px-1 py-3 text-[11px] text-muted-foreground">Nada aqui.</p>
            ) : (
              daColuna.map((item) => (
                <Cartao
                  key={item.id}
                  item={item}
                  arrastavel
                  onArrastar={setArrastando}
                  onSoltarCartao={() => {
                    setArrastando(null);
                    setSobre(null);
                  }}
                />
              ))
            )}
          </section>
        );
      })}

      {/*
        Arrastar é melhoria progressiva, não a única via: cada cartão tem o
        botão "Confirmar", que é o caminho de teclado e de tela de toque. Dar
        papel interativo a esta coluna faria o leitor de tela anunciar uma ação
        que quem navega por teclado não consegue executar aqui — pior que o
        silêncio. Por isso a regra fica suprimida neste ponto, e só neste.
      */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: ver comentário acima */}
      <section
        onDragOver={(evento) => {
          if (!arrastando) return;
          // `preventDefault` é o que marca a área como zona de soltura: sem
          // ele o navegador recusa o drop, e é assim que as outras colunas
          // recusam sem uma linha de código.
          evento.preventDefault();
          setSobre("confirmadas");
        }}
        onDragLeave={() => setSobre(null)}
        onDrop={(evento) => {
          evento.preventDefault();
          const item = arrastando;
          setArrastando(null);
          setSobre(null);
          if (item) soltar(item);
        }}
        className={
          sobre === "confirmadas"
            ? "flex flex-col gap-2.5 rounded-card bg-accent p-3 outline-dashed outline-2 outline-primary"
            : arrastando
              ? "flex flex-col gap-2.5 rounded-card bg-muted p-3 outline-dashed outline-2 outline-primary/40"
              : "flex flex-col gap-2.5 rounded-card bg-muted p-3"
        }
      >
        <header className="flex items-center justify-between px-1">
          <h3 className="font-extrabold text-xs">Confirmadas</h3>
          <span className="rounded-full bg-card px-2.5 py-0.5 font-extrabold text-[11px] text-muted-foreground">
            {inteiro(totalConfirmadas)}
          </span>
        </header>

        {arrastando ? (
          <p className="rounded-field border-2 border-primary border-dashed px-3 py-2 text-center font-bold text-[11px] text-info">
            Solte para confirmar {arrastando.studentName.split(" ")[0]}
          </p>
        ) : null}

        {semFicha ? (
          <div className="flex flex-col gap-2 rounded-field bg-warning-soft p-3">
            <p className="font-bold text-[12px]">{semFicha.studentName} ainda não enviou a ficha</p>
            <p className="text-[11px] text-warning leading-relaxed">
              Confirmar agora coloca o aluno na turma sem o retorno da família, e sem os
              consentimentos.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                className="min-h-7 px-2.5 text-[11px]"
                disabled={confirmar.isPending}
                onClick={() => confirmar.mutate({ id: semFicha.id })}
              >
                Confirmar assim mesmo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="min-h-7 px-2.5 text-[11px]"
                onClick={() => setSemFicha(null)}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : null}

        {confirmadas.length === 0 ? (
          <p className="px-1 py-3 text-[11px] text-muted-foreground">Nada aqui.</p>
        ) : (
          confirmadas.map((item) => <Cartao key={item.id} item={item} confirmada />)
        )}

        {totalConfirmadas > confirmadas.length ? (
          <p className="px-1 py-1 text-center text-[11px] text-muted-foreground">
            {/* Carregar 286 cartões seria um quadro que ninguém lê. */}+{" "}
            {inteiro(totalConfirmadas - confirmadas.length)} confirmadas · veja na lista
          </p>
        ) : null}
      </section>
    </div>
  );
}

/**
 * Cartão do quadro.
 *
 * Arrastar usa o HTML5 nativo em vez de uma biblioteca: é uma única zona de
 * soltura, e o navegador já dá o cursor de recusa nas colunas que não aceitam.
 *
 * **O botão continua sendo o caminho principal**, não um resto: arrastar não
 * funciona por teclado nem em tela de toque, então a ação precisa existir sem
 * o gesto. Quem usa o quadro no tablet clica em "Confirmar".
 */
function Cartao({
  item,
  confirmada,
  arrastavel,
  onArrastar,
  onSoltarCartao,
}: {
  item: Item;
  confirmada?: boolean;
  arrastavel?: boolean;
  onArrastar?: (item: Item) => void;
  onSoltarCartao?: () => void;
}) {
  const link = situacaoLink(item.linkStatus);
  const restante = prazo(item.expiresAt);
  const urgente = !confirmada && (restante === "vence hoje" || restante === "vencido");

  return (
    <article
      draggable={arrastavel}
      onDragStart={(evento) => {
        evento.dataTransfer.effectAllowed = "move";
        evento.dataTransfer.setData("text/plain", item.id);
        onArrastar?.(item);
      }}
      onDragEnd={() => onSoltarCartao?.()}
      title={arrastavel ? "Arraste até Confirmadas, ou use o botão" : undefined}
      className={
        urgente
          ? "flex flex-col gap-2.5 rounded-field bg-danger-soft p-3 [&[draggable=true]]:cursor-grab [&[draggable=true]]:active:cursor-grabbing"
          : "flex flex-col gap-2.5 rounded-field bg-card p-3 [&[draggable=true]]:cursor-grab [&[draggable=true]]:active:cursor-grabbing"
      }
    >
      <div className="flex items-start gap-2.5">
        <Avatar className="size-8">
          <AvatarFallback className="text-[10px]">{initialsOf(item.studentName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="font-bold text-[13px] leading-tight">{item.studentName}</p>
          <p className="text-[11px] text-muted-foreground">
            <span className="tabular-nums">{item.registration}</span>
            {item.classroomName ? ` · ${item.classroomName}` : " · turma a definir"}
            {item.classCode ? ` · ${item.classCode}` : ""}
          </p>
        </div>
      </div>

      <p
        className={
          urgente ? "font-bold text-[11px] text-danger" : "text-[11px] text-muted-foreground"
        }
      >
        {confirmada
          ? `Confirmada em ${dataHora(item.confirmedAt)}`
          : urgente
            ? `Prazo ${restante}`
            : item.guardianName
              ? `${item.guardianName} · ${restante}`
              : restante}
      </p>

      <div className="flex items-center justify-between gap-2">
        <Badge variant={confirmada ? "success" : link.tone}>
          {confirmada ? "Ativa" : link.label}
        </Badge>
        <Button
          size="sm"
          variant={item.linkStatus === "ficha_entregue" && !confirmada ? "default" : "secondary"}
          className="min-h-7 px-2.5 text-[11px]"
          render={<Link to="/matriculas/$enrollmentId" params={{ enrollmentId: item.id }} />}
        >
          {item.linkStatus === "ficha_entregue" && !confirmada ? "Confirmar" : "Abrir"}
        </Button>
      </div>
    </article>
  );
}
