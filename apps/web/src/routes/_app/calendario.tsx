// `longDate` vive no pacote da API junto das outras funções de data do dia
// letivo — duplicá-la aqui abriria a porta para as duas divergirem.
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
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarCheck, CalendarX, Plus, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { CampoDeData } from "@/components/campo-de-data";
import { useSchoolContext } from "@/lib/school-context";
import { useTRPC } from "@/utils/trpc";

export const Route = createFileRoute("/_app/calendario")({
  component: Calendario,
});

const EFEITO_LABEL = {
  nenhum: "Não mexe na contagem",
  nao_letivo: "Dia não letivo",
  letivo_extra: "Dia letivo extra",
} as const;

/**
 * Calendário escolar e a contagem de dias letivos.
 *
 * O número que manda na tela é **dias letivos contra o mínimo legal** (LDB,
 * art. 24, I: 200 dias). É a mesma natureza da frequência mínima de 75%:
 * obrigação legal que a escola precisa enxergar antes de dezembro, quando já
 * não dá para repor.
 */
function Calendario() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { year } = useSchoolContext();

  const ano = useQuery(trpc.calendar.year.queryOptions({ academicYear: year }));
  const recarregar = () => queryClient.invalidateQueries({ queryKey: [["calendar"]] });

  const definir = useMutation(trpc.calendar.defineYear.mutationOptions({ onSuccess: recarregar }));
  const criar = useMutation(trpc.calendar.createEvent.mutationOptions({ onSuccess: recarregar }));
  const remover = useMutation(trpc.calendar.removeEvent.mutationOptions({ onSuccess: recarregar }));

  const contagem = ano.data?.contagem;

  return (
    <>
      <div className="flex flex-col gap-1">
        <CardEyebrow>Instituição</CardEyebrow>
        <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Calendário de {year}</h1>
        <p className="text-[13px] text-muted-foreground">
          Período letivo, feriados e recessos — e quantos dias letivos sobram.
        </p>
      </div>

      {ano.isLoading ? (
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      ) : ano.isError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar o calendário"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : (
        <>
          {contagem ? (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  icon={CalendarCheck}
                  label="Dias letivos"
                  hint={`mínimo de ${contagem.minimo} (LDB, art. 24, I)`}
                  tone={contagem.cumpreOMinimo ? "success" : "danger"}
                >
                  {contagem.letivos}
                </StatCard>
                <StatCard icon={CalendarX} label="Perdidos" hint="feriado, recesso ou férias">
                  {contagem.perdidos}
                </StatCard>
                <StatCard icon={Plus} label="Repostos" hint="aula em dia não útil">
                  {contagem.repostos}
                </StatCard>
              </div>

              {contagem.cumpreOMinimo ? null : (
                <Alert variant="danger">
                  <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
                  <AlertTitle>Faltam {contagem.faltam} dias letivos</AlertTitle>
                  <AlertDescription>
                    O ano está desenhado com {contagem.letivos} dias, abaixo dos {contagem.minimo}{" "}
                    exigidos. Estenda o período ou registre reposições — em dezembro já não dá.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}

          <DefinirAno
            atual={ano.data?.ano ?? null}
            ano={year}
            aoSalvar={(dados) => definir.mutate({ academicYear: year, ...dados })}
            salvando={definir.isPending}
            erro={definir.isError ? definir.error.message : null}
          />

          {ano.data?.ano ? (
            <NovoEvento
              ano={year}
              periodo={ano.data.ano}
              aoCriar={(dados) => criar.mutate({ academicYear: year, ...dados })}
              criando={criar.isPending}
              erro={criar.isError ? criar.error.message : null}
            />
          ) : null}

          <Card className="flex flex-col gap-3">
            <CardEyebrow>Eventos do ano</CardEyebrow>
            {ano.data?.eventos.length === 0 ? (
              <EmptyState
                title="Nenhum evento no calendário"
                description="Feriados e recessos são o que tira dia letivo da conta acima."
              />
            ) : (
              <ul className="flex flex-col">
                {ano.data?.eventos.map((evento) => (
                  <li
                    key={evento.id}
                    className="flex flex-wrap items-center gap-3 border-border border-t py-2.5 text-[13px] first:border-t-0"
                  >
                    <span className="min-w-40 text-muted-foreground">
                      {longDate(evento.startsOn)}
                      {evento.endsOn !== evento.startsOn ? ` a ${longDate(evento.endsOn)}` : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{evento.title}</span>
                    <Badge variant="secondary">{EVENT_TYPE_LABEL[evento.type]}</Badge>
                    {evento.dayEffect !== "nenhum" ? (
                      <Badge variant={evento.dayEffect === "nao_letivo" ? "warning" : "success"}>
                        {EFEITO_LABEL[evento.dayEffect]}
                      </Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Apagar ${evento.title}`}
                      onClick={() => remover.mutate({ id: evento.id })}
                      disabled={remover.isPending}
                    >
                      <X size={16} strokeWidth={1.8} aria-hidden />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}

function DefinirAno({
  atual,
  ano,
  aoSalvar,
  salvando,
  erro,
}: {
  atual: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  ano: number;
  aoSalvar: (dados: { startsOn: string; endsOn: string; minimumSchoolDays: number }) => void;
  salvando: boolean;
  erro: string | null;
}) {
  const [inicio, setInicio] = useState(atual?.startsOn ?? `${ano}-02-01`);
  const [fim, setFim] = useState(atual?.endsOn ?? `${ano}-12-20`);
  const [minimo, setMinimo] = useState(String(atual?.minimumSchoolDays ?? 200));

  return (
    <Card className="flex flex-col gap-4">
      <CardEyebrow>{atual ? "Período letivo" : "Defina o período letivo"}</CardEyebrow>

      {atual ? null : (
        <p className="text-[13px] text-muted-foreground">
          Sem o período, não há contagem de dias letivos — e um total contado a partir de janeiro
          seria plausível e errado.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <CampoDeData
          id="inicio-do-ano"
          label="Início"
          value={inicio}
          onChange={(iso) => setInicio(iso ?? "")}
        />
        <CampoDeData
          id="fim-do-ano"
          label="Fim"
          value={fim}
          onChange={(iso) => setFim(iso ?? "")}
        />
        <div className="flex w-36 flex-col gap-2">
          <Label htmlFor="minimo-de-dias">Mínimo de dias</Label>
          <Input
            id="minimo-de-dias"
            type="number"
            min={1}
            max={365}
            value={minimo}
            onChange={(e) => setMinimo(e.target.value)}
          />
        </div>
        <Button
          onClick={() =>
            aoSalvar({
              startsOn: inicio,
              endsOn: fim,
              minimumSchoolDays: Number(minimo) || 200,
            })
          }
          disabled={salvando}
        >
          {salvando ? "Salvando…" : atual ? "Atualizar" : "Definir"}
        </Button>
      </div>

      {erro ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}

function NovoEvento({
  ano,
  periodo,
  aoCriar,
  criando,
  erro,
}: {
  ano: number;
  periodo: { startsOn: string; endsOn: string } | null;
  aoCriar: (dados: {
    type: EventType;
    dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
    title: string;
    startsOn: string;
    endsOn?: string;
  }) => void;
  criando: boolean;
  erro: string | null;
}) {
  const [tipo, setTipo] = useState<EventType>("feriado");
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState(`${ano}-09-07`);
  const [fim, setFim] = useState("");

  const tipos = EVENT_TYPES.map((t) => ({ label: EVENT_TYPE_LABEL[t], value: t }));

  return (
    <Card className="flex flex-col gap-4">
      <CardEyebrow>Novo evento</CardEyebrow>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-44 flex-col gap-2">
          <Label htmlFor="tipo-do-evento">Tipo</Label>
          <Select
            value={tipo}
            onValueChange={(valor) => setTipo((valor as EventType) ?? "feriado")}
            items={tipos}
          >
            <SelectTrigger id="tipo-do-evento">
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
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <Label htmlFor="titulo-do-evento">Título</Label>
          <Input
            id="titulo-do-evento"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Independência do Brasil"
            maxLength={120}
          />
        </div>
        {/* O intervalo vem do ano letivo: a pessoa vê que 05/01 está fora
            antes de clicar, em vez de descobrir pela recusa do servidor. */}
        <CampoDeData
          id="inicio-do-evento"
          label="Início"
          value={inicio}
          onChange={(iso) => setInicio(iso ?? "")}
          min={periodo?.startsOn}
          max={periodo?.endsOn}
        />
        <CampoDeData
          id="fim-do-evento"
          label="Fim (opcional)"
          value={fim}
          onChange={(iso) => setFim(iso ?? "")}
          min={periodo?.startsOn}
          max={periodo?.endsOn}
        />
        <Button
          variant="secondary"
          onClick={() =>
            aoCriar({
              type: tipo,
              // O efeito vem do tipo como sugestão. Feriado em sábado não tira
              // dia letivo, e a contagem já sabe disso.
              dayEffect: EFEITO_SUGERIDO[tipo],
              title: titulo,
              startsOn: inicio,
              endsOn: fim || undefined,
            })
          }
          disabled={criando || titulo.trim().length < 2}
        >
          <Plus size={18} strokeWidth={1.8} aria-hidden />
          Acrescentar
        </Button>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {EVENT_TYPE_LABEL[tipo]} entra como “{EFEITO_LABEL[EFEITO_SUGERIDO[tipo]].toLowerCase()}”.
      </p>

      {erro ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível criar</AlertTitle>
          <AlertDescription>{erro}</AlertDescription>
        </Alert>
      ) : null}
    </Card>
  );
}
