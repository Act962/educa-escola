import { variaveisDoModelo } from "@educa-escola/api/messaging/whatsapp/template";
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
import { EmptyState } from "@educa-escola/ui/integra/states";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Send } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { dateTimeText, phoneText } from "@/lib/format";
import { type RouterOutputs, useTRPC } from "@/utils/trpc";

type Visao = RouterOutputs["whatsapp"]["visao"];

/**
 * Mandar um modelo para um número, e o histórico do que saiu.
 *
 * O envio de teste não é enfeite de desenvolvimento: é o passo que prova, com
 * uma mensagem só, que credencial, modelo aprovado e variáveis estão certos —
 * antes de a escola disparar para trezentas famílias na fase seguinte.
 */
export function EnviosDoWhatsApp({ visao }: { visao: Visao }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const aprovados = visao.modelos.filter((m) => m.status === "aprovado");
  const [templateId, setTemplateId] = useState(aprovados[0]?.id ?? "");
  const [para, setPara] = useState("");
  const [valores, setValores] = useState<Record<string, string>>({});

  const escolhido = visao.modelos.find((m) => m.id === templateId) ?? null;
  const variaveis = escolhido
    ? variaveisDoModelo({
        nome: escolhido.nome,
        categoria: escolhido.categoria,
        idioma: escolhido.idioma,
        cabecalho: escolhido.cabecalho,
        corpo: escolhido.corpo,
        rodape: escolhido.rodape,
        botoes: escolhido.botoes,
        exemplos: escolhido.exemplos,
      })
    : [];

  const enviar = useMutation(
    trpc.whatsapp.enviarTeste.mutationOptions({
      onSuccess: async () => {
        toast.success(
          visao.simulacao
            ? "Registrado em simulação — nenhuma mensagem saiu."
            : "Mensagem enviada.",
        );
        await queryClient.invalidateQueries({ queryKey: [["whatsapp"]] });
      },
      onError: async (error) => {
        toast.error(error.message);
        // A falha virou linha no histórico: sem recarregar, quem clicou em
        // enviar veria o aviso sumir e a lista continuar vazia — que é a pior
        // resposta possível para quem não sabe se a mensagem saiu.
        await queryClient.invalidateQueries({ queryKey: [["whatsapp"]] });
      },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h3 className="font-extrabold text-lg tracking-[-0.3px]">Enviar um teste</h3>

        {aprovados.length === 0 ? (
          <Alert>
            <Clock />
            <AlertTitle>Nenhum modelo aprovado ainda</AlertTitle>
            <AlertDescription>
              Na API oficial, conversa só começa por modelo aprovado. Crie um em Modelos e mande
              para aprovação — a Meta responde em minutos ou horas.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="envio-modelo">Modelo</Label>
                <Select
                  value={templateId}
                  onValueChange={(valor) => setTemplateId(valor ?? "")}
                  items={aprovados.map((m) => ({ value: m.id, label: m.nome }))}
                >
                  <SelectTrigger id="envio-modelo" className="w-full">
                    <SelectValue placeholder="Escolha o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {aprovados.map((modelo) => (
                      <SelectItem key={modelo.id} value={modelo.id}>
                        {modelo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="envio-para">Número de destino</Label>
                <Input
                  id="envio-para"
                  inputMode="tel"
                  placeholder="(86) 99812-2039"
                  value={para}
                  onChange={(evento) => setPara(evento.target.value)}
                />
                <p className="text-meta text-muted-foreground">
                  Com DDD. Número de fora do Brasil precisa do código do país.
                </p>
              </div>
            </div>

            {variaveis.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {variaveis.map((nome) => (
                  <div key={nome} className="flex flex-col gap-1.5">
                    <Label htmlFor={`valor-${nome}`}>{`{{${nome}}}`}</Label>
                    <Input
                      id={`valor-${nome}`}
                      placeholder="Em branco usa o exemplo do modelo"
                      value={valores[nome] ?? ""}
                      onChange={(evento) => setValores({ ...valores, [nome]: evento.target.value })}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <div>
              <Button
                disabled={!templateId || !para || enviar.isPending}
                onClick={() => enviar.mutate({ templateId, para, valores })}
              >
                <Send />
                {enviar.isPending ? "Enviando…" : "Enviar"}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="font-extrabold text-lg tracking-[-0.3px]">Últimos envios</h3>

        {visao.mensagens.length === 0 ? (
          <EmptyState
            title="Nada foi enviado ainda"
            description="O que sair por este número aparece aqui, com o texto exato que a família recebeu."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {visao.mensagens.map((mensagem) => (
              <div key={mensagem.id} className="flex flex-col gap-2 rounded-xl bg-muted p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={mensagem.status === "falhou" ? "danger" : "success"}>
                    {mensagem.status === "falhou" ? "Falhou" : "Enviado"}
                  </Badge>
                  <span className="text-corpo">{phoneText(mensagem.para)}</span>
                  <span className="text-meta text-muted-foreground">
                    · {dateTimeText(mensagem.em)}
                  </span>
                </div>

                {/* O texto exato que saiu. É o que responde "o que foi mandado
                    para essa família" quando aparece uma reclamação. */}
                <p className="whitespace-pre-wrap text-corpo text-muted-foreground">
                  {mensagem.texto}
                </p>

                {mensagem.erro ? <p className="text-danger text-meta">{mensagem.erro}</p> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
