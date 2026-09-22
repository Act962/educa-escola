import { somarDias } from "@educa-escola/api/modules/calendar/feriados";
import { EVENT_TYPE_LABEL, type EventType } from "@educa-escola/api/modules/calendar/schema";
import { Button } from "@educa-escola/ui/components/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

/** Domingo a sábado, como o mês começa em toda parede de escola. */
const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] as const;

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

/** Quantos eventos cabem na célula antes de virar "+N". */
const MAX_VISIVEL = 3;

export interface EventoDoCalendario {
  id: string;
  title: string;
  type: string;
  dayEffect: string;
  startsOn: string;
  endsOn: string;
  /** `null` quando o evento é da escola inteira. */
  classroomId: string | null;
  classroomName: string | null;
}

/** Primeiro dia do mês de uma data civil, em ISO. */
function inicioDoMes(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function partes(iso: string) {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return { ano: ano ?? 1970, mes: mes ?? 1, dia: dia ?? 1 };
}

/** Dia da semana (0 domingo). Meio-dia UTC: o dia nunca vira por fuso. */
function diaDaSemana(iso: string): number {
  const { ano, mes, dia } = partes(iso);
  return new Date(Date.UTC(ano, mes - 1, dia, 12)).getUTCDay();
}

/**
 * As 42 células do mês: seis semanas completas, começando no domingo.
 *
 * Seis linhas fixas e não "quantas couberem": uma grade que muda de altura
 * conforme o mês faz a página pular a cada navegação, e o olho perde o lugar.
 */
export function celulasDoMes(mes: string): string[] {
  const primeiro = inicioDoMes(mes);
  const inicio = somarDias(primeiro, -diaDaSemana(primeiro));
  return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
}

/**
 * Espalha cada evento por todos os dias que ele ocupa.
 *
 * Evento de vários dias — Carnaval, recesso de julho — precisa aparecer em
 * cada célula, e não só na primeira: um recesso de duas semanas que só marca
 * a segunda-feira faz a escola achar que tem aula na terça.
 */
export function eventosPorDia(eventos: EventoDoCalendario[]): Map<string, EventoDoCalendario[]> {
  const mapa = new Map<string, EventoDoCalendario[]>();

  for (const evento of eventos) {
    let dia = evento.startsOn;
    // Guarda contra intervalo invertido: sem ele, um `endsOn` anterior ao
    // `startsOn` giraria para sempre e travaria a aba.
    let volta = 0;
    while (dia <= evento.endsOn && volta < 400) {
      const doDia = mapa.get(dia);
      if (doDia) doDia.push(evento);
      else mapa.set(dia, [evento]);
      dia = somarDias(dia, 1);
      volta += 1;
    }
  }

  return mapa;
}

/**
 * O calendário em grade de mês.
 *
 * Complementa a lista, não a substitui: a lista responde "o que vem pela
 * frente", a grade responde "como é a semana do dia 16" — que é a pergunta
 * de quem monta prova e reunião.
 */
export function CalendarioMes({
  eventos,
  ano,
  periodo,
  aoAbrirDia,
  turmaEmFoco = null,
}: {
  eventos: EventoDoCalendario[];
  ano: number;
  /** Fora do período letivo a célula fica apagada. */
  periodo: { startsOn: string; endsOn: string } | null;
  /**
   * A turma que a tela está filtrando, quando há uma.
   *
   * Só serve para pintar o dia: o âmbar da célula diz "aqui não tem aula", e
   * um conselho de classe do 9º C não tira aula de mais ninguém. Sem isto, a
   * grade da escola apareceria com o dia bloqueado por causa de uma turma — a
   * mesma mentira que a contagem de dias letivos evita do lado do servidor.
   */
  turmaEmFoco?: string | null;
  /**
   * Abre o painel do dia.
   *
   * `intencao` diz de onde veio o clique: no número do dia ou numa etiqueta,
   * a pessoa quer **ver**; no espaço vazio da célula, quer **criar**. O painel
   * é o mesmo — muda só onde o foco cai, porque dois painéis diferentes para
   * cliques a milímetros um do outro erram com o mouse.
   */
  aoAbrirDia?: (dia: string, intencao: "ver" | "criar") => void;
}) {
  const hoje = new Date().toISOString().slice(0, 10);
  const [mes, setMes] = useState(() =>
    // Abre no mês corrente quando ele é do ano letivo; senão, em fevereiro,
    // que é onde o ano letivo brasileiro começa.
    hoje.startsWith(String(ano)) ? inicioDoMes(hoje) : `${ano}-02-01`,
  );

  const celulas = useMemo(() => celulasDoMes(mes), [mes]);
  const porDia = useMemo(() => eventosPorDia(eventos), [eventos]);
  const { ano: anoDoCursor, mes: mesDoCursor } = partes(mes);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-extrabold text-lg capitalize">
          {MESES[mesDoCursor - 1]}{" "}
          <span className="font-bold text-muted-foreground">{anoDoCursor}</span>
        </h2>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="min-h-8 px-3 text-[11px]"
            onClick={() => setMes(inicioDoMes(hoje))}
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Mês anterior"
            onClick={() => setMes(inicioDoMes(somarDias(mes, -1)))}
          >
            <ChevronLeft size={16} strokeWidth={1.8} aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Próximo mês"
            onClick={() => setMes(inicioDoMes(somarDias(`${mes.slice(0, 8)}28`, 7)))}
          >
            <ChevronRight size={16} strokeWidth={1.8} aria-hidden />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_DA_SEMANA.map((dia) => (
          <div
            key={dia}
            className="py-1 text-center font-bold text-[10px] text-muted-foreground uppercase tracking-wide"
          >
            {dia}
          </div>
        ))}

        {celulas.map((dia) => {
          const doDia = porDia.get(dia) ?? [];
          const doMes = dia.slice(0, 7) === mes.slice(0, 7);
          const ehHoje = dia === hoje;
          const foraDoPeriodo =
            periodo !== null && (dia < periodo.startsOn || dia > periodo.endsOn);
          const naoLetivo = doDia.some(
            (e) =>
              e.dayEffect === "nao_letivo" &&
              (e.classroomId === null || e.classroomId === turmaEmFoco),
          );
          const sobra = doDia.length - MAX_VISIVEL;

          const porExtenso = `${Number(dia.slice(8))} de ${MESES[Number(dia.slice(5, 7)) - 1]}`;

          return (
            <div
              key={dia}
              className={[
                "relative flex min-h-24 flex-col gap-1 rounded-field p-1.5",
                doMes ? "bg-muted" : "bg-transparent",
                // Dia não letivo ganha o mesmo âmbar do aviso de pendência:
                // a escola lê "aqui não tem aula" sem precisar da legenda.
                naoLetivo && doMes ? "bg-warning-soft" : "",
                foraDoPeriodo ? "opacity-40" : "",
              ].join(" ")}
            >
              {/*
                O alvo de "criar aqui" cobre a célula inteira e fica **atrás**
                das etiquetas. Um botão envolvendo o conteúdo aninharia botões,
                que é HTML inválido e faz o clique da etiqueta sumir para o
                leitor de tela.
              */}
              {aoAbrirDia && !foraDoPeriodo ? (
                <button
                  type="button"
                  aria-label={`Criar evento em ${porExtenso}`}
                  className="absolute inset-0 rounded-field focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                  onClick={() => aoAbrirDia(dia, "criar")}
                />
              ) : null}

              <button
                type="button"
                aria-label={`Ver ${porExtenso}`}
                onClick={() => aoAbrirDia?.(dia, "ver")}
                disabled={!aoAbrirDia}
                className={[
                  "relative flex size-5 shrink-0 items-center justify-center rounded-full font-bold text-[11px] tabular-nums",
                  ehHoje ? "bg-primary text-primary-foreground" : "",
                  doMes ? "text-foreground" : "text-muted-foreground",
                ].join(" ")}
              >
                {Number(dia.slice(8))}
              </button>

              {doDia.slice(0, MAX_VISIVEL).map((evento) => (
                <button
                  type="button"
                  key={`${dia}-${evento.id}`}
                  onClick={() => aoAbrirDia?.(dia, "ver")}
                  disabled={!aoAbrirDia}
                  title={[
                    evento.title,
                    EVENT_TYPE_LABEL[evento.type as EventType] ?? evento.type,
                    evento.classroomName ?? "Toda a escola",
                  ].join(" · ")}
                  className={[
                    "relative truncate rounded-field px-1.5 py-0.5 text-left text-[10px] leading-tight",
                    evento.dayEffect === "nao_letivo"
                      ? "bg-warning text-card"
                      : evento.dayEffect === "letivo_extra"
                        ? "bg-success text-card"
                        : "bg-card text-foreground",
                  ].join(" ")}
                >
                  {/* O nome da turma vem na frente, em negrito: na célula de
                      um dia cheio, "9º C" distingue mais rápido que o título,
                      que vai truncar de qualquer forma. */}
                  {evento.classroomName ? (
                    <span className="font-bold">{evento.classroomName} </span>
                  ) : null}
                  {evento.title}
                </button>
              ))}

              {sobra > 0 ? (
                <button
                  type="button"
                  onClick={() => aoAbrirDia?.(dia, "ver")}
                  disabled={!aoAbrirDia}
                  className="relative px-1.5 text-left font-bold text-[10px] text-muted-foreground"
                >
                  +{sobra}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
