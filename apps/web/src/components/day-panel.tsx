import { longDate } from "@educa-escola/api/dates";
import {
  EVENT_TYPE_LABEL,
  EVENT_TYPES,
  type EventScope,
  type EventType,
  SUGGESTED_EFFECT,
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
import { Check, Pencil, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { DateField } from "@/components/date-field";
import { type ClassroomOption, TargetField, targetOf } from "@/components/target-field";

export interface DayEvent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  dayEffect: string;
  startsOn: string;
  endsOn: string;
  /** `null` quando o evento é da escola inteira. */
  classroomId: string | null;
  classroomName: string | null;
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
export function DayPanel({
  dia,
  intencao,
  eventos,
  turmas,
  turmaPadrao,
  aberto,
  aoFechar,
  aoCriar,
  aoApagar,
  aoEditar,
  ocupado,
  erro,
}: {
  /** ISO do dia, ou `null` quando nada está aberto. */
  dia: string | null;
  intencao: "ver" | "criar";
  eventos: DayEvent[];
  turmas: ClassroomOption[];
  /** Turma já escolhida no filtro da tela. `null` é a escola inteira. */
  turmaPadrao: string | null;
  aberto: boolean;
  aoFechar: () => void;
  aoCriar: (dados: {
    type: EventType;
    dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
    title: string;
    startsOn: string;
    endsOn?: string;
    scope: EventScope;
    classroomId?: string;
  }) => void;
  aoApagar: (id: string) => void;
  aoEditar: (dados: {
    id: string;
    type: EventType;
    dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
    title: string;
    startsOn: string;
    endsOn?: string;
    scope: EventScope;
    classroomId?: string;
  }) => void;
  ocupado: boolean;
  erro: string | null;
}) {
  const [tipo, setTipo] = useState<EventType>("evento");
  const [titulo, setTitulo] = useState("");
  const [fim, setFim] = useState("");
  const [turmaId, setTurmaId] = useState<string | null>(turmaPadrao);
  const campoTitulo = useRef<HTMLInputElement>(null);
  const [editando, setEditando] = useState<{
    id: string;
    title: string;
    type: EventType;
    endsOn: string;
    turmaId: string | null;
  } | null>(null);

  // Cada dia começa com o formulário limpo: reaproveitar o que sobrou do dia
  // anterior faria a pessoa criar "Reunião de pais" na data errada. O alvo é a
  // exceção: ele volta ao filtro da tela, que é o contexto em que a pessoa
  // está olhando — não ao padrão do componente.
  useEffect(() => {
    setTitulo("");
    setFim("");
    setTipo("evento");
    setTurmaId(turmaPadrao);
    setEditando(null);
  }, [dia, turmaPadrao]);

  const tipos = EVENT_TYPES.map((t) => ({ label: EVENT_TYPE_LABEL[t], value: t }));

  useEffect(() => {
    if (aberto && intencao === "criar") {
      const t = setTimeout(() => campoTitulo.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [aberto, intencao]);

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
                  {editando?.id === evento.id ? (
                    <div className="flex flex-col gap-2">
                      <Input
                        value={editando.title}
                        onChange={(e) => setEditando({ ...editando, title: e.target.value })}
                        maxLength={120}
                        aria-label={`Novo título de ${evento.title}`}
                      />
                      <Select
                        value={editando.type}
                        onValueChange={(valor) =>
                          setEditando({ ...editando, type: (valor as EventType) ?? editando.type })
                        }
                        items={tipos}
                      >
                        <SelectTrigger aria-label="Tipo do evento">
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
                      {turmas.length > 0 ? (
                        <TargetField
                          id={`alvo-${evento.id}`}
                          turmas={turmas}
                          valor={editando.turmaId}
                          aoMudar={(id) => setEditando({ ...editando, turmaId: id })}
                        />
                      ) : null}
                      <DateField
                        id={`fim-${evento.id}`}
                        label="Termina em"
                        value={editando.endsOn}
                        onChange={(iso) => setEditando({ ...editando, endsOn: iso ?? "" })}
                        min={evento.startsOn}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => {
                            aoEditar({
                              id: evento.id,
                              type: editando.type,
                              // O efeito segue o tipo escolhido, como na
                              // criação: trocar "evento" por "recesso" e o dia
                              // continuar letivo seria a edição mentindo.
                              dayEffect: SUGGESTED_EFFECT[editando.type],
                              title: editando.title,
                              startsOn: evento.startsOn,
                              endsOn: editando.endsOn || undefined,
                              ...targetOf(editando.turmaId),
                            });
                            setEditando(null);
                          }}
                          disabled={ocupado || editando.title.trim().length < 2}
                        >
                          <Check size={16} strokeWidth={1.8} aria-hidden />
                          Salvar
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditando(null)}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 font-bold text-corpo">{evento.title}</span>
                      {/* Sem isto, o conselho do 9º C e o feriado nacional
                          seriam duas linhas iguais dentro do mesmo dia. */}
                      {evento.classroomName ? (
                        <Badge variant="info">{evento.classroomName}</Badge>
                      ) : null}
                      <Badge variant="secondary">
                        {EVENT_TYPE_LABEL[evento.type as EventType] ?? evento.type}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${evento.title}`}
                        onClick={() =>
                          setEditando({
                            id: evento.id,
                            title: evento.title,
                            type: evento.type as EventType,
                            endsOn: evento.endsOn === evento.startsOn ? "" : evento.endsOn,
                            turmaId: evento.classroomId,
                          })
                        }
                        disabled={ocupado}
                      >
                        <Pencil size={16} strokeWidth={1.8} aria-hidden />
                      </Button>
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
                  )}

                  {evento.endsOn !== evento.startsOn ? (
                    <p className="text-meta text-muted-foreground">
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
                    <p className="text-meta text-muted-foreground">{evento.description}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3 border-border border-t pt-5">
          <p className="font-bold text-meta text-muted-foreground uppercase tracking-wide">
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

          {turmas.length > 0 ? (
            <TargetField id="alvo-do-dia" turmas={turmas} valor={turmaId} aoMudar={setTurmaId} />
          ) : null}

          <DateField
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
                dayEffect: SUGGESTED_EFFECT[tipo],
                title: titulo,
                startsOn: dia,
                endsOn: fim || undefined,
                ...targetOf(turmaId),
              })
            }
            disabled={ocupado || titulo.trim().length < 2 || !dia}
          >
            <Plus size={18} strokeWidth={1.8} aria-hidden />
            {ocupado ? "Salvando…" : "Marcar"}
          </Button>

          <p className="text-meta text-muted-foreground">
            {EVENT_TYPE_LABEL[tipo]} entra como “
            {EFEITO_LABEL[SUGGESTED_EFFECT[tipo]].toLowerCase()}
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
