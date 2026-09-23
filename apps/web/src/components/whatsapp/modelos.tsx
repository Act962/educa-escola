import type {
  Botao,
  Categoria,
  ModeloDeMensagem,
} from "@educa-escola/api/messaging/whatsapp/template";
import {
  CATEGORIA_LABEL,
  CATEGORIAS,
  LIMITE_CABECALHO,
  LIMITE_CORPO,
  LIMITE_RODAPE,
  problemasDoModelo,
  valoresDeExemplo,
  variaveisDoModelo,
} from "@educa-escola/api/messaging/whatsapp/template";
import { Alert, AlertDescription, AlertTitle } from "@educa-escola/ui/components/alert";
import { Badge } from "@educa-escola/ui/components/badge";
import { Button } from "@educa-escola/ui/components/button";
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
import { EmptyState } from "@educa-escola/ui/integra/states";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Phone,
  Plus,
  RefreshCw,
  Reply,
  Send,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { dateTimeText } from "@/lib/format";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

import { PreviaDaMensagem } from "./previa";

type Visao = RouterOutputs["whatsapp"]["visao"];
type ModeloSalvo = Visao["modelos"][number];

/**
 * As variáveis que a escola usa o tempo todo.
 *
 * Sugestão, não catálogo fechado: o campo aceita qualquer nome. Existe porque
 * a página em branco é o que mais trava quem escreve o primeiro modelo — e
 * porque nome consistente entre modelos é o que vai permitir, na fase do
 * disparo em massa, preencher tudo a partir da matrícula sem mapa manual.
 */
const VARIAVEIS_SUGERIDAS = [
  "nome_do_aluno",
  "responsavel",
  "turma",
  "data",
  "hora",
  "escola",
  "valor",
] as const;

const STATUS: Record<
  ModeloSalvo["status"],
  { rotulo: string; tom: "success" | "warning" | "danger" | "info" | "neutral" }
> = {
  rascunho: { rotulo: "Rascunho", tom: "neutral" },
  enviado: { rotulo: "Em aprovação", tom: "info" },
  aprovado: { rotulo: "Aprovado", tom: "success" },
  recusado: { rotulo: "Recusado", tom: "danger" },
  pausado: { rotulo: "Pausado", tom: "warning" },
};

interface Rascunho {
  id?: string;
  nome: string;
  categoria: Categoria;
  idioma: string;
  cabecalho: string;
  corpo: string;
  rodape: string;
  botoes: Botao[];
  exemplos: string[];
}

const VAZIO: Rascunho = {
  nome: "",
  categoria: "UTILITY",
  idioma: "pt_BR",
  cabecalho: "",
  corpo: "",
  rodape: "",
  botoes: [],
  exemplos: [],
};

/**
 * O botão da tela vira a união discriminada que o servidor valida.
 *
 * Na tela ele é um objeto com `url` e `telefone` opcionais, porque trocar o
 * tipo de um botão meio preenchido não pode apagar o que a pessoa digitou. Na
 * borda, vira o formato em que `url` e `telefone` só existem no tipo que os
 * usa — que é o que impede um botão de link chegar ao servidor sem endereço.
 */
const paraEntrada = (botoes: Botao[]) =>
  botoes.map((botao) =>
    botao.tipo === "link"
      ? { tipo: "link" as const, texto: botao.texto, url: botao.url ?? "" }
      : botao.tipo === "telefone"
        ? { tipo: "telefone" as const, texto: botao.texto, telefone: botao.telefone ?? "" }
        : { tipo: "resposta" as const, texto: botao.texto },
  );

const comoModelo = (rascunho: Rascunho): ModeloDeMensagem => ({
  nome: rascunho.nome,
  categoria: rascunho.categoria,
  idioma: rascunho.idioma,
  cabecalho: rascunho.cabecalho || null,
  corpo: rascunho.corpo,
  rodape: rascunho.rodape || null,
  botoes: rascunho.botoes,
  exemplos: rascunho.exemplos,
});

export function ModelosDoWhatsApp({ visao }: { visao: Visao }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);

  const atualizar = () => queryClient.invalidateQueries({ queryKey: [["whatsapp"]] });

  const sincronizar = useMutation(
    trpc.whatsapp.sincronizar.mutationOptions({
      onSuccess: async (resultado) => {
        toast.success(`${resultado.conferidos} modelos conferidos na Meta.`);
        await atualizar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  if (rascunho) {
    return (
      <Editor
        rascunho={rascunho}
        aoMudar={setRascunho}
        aoFechar={() => setRascunho(null)}
        aoSalvar={atualizar}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-corpo text-muted-foreground">
          Na API oficial, conversa só começa por modelo aprovado. A aprovação é da Meta e leva de
          minutos a horas.
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={sincronizar.isPending || !visao.conta}
            onClick={() => sincronizar.mutate({})}
          >
            <RefreshCw />
            {sincronizar.isPending ? "Conferindo…" : "Sincronizar"}
          </Button>
          <Button onClick={() => setRascunho(VAZIO)}>
            <Plus />
            Novo modelo
          </Button>
        </div>
      </div>

      {visao.modelos.length === 0 ? (
        <EmptyState
          title="Nenhum modelo ainda"
          description="Crie o primeiro: um aviso de reunião, um lembrete de documento pendente, uma confirmação de matrícula."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {visao.modelos.map((modelo) => (
            <LinhaDoModelo
              key={modelo.id}
              modelo={modelo}
              aoEditar={(duplicar) =>
                setRascunho({
                  // Modelo aprovado não se edita na Meta: apaga-se e cria-se
                  // outro. Então "editar" um aprovado é duplicar — e o nome
                  // precisa ser outro, porque o dela é chave única.
                  id: duplicar ? undefined : modelo.id,
                  nome: duplicar ? proximoNome(modelo.nome) : modelo.nome,
                  categoria: modelo.categoria,
                  idioma: modelo.idioma,
                  cabecalho: modelo.cabecalho ?? "",
                  corpo: modelo.corpo,
                  rodape: modelo.rodape ?? "",
                  botoes: modelo.botoes,
                  exemplos: modelo.exemplos,
                })
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * `aviso_de_reuniao` → `aviso_de_reuniao_2` → `aviso_de_reuniao_3`.
 *
 * Nome é chave única na Meta e aqui. Duplicar mantendo o nome só descobriria
 * o conflito ao salvar, depois de a pessoa ter reescrito a mensagem inteira.
 */
function proximoNome(nome: string): string {
  const casa = nome.match(/^(.*?)_(\d+)$/);
  return casa ? `${casa[1]}_${Number(casa[2]) + 1}` : `${nome}_2`;
}

function LinhaDoModelo({
  modelo,
  aoEditar,
}: {
  modelo: ModeloSalvo;
  aoEditar: (duplicar: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const atualizar = () => queryClient.invalidateQueries({ queryKey: [["whatsapp"]] });

  const enviar = useMutation(
    trpc.whatsapp.enviarParaAprovacao.mutationOptions({
      onSuccess: async () => {
        toast.success("Modelo enviado para aprovação da Meta.");
        await atualizar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const remover = useMutation(
    trpc.whatsapp.removerModelo.mutationOptions({
      onSuccess: async () => {
        toast.success("Modelo removido.");
        await atualizar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const estado = STATUS[modelo.status];
  const editavel = modelo.status === "rascunho" || modelo.status === "recusado";

  return (
    <div className="flex flex-col gap-3 rounded-xl bg-muted p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={estado.tom}>{estado.rotulo}</Badge>
        <span className="font-semibold text-corpo">{modelo.nome}</span>
        <span className="text-meta text-muted-foreground">
          {modelo.idioma} · {modelo.categoria}
        </span>
        {modelo.sincronizadoEm ? (
          <span className="text-meta text-muted-foreground">
            · conferido em {dateTimeText(modelo.sincronizadoEm)}
          </span>
        ) : null}
      </div>

      <p className="whitespace-pre-wrap text-corpo text-muted-foreground">{modelo.corpo}</p>

      {modelo.variaveis.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {modelo.variaveis.map((nome) => (
            <Badge key={nome} variant="secondary">
              {`{{${nome}}}`}
            </Badge>
          ))}
        </div>
      ) : null}

      {modelo.motivoDaRecusa ? (
        <p className="flex items-start gap-1.5 text-danger text-meta">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {modelo.motivoDaRecusa}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => aoEditar(!editavel)}>
          {editavel ? "Editar" : "Duplicar"}
        </Button>
        {editavel ? (
          <Button
            variant="outline"
            size="sm"
            disabled={enviar.isPending}
            onClick={() => enviar.mutate({ id: modelo.id })}
          >
            <Send />
            Enviar para aprovação
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          disabled={remover.isPending}
          onClick={() => remover.mutate({ id: modelo.id })}
        >
          <Trash2 />
          Excluir
        </Button>
      </div>
    </div>
  );
}

/**
 * O editor: campos à esquerda, prévia à direita.
 *
 * Em tela estreita a prévia vem **primeiro**, e é decisão: quem confere a
 * mensagem no celular quer ver a mensagem, não o formulário. Em `lg` a prévia
 * gruda no alto da coluna e acompanha a digitação.
 */
function Editor({
  rascunho,
  aoMudar,
  aoFechar,
  aoSalvar,
}: {
  rascunho: Rascunho;
  aoMudar: (proximo: Rascunho) => void;
  aoFechar: () => void;
  aoSalvar: () => Promise<unknown>;
}) {
  const trpc = useTRPC();
  const modelo = comoModelo(rascunho);
  const variaveis = variaveisDoModelo(modelo);
  const problemas = problemasDoModelo(modelo);

  const salvar = useMutation(
    trpc.whatsapp.salvarModelo.mutationOptions({
      onSuccess: async () => {
        toast.success("Modelo salvo como rascunho.");
        await aoSalvar();
        aoFechar();
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  const mudar = (patch: Partial<Rascunho>) => aoMudar({ ...rascunho, ...patch });

  /**
   * A lista de exemplos acompanha a lista de variáveis.
   *
   * A ordem é o contrato com o servidor — cabeçalho primeiro, corpo depois.
   * Guardar por nome aqui e por posição lá seria duas verdades sobre a mesma
   * coisa, e a Meta receberia o exemplo da variável errada.
   */
  const exemploDe = (i: number) => rascunho.exemplos[i] ?? "";
  const mudarExemplo = (i: number, valor: string) => {
    const exemplos = [...rascunho.exemplos];
    while (exemplos.length < variaveis.length) exemplos.push("");
    exemplos[i] = valor;
    mudar({ exemplos: exemplos.slice(0, variaveis.length) });
  };

  const inserirVariavel = (nome: string) => mudar({ corpo: `${rascunho.corpo}{{${nome}}}` });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-extrabold text-lg tracking-[-0.3px]">
          {rascunho.id ? "Editar modelo" : "Novo modelo"}
        </h3>
        <Button variant="ghost" size="sm" onClick={aoFechar}>
          <X />
          Fechar
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Prévia antes do formulário no DOM só faria sentido visual em
            telas estreitas; aqui a ordem é invertida por `order` para o
            teclado continuar percorrendo os campos primeiro. */}
        {/* `min-w-0` nas duas colunas: item de grade tem `min-width: auto`, e
            sem isso o conteúdo mais largo — a fila de botões de variável —
            estica a coluna além da tela, e o celular ganha rolagem lateral. */}
        <div className="order-2 flex min-w-0 flex-col gap-4 lg:order-1">
          {/* `[&>*]:min-w-0` na grade: o rótulo da categoria é longo e o gatilho
              do `Select` é `whitespace-nowrap`, então o conteúdo mínimo da
              célula é a frase inteira — e o item de grade, que tem
              `min-width: auto`, obedece e estoura a tela do celular. */}
          <div className="grid gap-4 sm:grid-cols-2 [&>*]:min-w-0">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modelo-nome">Nome do modelo</Label>
              <Input
                id="modelo-nome"
                value={rascunho.nome}
                placeholder="aviso_de_reuniao"
                onChange={(evento) =>
                  mudar({
                    // Normaliza enquanto digita: o nome é chave na Meta e ela
                    // recusa maiúscula e espaço. Corrigir depois de um envio
                    // recusado custa horas de espera por um traço.
                    nome: evento.target.value
                      .toLowerCase()
                      .replace(/[^a-z0-9_ ]/g, "")
                      .replace(/ /g, "_"),
                  })
                }
              />
              <p className="text-meta text-muted-foreground">
                Só minúsculas, números e sublinhado. É o identificador na Meta.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="modelo-categoria">Categoria</Label>
              <Select
                value={rascunho.categoria}
                onValueChange={(valor) => mudar({ categoria: valor as Categoria })}
                items={CATEGORIAS.map((c) => ({ value: c, label: CATEGORIA_LABEL[c] }))}
              >
                <SelectTrigger id="modelo-categoria" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((categoria) => (
                    <SelectItem key={categoria} value={categoria}>
                      {CATEGORIA_LABEL[categoria]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-meta text-muted-foreground">
                Aviso escolar é utilidade. Categoria errada é motivo de recusa.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelo-cabecalho">Cabeçalho (opcional)</Label>
            <Input
              id="modelo-cabecalho"
              value={rascunho.cabecalho}
              maxLength={LIMITE_CABECALHO}
              placeholder="Escola Municipal X"
              onChange={(evento) => mudar({ cabecalho: evento.target.value })}
            />
            <Contador atual={rascunho.cabecalho.length} limite={LIMITE_CABECALHO} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelo-corpo">Mensagem</Label>
            <Textarea
              id="modelo-corpo"
              rows={6}
              value={rascunho.corpo}
              maxLength={LIMITE_CORPO}
              placeholder="Olá, {{responsavel}}. A reunião do {{nome_do_aluno}} é dia {{data}}."
              onChange={(evento) => mudar({ corpo: evento.target.value })}
            />
            <Contador atual={rascunho.corpo.length} limite={LIMITE_CORPO} />

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-meta text-muted-foreground">Inserir variável:</span>
              {VARIAVEIS_SUGERIDAS.map((nome) => (
                <Button
                  key={nome}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => inserirVariavel(nome)}
                >
                  {`{{${nome}}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modelo-rodape">Rodapé (opcional)</Label>
            <Input
              id="modelo-rodape"
              value={rascunho.rodape}
              maxLength={LIMITE_RODAPE}
              placeholder="Secretaria da Escola Municipal X"
              onChange={(evento) => mudar({ rodape: evento.target.value })}
            />
            <Contador atual={rascunho.rodape.length} limite={LIMITE_RODAPE} />
          </div>

          <BotoesDoModelo botoes={rascunho.botoes} aoMudar={(botoes) => mudar({ botoes })} />

          {variaveis.length > 0 ? (
            <div className="flex flex-col gap-2 rounded-xl bg-muted p-4">
              <p className="font-semibold text-corpo">Exemplos para a revisão da Meta</p>
              <p className="text-meta text-muted-foreground">
                A Meta revisa a mensagem preenchida, não o esqueleto. Sem exemplo, o modelo volta
                recusado horas depois.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {variaveis.map((nome, i) => (
                  <div key={nome} className="flex flex-col gap-1.5">
                    <Label htmlFor={`exemplo-${nome}`}>{`{{${nome}}}`}</Label>
                    <Input
                      id={`exemplo-${nome}`}
                      value={exemploDe(i)}
                      onChange={(evento) => mudarExemplo(i, evento.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {problemas.length > 0 ? (
            <Alert variant="warning">
              <TriangleAlert />
              <AlertTitle>Falta ajustar antes de mandar para a Meta</AlertTitle>
              <AlertDescription>
                <ul className="flex list-disc flex-col gap-1 pl-4">
                  {problemas.map((problema) => (
                    <li key={problema}>{problema}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button
              disabled={problemas.length > 0 || salvar.isPending}
              onClick={() =>
                salvar.mutate({
                  id: rascunho.id,
                  nome: rascunho.nome,
                  categoria: rascunho.categoria,
                  idioma: rascunho.idioma,
                  cabecalho: rascunho.cabecalho || undefined,
                  corpo: rascunho.corpo,
                  rodape: rascunho.rodape || undefined,
                  botoes: paraEntrada(rascunho.botoes),
                  exemplos: rascunho.exemplos,
                })
              }
            >
              {salvar.isPending ? "Salvando…" : "Salvar rascunho"}
            </Button>
            <Button variant="ghost" onClick={aoFechar}>
              Cancelar
            </Button>
          </div>
        </div>

        <div className="order-1 min-w-0 lg:sticky lg:top-4 lg:order-2 lg:self-start">
          <PreviaDaMensagem modelo={modelo} valores={valoresDeExemplo(modelo)} />
        </div>
      </div>
    </div>
  );
}

/** Conta caracteres e avisa antes do limite, não depois de a Meta recusar. */
function Contador({ atual, limite }: { atual: number; limite: number }) {
  const apertado = atual > limite * 0.9;
  return (
    <p className={`text-meta ${apertado ? "text-warning" : "text-muted-foreground"}`}>
      {atual} de {limite} caracteres
    </p>
  );
}

function BotoesDoModelo({
  botoes,
  aoMudar,
}: {
  botoes: Botao[];
  aoMudar: (botoes: Botao[]) => void;
}) {
  const acrescentar = (tipo: Botao["tipo"]) =>
    aoMudar([...botoes, { tipo, texto: "", ...(tipo === "link" ? { url: "" } : {}) }]);

  const mudarBotao = (i: number, patch: Partial<Botao>) =>
    aoMudar(botoes.map((botao, indice) => (indice === i ? { ...botao, ...patch } : botao)));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Label>Botões (opcional)</Label>
        <Button type="button" variant="outline" size="sm" onClick={() => acrescentar("resposta")}>
          <Reply />
          Resposta rápida
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => acrescentar("link")}>
          <ExternalLink />
          Link
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => acrescentar("telefone")}>
          <Phone />
          Telefone
        </Button>
      </div>

      {botoes.map((botao, i) => (
        <div
          // Índice na chave porque o botão não tem id e dois podem ter o mesmo
          // rótulo enquanto estão em branco.
          key={`botao-${i}-${botao.tipo}`}
          className="flex flex-wrap items-end gap-2 rounded-xl bg-muted p-3"
        >
          <div className="flex min-w-40 flex-1 flex-col gap-1.5">
            <Label htmlFor={`botao-texto-${i}`}>Rótulo</Label>
            <Input
              id={`botao-texto-${i}`}
              value={botao.texto}
              maxLength={25}
              onChange={(evento) => mudarBotao(i, { texto: evento.target.value })}
            />
          </div>

          {botao.tipo === "link" ? (
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor={`botao-url-${i}`}>Endereço</Label>
              <Input
                id={`botao-url-${i}`}
                value={botao.url ?? ""}
                placeholder="https://"
                onChange={(evento) => mudarBotao(i, { url: evento.target.value })}
              />
            </div>
          ) : null}

          {botao.tipo === "telefone" ? (
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor={`botao-tel-${i}`}>Telefone</Label>
              <Input
                id={`botao-tel-${i}`}
                value={botao.telefone ?? ""}
                placeholder="+5586998122039"
                onChange={(evento) => mudarBotao(i, { telefone: evento.target.value })}
              />
            </div>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => aoMudar(botoes.filter((_, indice) => indice !== i))}
          >
            <Trash2 />
            Remover
          </Button>
        </div>
      ))}
    </div>
  );
}
