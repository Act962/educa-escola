import {
  AUDIENCE_LABEL,
  AUDIENCES,
  type Audience,
  PRIORITIES,
  PRIORITY_LABEL,
  type Priority,
} from "@educa-escola/api/modules/communication/schema";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
import { Card, CardEyebrow } from "@educa-escola/ui/components/card";
import { Input } from "@educa-escola/ui/components/input";
import { Label } from "@educa-escola/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@educa-escola/ui/components/select";
import { Textarea } from "@educa-escola/ui/components/textarea";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Megaphone, PenLine, Send, TriangleAlert, X } from "lucide-react";
import { useState } from "react";

import { inteiro, percentualCurto } from "@/lib/format";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/comunicados")({
  component: Comunicados,
});

const STATUS = {
  rascunho: { rotulo: "Rascunho", variante: "secondary" },
  publicado: { rotulo: "Publicado", variante: "success" },
  retificado: { rotulo: "Retificado", variante: "warning" },
} as const;

/**
 * Comunicados, para a gestão (§8).
 *
 * Duas regras do requisito moldam esta tela e não são detalhe:
 *
 * - **Envio em massa exige confirmação** (§8.3, regra 5), e a confirmação é do
 *   número que a pessoa viu. O público aparece antes de publicar.
 * - **Publicado não se apaga** (§8.3, regra 2): retifica-se, com a versão
 *   anterior no histórico. Apagar o que a escola já leu reescreveria o passado.
 */
function Comunicados() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();

  const [titulo, setTitulo] = useState("");
  const [corpo, setCorpo] = useState("");
  const [publico, setPublico] = useState<Audience>("toda_a_escola");
  const [prioridade, setPrioridade] = useState<Priority>("normal");
  /** Quando preenchido, salvar cria uma retificação em vez de um comunicado novo. */
  const [retificando, setRetificando] = useState<{ id: string; titulo: string } | null>(null);

  const lista = useQuery(trpc.communication.list.queryOptions({ academicYear: year }));
  const alcance = useQuery(trpc.communication.previewAudience.queryOptions({ audience: publico }));

  const recarregar = () => queryClient.invalidateQueries({ queryKey: [["communication"]] });
  const criar = useMutation(
    trpc.communication.createDraft.mutationOptions({
      onSuccess: () => {
        setTitulo("");
        setCorpo("");
        recarregar();
      },
    }),
  );
  const publicar = useMutation(
    trpc.communication.publish.mutationOptions({ onSuccess: recarregar }),
  );
  const retificar = useMutation(
    trpc.communication.rectify.mutationOptions({
      onSuccess: () => {
        setTitulo("");
        setCorpo("");
        setRetificando(null);
        recarregar();
      },
    }),
  );
  const apagar = useMutation(trpc.communication.remove.mutationOptions({ onSuccess: recarregar }));

  const audiencias = AUDIENCES.filter((a) => a !== "turma").map((a) => ({
    label: AUDIENCE_LABEL[a],
    value: a,
  }));
  const prioridades = PRIORITIES.map((p) => ({ label: PRIORITY_LABEL[p], value: p }));

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Comunicação</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Comunicados</h1>
        <p className="text-corpo text-muted-foreground">
          O que a escola avisa, para quem, e quem já leu.
        </p>
      </div>

      <Card className="flex flex-col gap-4">
        <CardEyebrow>{retificando ? "Retificação" : "Novo comunicado"}</CardEyebrow>

        {retificando ? (
          <Alert variant="info">
            <AlertTitle>Retificando “{retificando.titulo}”</AlertTitle>
            <AlertDescription>
              O comunicado anterior fica no histórico marcado como retificado. Esta versão nasce
              como rascunho — nada vai para ninguém até você publicar.{" "}
              <button type="button" className="underline" onClick={() => setRetificando(null)}>
                Cancelar a retificação
              </button>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="titulo-comunicado">Título</Label>
          <Input
            id="titulo-comunicado"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Reunião de pais do 2º bimestre"
            maxLength={120}
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="corpo-comunicado">Mensagem</Label>
          <Textarea
            id="corpo-comunicado"
            value={corpo}
            onChange={(e) => setCorpo(e.target.value)}
            rows={4}
            maxLength={5000}
            placeholder="Escreva o comunicado. Ele fica no histórico da escola."
          />
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-44 flex-col gap-2">
            <Label htmlFor="publico-comunicado">Para quem</Label>
            <Select
              value={publico}
              onValueChange={(v) => setPublico((v as Audience) ?? "toda_a_escola")}
              items={audiencias}
            >
              <SelectTrigger id="publico-comunicado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {audiencias.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-36 flex-col gap-2">
            <Label htmlFor="prioridade-comunicado">Prioridade</Label>
            <Select
              value={prioridade}
              onValueChange={(v) => setPrioridade((v as Priority) ?? "normal")}
              items={prioridades}
            >
              <SelectTrigger id="prioridade-comunicado">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioridades.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={() => {
              const dados = {
                academicYear: year,
                title: titulo,
                body: corpo,
                audience: publico,
                priority: prioridade,
                requiresAck: false,
              };
              if (retificando) retificar.mutate({ ...dados, replacesId: retificando.id });
              else criar.mutate(dados);
            }}
            disabled={
              criar.isPending ||
              retificar.isPending ||
              titulo.trim().length < 3 ||
              corpo.trim().length < 10
            }
          >
            <Megaphone size={18} strokeWidth={1.8} aria-hidden />
            {retificando ? "Salvar retificação" : "Salvar rascunho"}
          </Button>
        </div>

        {/* O público antes do envio: "vai para 303 pessoas" é aviso;
            "vai para todo mundo" não é. */}
        <p className="text-meta text-muted-foreground">
          {alcance.data === undefined
            ? "Calculando o público…"
            : `Alcança ${inteiro(alcance.data)} pessoa${alcance.data === 1 ? "" : "s"} nesta escola.`}
        </p>

        {criar.isError || retificar.isError ? (
          <Alert variant="danger">
            <AlertTitle>Não foi possível salvar</AlertTitle>
            <AlertDescription>{(criar.error ?? retificar.error)?.message}</AlertDescription>
          </Alert>
        ) : null}
      </Card>

      {publicar.isError ? (
        <Alert variant="warning">
          <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
          <AlertTitle>Confirme antes de publicar</AlertTitle>
          <AlertDescription>{publicar.error.message}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="flex flex-col gap-3">
        <CardEyebrow>Comunicados de {year}</CardEyebrow>

        {lista.isLoading ? (
          <ListSkeleton rows={4} />
        ) : lista.isError ? (
          <ErrorState
            title="Não foi possível carregar os comunicados"
            description="Atualize a página em instantes."
          />
        ) : lista.data?.length === 0 ? (
          <EmptyState
            title="Nenhum comunicado ainda"
            description="Rascunhos ficam só com você até serem publicados."
          />
        ) : (
          <ul className="flex flex-col">
            {lista.data?.map((comunicado) => (
              <li
                key={comunicado.id}
                className="flex flex-wrap items-center gap-3 border-border border-t py-3 text-corpo first:border-t-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{comunicado.title}</p>
                  <p className="text-meta text-muted-foreground">
                    {AUDIENCE_LABEL[comunicado.audience as Audience]}
                    {comunicado.publico !== null
                      ? ` · ${inteiro(comunicado.publico)} destinatários`
                      : null}
                    {comunicado.taxaDeLeitura !== null
                      ? ` · ${percentualCurto(comunicado.taxaDeLeitura)} leram`
                      : null}
                  </p>
                </div>

                {comunicado.priority !== "normal" ? (
                  <Badge variant={comunicado.priority === "urgente" ? "danger" : "warning"}>
                    {PRIORITY_LABEL[comunicado.priority as Priority]}
                  </Badge>
                ) : null}
                <Badge variant={STATUS[comunicado.status as keyof typeof STATUS].variante}>
                  {STATUS[comunicado.status as keyof typeof STATUS].rotulo}
                </Badge>

                {comunicado.status === "publicado" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setRetificando({ id: comunicado.id, titulo: comunicado.title });
                      setTitulo(`${comunicado.title} — retificação`);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    <PenLine size={16} strokeWidth={1.8} aria-hidden />
                    Retificar
                  </Button>
                ) : null}

                {comunicado.status === "rascunho" ? (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        publicar.mutate({
                          id: comunicado.id,
                          // O número que a pessoa está vendo agora. Se o
                          // público mudou, o servidor recusa e pede confirmação
                          // de novo — em vez de alcançar mais gente.
                          publicoConfirmado: alcance.data,
                        })
                      }
                      disabled={publicar.isPending}
                    >
                      <Send size={16} strokeWidth={1.8} aria-hidden />
                      Publicar
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Apagar rascunho ${comunicado.title}`}
                      onClick={() => apagar.mutate({ id: comunicado.id })}
                      disabled={apagar.isPending}
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <p className="text-meta text-muted-foreground">
          Comunicado publicado não pode ser excluído — ele se retifica, e a versão anterior fica no
          histórico. Apagar o que a escola já leu reescreveria o passado.
        </p>
      </Card>
    </>
  );
}
