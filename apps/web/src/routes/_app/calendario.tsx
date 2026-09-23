// `longDate` vive no pacote da API junto das outras funções de data do dia
// letivo — duplicá-la aqui abriria a porta para as duas divergirem.
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
import { SegmentedControl } from "@educa-escola/ui/integra/segmented";
import { StatCard } from "@educa-escola/ui/integra/stat-card";
import { EmptyState, ErrorState, ListSkeleton } from "@educa-escola/ui/integra/states";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CalendarCheck,
  CalendarDays,
  CalendarX,
  Download,
  List,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";
import { useState } from "react";
import { CollapsibleSection, useCollapsibleSections } from "@/components/collapsible-section";
import { DateField } from "@/components/date-field";
import { DayPanel } from "@/components/day-panel";
import { MonthCalendar } from "@/components/month-calendar";
import { type ClassroomOption, TargetField, targetOf } from "@/components/target-field";
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

/** Valor do filtro quando nada está recortado. O `Select` não aceita vazio. */
const TODAS_AS_TURMAS = "todas";

/**
 * Como a página abre na primeira visita.
 *
 * O calendário brasileiro entra recolhido porque são quarenta linhas que a
 * escola resolve uma vez em fevereiro; "novo evento" também, porque criar pelo
 * dia da grade virou o caminho principal. O que fica aberto é o que se
 * consulta: o período e a lista do ano.
 */
const SECOES_PADRAO = { period: true, brasileiro: false, novo: false, events: true };

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

  const [turmaFiltrada, setTurmaFiltrada] = useState<string>(TODAS_AS_TURMAS);
  const recorte = turmaFiltrada === TODAS_AS_TURMAS ? undefined : turmaFiltrada;

  /**
   * Só as turmas deste ano letivo.
   *
   * `classroom.list` devolve todos os anos. Oferecer a turma de 2025 num
   * evento de 2026 daria um evento que nenhuma turma em aula enxerga.
   */
  const classrooms = useQuery(trpc.classroom.list.queryOptions());
  const yearClassrooms: ClassroomOption[] = (classrooms.data ?? [])
    .filter((turma) => turma.academicYear === year)
    .map((turma) => ({ id: turma.id, name: turma.name }));

  const yearQuery = useQuery(
    trpc.calendar.year.queryOptions({ academicYear: year, classroomId: recorte }),
  );
  const recarregar = () => queryClient.invalidateQueries({ queryKey: [["calendar"]] });

  const definir = useMutation(trpc.calendar.defineYear.mutationOptions({ onSuccess: recarregar }));
  const criar = useMutation(trpc.calendar.createEvent.mutationOptions({ onSuccess: recarregar }));
  const remover = useMutation(trpc.calendar.removeEvent.mutationOptions({ onSuccess: recarregar }));
  const editar = useMutation(trpc.calendar.updateEvent.mutationOptions({ onSuccess: recarregar }));

  const sugestoes = useQuery(trpc.calendar.sugestoes.queryOptions({ academicYear: year }));
  const importar = useMutation(trpc.calendar.importar.mutationOptions({ onSuccess: recarregar }));

  /**
   * Lista e grade respondem perguntas diferentes: a lista diz "o que vem pela
   * frente", a grade diz "como é a semana do dia 16" — que é a pergunta de
   * quem monta prova e reunião. Por isso as duas, e não uma substituindo a
   * outra.
   */
  const [visao, setVisao] = useState<"lista" | "calendario">("lista");
  const [diaAberto, setDiaAberto] = useState<{
    day: string;
    intencao: "ver" | "criar";
  } | null>(null);

  const { abertas, alternar, irPara } = useCollapsibleSections(
    "integra:calendario:secoes",
    SECOES_PADRAO,
  );

  const count = yearQuery.data?.count;
  const classroomCount = yearQuery.data?.classroomCount;
  const periodoDefinido = yearQuery.data?.year ?? null;
  const events = yearQuery.data?.events ?? [];
  const nomeDaTurma = yearClassrooms.find((t) => t.id === recorte)?.name ?? null;

  /** Só as seções que existem agora: sem período letivo, metade não aparece. */
  const atalhos = [
    { id: "periodo", title: "Período letivo" },
    ...(periodoDefinido
      ? [
          { id: "brasileiro", title: "Calendário brasileiro" },
          { id: "novo", title: "Novo evento" },
        ]
      : []),
    { id: "eventos", title: "Eventos do ano" },
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <CardEyebrow>Instituição</CardEyebrow>
          <h1 className="font-extrabold text-2xl tracking-[-0.6px]">Calendário de {year}</h1>
          <p className="text-corpo text-muted-foreground">
            Período letivo, feriados e recessos — e quantos dias letivos sobram.
          </p>
        </div>

        {/*
          A barra de seções. Clicar abre a seção e rola até ela: numa página
          que recolhe, um atalho que só rolasse levaria a pessoa até um card
          fechado, e ela leria a viagem como um link quebrado.
        */}
        <div className="flex flex-wrap items-center gap-2">
          {atalhos.map((secao) => (
            <Button
              key={secao.id}
              variant="secondary"
              size="sm"
              aria-pressed={abertas[secao.id] ?? false}
              onClick={() => irPara(secao.id)}
            >
              {secao.title}
            </Button>
          ))}
          <SegmentedControl
            label="Como ver o calendário"
            apenasIcone
            options={[
              // `tone` é obrigatório no controle: ele existe para presença,
              // onde cada opção tem cor semântica. Aqui as duas são neutras —
              // trocar de visão não é estado.
              { value: "lista", label: "Ver em lista", tone: "secondary", icon: List },
              {
                value: "calendario",
                label: "Ver em grade de mês",
                tone: "secondary",
                icon: CalendarDays,
              },
            ]}
            value={visao}
            onChange={(valor) => {
              setVisao(valor as "lista" | "calendario");
              // Trocar a visão de uma seção recolhida seria mexer no que não
              // se vê. Abrir junto é o que torna o controle honesto aqui em
              // cima, longe da lista que ele governa.
              irPara("eventos");
            }}
          />
        </div>
      </div>

      {yearQuery.isLoading ? (
        <Card>
          <ListSkeleton rows={3} />
        </Card>
      ) : yearQuery.isError ? (
        <Card>
          <ErrorState
            title="Não foi possível carregar o calendário"
            description="Atualize a página em instantes."
          />
        </Card>
      ) : (
        <>
          {count ? (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                <StatCard
                  icon={CalendarCheck}
                  label="Dias letivos"
                  hint={`mínimo de ${count.minimo} (LDB, art. 24, I)`}
                  tone={count.cumpreOMinimo ? "success" : "danger"}
                >
                  {count.letivos}
                </StatCard>
                <StatCard icon={CalendarX} label="Perdidos" hint="feriado, recesso ou férias">
                  {count.perdidos}
                </StatCard>
                <StatCard icon={Plus} label="Repostos" hint="aula em dia não útil">
                  {count.repostos}
                </StatCard>
              </div>

              {/*
                Os três cartões são sempre da escola: é o número que a
                secretaria de educação cobra. O da turma vem ao lado, e não no
                lugar, porque a direção precisa dos dois — e porque um cartão
                que muda de significado conforme um filtro lá embaixo é o tipo
                de número que alguém copia para um ofício sem perceber.
              */}
              {classroomCount && nomeDaTurma ? (
                <Alert variant={classroomCount.cumpreOMinimo ? "info" : "warning"}>
                  <AlertTitle>
                    {nomeDaTurma} tem {classroomCount.letivos} dias letivos
                  </AlertTitle>
                  <AlertDescription>
                    {classroomCount.letivos === count.letivos
                      ? "Mesma contagem da escola: esta turma não tem dia próprio fora do calendário institucional."
                      : `${count.letivos - classroomCount.letivos} a menos que a escola, por eventos marcados só para ela. Os cartões acima continuam sendo o número da instituição.`}
                  </AlertDescription>
                </Alert>
              ) : null}

              {count.cumpreOMinimo ? null : (
                <Alert variant="danger">
                  <TriangleAlert size={18} strokeWidth={1.8} aria-hidden />
                  <AlertTitle>Faltam {count.faltam} dias letivos</AlertTitle>
                  <AlertDescription>
                    O ano está desenhado com {count.letivos} dias, abaixo dos {count.minimo}{" "}
                    exigidos. Estenda o período ou registre reposições — em dezembro já não dá.
                  </AlertDescription>
                </Alert>
              )}
            </>
          ) : null}

          <CollapsibleSection
            id="periodo"
            title={periodoDefinido ? "Período letivo" : "Defina o período letivo"}
            summary={
              periodoDefinido
                ? `${longDate(periodoDefinido.startsOn)} a ${longDate(periodoDefinido.endsOn)}`
                : "ainda não definido"
            }
            aberta={abertas.period ?? true}
            aoAlternar={() => alternar("periodo")}
          >
            <DefinirAno
              atual={periodoDefinido}
              year={year}
              aoSalvar={(data) => definir.mutate({ academicYear: year, ...data })}
              salvando={definir.isPending}
              error={definir.isError ? definir.error.message : null}
            />
          </CollapsibleSection>

          {periodoDefinido ? (
            <CollapsibleSection
              id="brasileiro"
              title="Calendário brasileiro"
              summary="feriados nacionais, pontos facultativos e datas da cultura e da história"
              aberta={abertas.brasileiro ?? false}
              aoAlternar={() => alternar("brasileiro")}
              acao={
                <BotaoDeImportar
                  sugestoes={sugestoes.data ?? []}
                  aoImportar={() => importar.mutate({ academicYear: year })}
                  importando={importar.isPending}
                />
              }
            >
              <CalendarioBrasileiro
                sugestoes={sugestoes.data ?? []}
                resultado={importar.data ?? null}
                error={importar.isError ? importar.error.message : null}
              />
            </CollapsibleSection>
          ) : null}

          {periodoDefinido ? (
            <CollapsibleSection
              id="novo"
              title="Novo evento"
              summary="reunião, conselho, prazo — da escola inteira ou de uma turma"
              aberta={abertas.novo ?? false}
              aoAlternar={() => alternar("novo")}
            >
              <NovoEvento
                year={year}
                period={periodoDefinido}
                classrooms={yearClassrooms}
                aoCriar={(data) => criar.mutate({ academicYear: year, ...data })}
                criando={criar.isPending}
                error={criar.isError ? criar.error.message : null}
              />
            </CollapsibleSection>
          ) : null}

          <CollapsibleSection
            id="eventos"
            title="Eventos do ano"
            summary={`${events.length} ${events.length === 1 ? "registro" : "registros"}${
              nomeDaTurma ? ` — ${nomeDaTurma} e a escola` : ""
            }`}
            aberta={abertas.events ?? true}
            aoAlternar={() => alternar("eventos")}
            acao={
              <FiltroDeTurma
                classrooms={yearClassrooms}
                valor={turmaFiltrada}
                aoMudar={setTurmaFiltrada}
              />
            }
          >
            {visao === "calendario" ? (
              <MonthCalendar
                events={events}
                year={year}
                period={periodoDefinido}
                focusedClassroom={recorte ?? null}
                onOpenDay={(day, intencao) => setDiaAberto({ day, intencao })}
              />
            ) : events.length === 0 ? (
              <EmptyState
                title={
                  nomeDaTurma ? `Nada marcado para ${nomeDaTurma}` : "Nenhum evento no calendário"
                }
                description="Feriados e recessos são o que tira dia letivo da conta acima."
              />
            ) : (
              <ul className="flex flex-col">
                {events.map((evento) => (
                  <li
                    key={evento.id}
                    className="flex flex-wrap items-center gap-3 border-border border-t py-2.5 text-corpo first:border-t-0"
                  >
                    <span className="min-w-40 text-muted-foreground">
                      {longDate(evento.startsOn)}
                      {evento.endsOn !== evento.startsOn ? ` a ${longDate(evento.endsOn)}` : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{evento.title}</span>
                    {/* Sem esta etiqueta, um conselho do 9º C e um feriado
                        nacional seriam duas linhas idênticas na lista. */}
                    {evento.classroomName ? (
                      <Badge variant="info">{evento.classroomName}</Badge>
                    ) : null}
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
          </CollapsibleSection>
        </>
      )}

      <DayPanel
        day={diaAberto?.day ?? null}
        intencao={diaAberto?.intencao ?? "ver"}
        aberto={diaAberto !== null}
        aoFechar={() => setDiaAberto(null)}
        classrooms={yearClassrooms}
        /* Criar a partir do dia herda o filtro: quem está olhando o 9º C e
           clica numa célula quer marcar para o 9º C, não para a escola. */
        defaultClassroom={recorte ?? null}
        events={events.filter(
          (evento) =>
            diaAberto !== null &&
            evento.startsOn <= diaAberto.day &&
            evento.endsOn >= diaAberto.day,
        )}
        aoCriar={(data) => criar.mutate({ academicYear: year, ...data })}
        aoApagar={(id) => remover.mutate({ id })}
        aoEditar={(data) => editar.mutate(data)}
        ocupado={criar.isPending || remover.isPending || editar.isPending}
        error={criar.isError ? criar.error.message : editar.isError ? editar.error.message : null}
      />
    </>
  );
}

/**
 * O recorte por turma.
 *
 * "Todas as turmas" e não "nenhuma": sem filtro a tela mostra a escola
 * inteira, o que inclui o que é de cada turma. É a diferença entre não
 * recortar e recortar para o vazio.
 */
function FiltroDeTurma({
  classrooms,
  valor,
  aoMudar,
}: {
  classrooms: ClassroomOption[];
  valor: string;
  aoMudar: (valor: string) => void;
}) {
  const opcoes = [
    { label: "Todas as turmas", value: TODAS_AS_TURMAS },
    ...classrooms.map((turma) => ({ label: turma.name, value: turma.id })),
  ];

  if (classrooms.length === 0) return null;

  return (
    <Select value={valor} onValueChange={(v) => aoMudar(v ?? TODAS_AS_TURMAS)} items={opcoes}>
      <SelectTrigger aria-label="Filtrar por turma" className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {opcoes.map((opcao) => (
          <SelectItem key={opcao.value} value={opcao.value}>
            {opcao.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function DefinirAno({
  atual,
  year,
  aoSalvar,
  salvando,
  error,
}: {
  atual: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  year: number;
  aoSalvar: (data: { startsOn: string; endsOn: string; minimumSchoolDays: number }) => void;
  salvando: boolean;
  error: string | null;
}) {
  const [start, setInicio] = useState(atual?.startsOn ?? `${year}-02-01`);
  const [end, setFim] = useState(atual?.endsOn ?? `${year}-12-20`);
  const [minimo, setMinimo] = useState(String(atual?.minimumSchoolDays ?? 200));

  return (
    <div className="flex flex-col gap-4">
      {atual ? null : (
        <p className="text-corpo text-muted-foreground">
          Sem o período, não há contagem de dias letivos — e um total contado a partir de janeiro
          seria plausível e errado.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <DateField
          id="inicio-do-ano"
          label="Início"
          value={start}
          onChange={(iso) => setInicio(iso ?? "")}
        />
        <DateField id="fim-do-ano" label="Fim" value={end} onChange={(iso) => setFim(iso ?? "")} />
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
              startsOn: start,
              endsOn: end,
              minimumSchoolDays: Number(minimo) || 200,
            })
          }
          disabled={salvando}
        >
          {salvando ? "Salvando…" : atual ? "Atualizar" : "Definir"}
        </Button>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

function NovoEvento({
  year,
  period,
  classrooms,
  aoCriar,
  criando,
  error,
}: {
  year: number;
  period: { startsOn: string; endsOn: string } | null;
  classrooms: ClassroomOption[];
  aoCriar: (data: {
    type: EventType;
    dayEffect: "nenhum" | "nao_letivo" | "letivo_extra";
    title: string;
    startsOn: string;
    endsOn?: string;
    scope: EventScope;
    classroomId?: string;
  }) => void;
  criando: boolean;
  error: string | null;
}) {
  const [tipo, setTipo] = useState<EventType>("feriado");
  const [title, setTitulo] = useState("");
  const [start, setInicio] = useState(`${year}-09-07`);
  const [end, setFim] = useState("");
  const [classroomId, setTurmaId] = useState<string | null>(null);

  const tipos = EVENT_TYPES.map((t) => ({ label: EVENT_TYPE_LABEL[t], value: t }));

  return (
    <div className="flex flex-col gap-4">
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
            value={title}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Independência do Brasil"
            maxLength={120}
          />
        </div>
        {classrooms.length > 0 ? (
          <TargetField
            id="alvo-do-evento"
            classrooms={classrooms}
            valor={classroomId}
            aoMudar={setTurmaId}
          />
        ) : null}
        {/* O intervalo vem do ano letivo: a pessoa vê que 05/01 está fora
            antes de clicar, em vez de descobrir pela recusa do servidor. */}
        <DateField
          id="inicio-do-evento"
          label="Início"
          value={start}
          onChange={(iso) => setInicio(iso ?? "")}
          min={period?.startsOn}
          max={period?.endsOn}
        />
        <DateField
          id="fim-do-evento"
          label="Fim (opcional)"
          value={end}
          onChange={(iso) => setFim(iso ?? "")}
          min={period?.startsOn}
          max={period?.endsOn}
        />
        <Button
          variant="secondary"
          onClick={() =>
            aoCriar({
              type: tipo,
              // O efeito vem do tipo como sugestão. Feriado em sábado não tira
              // dia letivo, e a contagem já sabe disso.
              dayEffect: SUGGESTED_EFFECT[tipo],
              title: title,
              startsOn: start,
              endsOn: end || undefined,
              ...targetOf(classroomId),
            })
          }
          disabled={criando || title.trim().length < 2}
        >
          <Plus size={18} strokeWidth={1.8} aria-hidden />
          Acrescentar
        </Button>
      </div>

      <p className="text-meta text-muted-foreground">
        {EVENT_TYPE_LABEL[tipo]} entra como “{EFEITO_LABEL[SUGGESTED_EFFECT[tipo]].toLowerCase()}”
        {classroomId
          ? ", e só conta os dias letivos da turma escolhida."
          : ", valendo para a escola inteira."}
      </p>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível criar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

type Sugestao = {
  title: string;
  startsOn: string;
  endsOn: string;
  dayEffect: string;
  fonte: string;
  jaExiste: boolean;
  outsidePeriod: boolean;
};

/** O que realmente entraria numa importação agora. */
const aImportar = (sugestoes: Sugestao[]) =>
  sugestoes.filter((s) => !s.jaExiste && !s.outsidePeriod);

/**
 * Fica no cabeçalho da seção, e não dentro dela.
 *
 * É o único botão da página que a pessoa procura **sem** querer ler a lista:
 * com a seção recolhida, "Trazer 12 datas" continua a um clique, e o número
 * continua dizendo quanto vai entrar.
 */
function BotaoDeImportar({
  sugestoes,
  aoImportar,
  importando,
}: {
  sugestoes: Sugestao[];
  aoImportar: () => void;
  importando: boolean;
}) {
  const novas = aImportar(sugestoes);

  return (
    <Button variant="secondary" onClick={aoImportar} disabled={importando || novas.length === 0}>
      <Download size={18} strokeWidth={1.8} aria-hidden />
      {importando
        ? "Importando…"
        : novas.length === 0
          ? "Tudo já está no calendário"
          : `Trazer ${novas.length} datas`}
    </Button>
  );
}

/**
 * O calendário brasileiro do ano, para importar de uma vez.
 *
 * A lista aparece **antes** do clique: confirmar a importação de quarenta
 * linhas às cegas é o tipo de coisa de que a pessoa se arrepende. O que já
 * está no sistema e o que cai fora do ano letivo vêm marcados, para o número
 * do botão ser o número que vai entrar de verdade.
 */
function CalendarioBrasileiro({
  sugestoes,
  resultado,
  error,
}: {
  sugestoes: Sugestao[];
  resultado: { criados: number; jaExistiam: number; outsidePeriod: number } | null;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      {resultado ? (
        <Alert variant="success">
          <AlertTitle>{resultado.criados} datas acrescentadas</AlertTitle>
          <AlertDescription>
            {resultado.jaExistiam > 0 ? `${resultado.jaExistiam} já estavam no calendário. ` : ""}
            {resultado.outsidePeriod > 0
              ? `${resultado.outsidePeriod} ficaram de fora por caírem fora do ano letivo — 1º de janeiro e Natal costumam cair aí.`
              : ""}
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Não foi possível importar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <ul className="flex flex-col">
        {sugestoes.map((data) => (
          <li
            key={`${data.startsOn}-${data.title}`}
            className="flex flex-wrap items-center gap-3 border-border border-t py-2 text-apoio first:border-t-0"
          >
            <span className="min-w-36 text-muted-foreground">
              {longDate(data.startsOn)}
              {data.endsOn !== data.startsOn ? ` a ${longDate(data.endsOn)}` : null}
            </span>
            <span className="min-w-0 flex-1 truncate font-bold">{data.title}</span>
            {/* A origem fica na tela: data sem origem é data que ninguém
                confere, e metade desta lista vem de lei. */}
            <span className="hidden text-meta text-muted-foreground sm:block">{data.fonte}</span>
            {data.dayEffect === "nao_letivo" ? (
              <Badge variant="warning">Não letivo</Badge>
            ) : (
              <Badge variant="secondary">Tem aula</Badge>
            )}
            {data.jaExiste ? (
              <Badge variant="success">Já está</Badge>
            ) : data.outsidePeriod ? (
              <Badge variant="secondary">Fora do ano letivo</Badge>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
