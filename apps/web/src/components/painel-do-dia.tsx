import { longDate } from "@educa-escola/api/dates";
import {
  EFEITO_SUGERIDO,
  EVENT_TYPE_LABEL,
  EVENT_TYPES,
  type EventType,
} from "@educa-escola/api/modules/calendar/schema";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@educa-escola/ui/components/sheet";
import { EmptyState } from "@educa-escola/ui/integra/states";
import { Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { CampoDeData } from "@/components/campo-de-data";

export interface EventoDoDia {
  id: string;
  title: string;
  description: string | null;
  type: string;
  dayEffect: string;
  startsOn: string;
  endsOn: string;
}

const EFEITO_LABEL = {
  nenhum: "Não mexe na contagem",
  nao_letivo: "Dia não letivo",
  letivo_extra: "Dia letivo extra",
} as const;

/**
 * O painel de um dia do calendário.
 *
 * **Um painel só para ver e para criar.** Clicar no número do dia e clicar no
 * espaço vazio da célula são gestos a milímetros um do outro; mandar cada um
 * para uma tela diferente faria a pessoa acertar o painel errado o tempo
 * todo. O que muda é o foco: vindo de "criar", o cursor já está no título.
 */
export function PainelDoDia({
  dia,
  intencao,
  eventos,
  aberto,
  aoFechar,
  aoCriar,
  aoApagar,
  ocupado,
  erro,
}: {
  /** ISO do dia, ou `null` quando nada está aberto. */
  dia: string | null;
  intencao: "ver" | "criar";
  eventos: EventoDoDia[];
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (dados: {
    type: EventType;
    dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
    title: string;
    startsOn: string;
    endsOn?: string;
  }) => void;
  aoApagar: (id: string) => void;
  ocupado: boolean;
  erro: string | null;
}) {
  const [tipo, setTipo] = useState<EventType>("evento");
  const [titulo, setTitulo] = useState("");
  const [fim, setFim] = useState("");
  const campoTitulo = useRef<HTMLInputElement>(null);

  // Cada dia começa com o formulário limpo: reaproveitar o que sobrou do dia
  // anterior faria a pessoa criar "Reunião de pais" na data errada.
  useEffect(() => {
    setTitulo("");
    setFim("");
    setTipo("evento");
  }, [dia]);

  useEffect(() => {
    if (aberto && intencao === "criar") {
      const t = setTimeout(() => campoTitulo.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [aberto, intencao]);

  const tipos = EVENT_TYPES.map((t) => ({ label: EVENT_TYPE_LABEL[t], value: t }));

  return (
    <Sheet open={aberto} onOpenChange={(estado) => (estado ? null : aoFechar())}>
      <SheetContent className="gap-0 overflow-y-auto p-5 sm:max-w-md">
        <SheetHeader className="p-0">
          {/* `capitalize` põe maiúscula em toda palavra: "Segunda-Feira, 7 De
              Setembro". Só a primeira letra da frase. */}
          <SheetTitle className="font-extrabold text-lg first-letter:uppercase">
            {dia ? longDate(dia) : ""}
          </SheetTitle>
          <SheetDescription>
            {eventos.length === 0
              ? "Nada marcado neste dia."
              : `${eventos.length} ${eventos.length === 1 ? "registro" : "registros"} neste dia.`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-5 flex flex-col gap-3">
          {eventos.length === 0 ? (
            <EmptyState
              title="Dia livre"
              description="Marque aqui uma reunião, um prazo de matrícula ou um lembrete."
            />
          ) : (
            <ul className="flex flex-col">
              {eventos.map((evento) => (
                <li
                  key={evento.id}
                  className="flex flex-col gap-1.5 border-border border-t py-3 first:border-t-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 flex-1 font-bold text-[13px]">{evento.title}</span>
                    <Badge variant="secondary">
                      {EVENT_TYPE_LABEL[evento.type as EventType] ?? evento.type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Apagar ${evento.title}`}
                      onClick={() => aoApagar(evento.id)}
                      disabled={ocupado}
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                  </div>

                  {evento.endsOn !== evento.startsOn ? (
                    <p className="text-[11px] text-muted-foreground">
                      De {longDate(evento.startsOn)} a {longDate(evento.endsOn)}
                    </p>
                  ) : null}

                  {evento.dayEffect !== "nenhum" ? (
                    <Badge
                      variant={evento.dayEffect === "nao_letivo" ? "warning" : "success"}
                      className="w-fit"
                    >
                      {EFEITO_LABEL[evento.dayEffect as keyof typeof EFEITO_LABEL]}
                    </Badge>
                  ) : null}

                  {/* A origem é o que o calendário brasileiro deixou: a lei
                      que cria o feriado, ou a nota de quem marcou. */}
                  {evento.description ? (
                    <p className="text-[11px] text-muted-foreground">{evento.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-border border-t pt-5">
          <p className="font-bold text-[11px] text-muted-foreground uppercase tracking-wide">
            Marcar neste dia
          </p>

          <div className="flex flex-col gap-2">
            <Label htmlFor="titulo-do-dia">O quê</Label>
            <Input
              id="titulo-do-dia"
              ref={campoTitulo}
              value={titulo}
              onChange={(evento) => setTitulo(evento.target.value)}
              placeholder="Reunião de pais do 3º bimestre"
              maxLength={120}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="tipo-do-dia">Tipo</Label>
            <Select
              value={tipo}
              onValueChange={(valor) => setTipo((valor as EventType) ?? "evento")}
              items={tipos}
            >
              <SelectTrigger id="tipo-do-dia">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tipos.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CampoDeData
            id="fim-do-dia"
            label="Termina em (opcional)"
            value={fim}
            onChange={(iso) => setFim(iso ?? "")}
            hint="Deixe em branco para um dia só."
            min={dia ?? undefined}
          />

          <Button
            onClick={() =>
              dia &&
              aoCriar({
                type: tipo,
                dayEffect: EFEITO_SUGERIDO[tipo],
                title: titulo,
                startsOn: dia,
                endsOn: fim || undefined,
              })
            }
            disabled={ocupado || titulo.trim().length < 2 || !dia}
          >
            <Plus size={18} strokeWidth={1.8} aria-hidden />
            {ocupado ? "Salvando…" : "Marcar"}
          </Button>

          <p className="text-[11px] text-muted-foreground">
            {EVENT_TYPE_LABEL[tipo]} entra como “{EFEITO_LABEL[EFEITO_SUGERIDO[tipo]].toLowerCase()}
            ”.
          </p>

          {erro ? (
            <Alert variant="danger">
              <AlertTitle>Não foi possível marcar</AlertTitle>
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
