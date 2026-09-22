import { describe, expect, it } from "vitest";

import { type CalendarEntry, eventsByDay, monthCells } from "./month-calendar";

const evento = (over: Partial<CalendarEntry> & { id: string }): CalendarEntry => ({
  title: "Evento",
  type: "evento",
  dayEffect: "nenhum",
  startsOn: "2026-09-07",
  endsOn: "2026-09-07",
  classroomId: null,
  classroomName: null,
  ...over,
});

describe("celulasDoMes", () => {
  /** Seis linhas fixas: grade que muda de altura faz a página pular. */
  it("sempre devolve 42 células", () => {
    for (const mes of ["2026-01-01", "2026-02-01", "2026-09-01", "2028-02-01"]) {
      expect(monthCells(mes)).toHaveLength(42);
    }
  });

  it("começa no domingo da semana do dia 1º", () => {
    // 1º de setembro de 2026 é terça; a grade começa no domingo, 30/08.
    const celulas = monthCells("2026-09-01");
    expect(celulas[0]).toBe("2026-08-30");
    expect(new Date(`${celulas[0]}T12:00:00Z`).getUTCDay()).toBe(0);
  });

  it("todas as células começam no domingo da sua linha", () => {
    const celulas = monthCells("2026-09-01");
    for (let i = 0; i < 42; i += 7) {
      expect(new Date(`${celulas[i]}T12:00:00Z`).getUTCDay()).toBe(0);
    }
  });

  it("cobre o mês inteiro, inclusive fevereiro bissexto", () => {
    const celulas = monthCells("2028-02-01");
    expect(celulas).toContain("2028-02-29");
  });

  it("os dias saem em sequência, sem buraco", () => {
    const celulas = monthCells("2026-09-01");
    for (let i = 1; i < celulas.length; i++) {
      const anterior = new Date(`${celulas[i - 1]}T12:00:00Z`);
      const atual = new Date(`${celulas[i]}T12:00:00Z`);
      expect(atual.getTime() - anterior.getTime()).toBe(86_400_000);
    }
  });
});

describe("eventosPorDia", () => {
  it("põe o evento de um dia na célula dele", () => {
    const mapa = eventsByDay([evento({ id: "a" })]);
    expect(mapa.get("2026-09-07")).toHaveLength(1);
    expect(mapa.get("2026-09-08")).toBeUndefined();
  });

  /**
   * Um recesso de duas semanas que só marcasse a segunda-feira faria a escola
   * achar que tem aula na terça.
   */
  it("espalha o evento por todos os dias que ele ocupa", () => {
    const mapa = eventsByDay([
      evento({ id: "recesso", startsOn: "2026-07-06", endsOn: "2026-07-17" }),
    ]);

    expect(mapa.get("2026-07-06")).toHaveLength(1);
    expect(mapa.get("2026-07-10")).toHaveLength(1);
    expect(mapa.get("2026-07-17")).toHaveLength(1);
    expect(mapa.get("2026-07-18")).toBeUndefined();
  });

  it("acumula eventos que caem no mesmo dia", () => {
    const mapa = eventsByDay([
      evento({ id: "a", title: "Feriado" }),
      evento({ id: "b", title: "Conselho de classe" }),
    ]);
    expect(mapa.get("2026-09-07")).toHaveLength(2);
  });

  it("atravessa a virada de mês", () => {
    const mapa = eventsByDay([evento({ id: "a", startsOn: "2026-01-30", endsOn: "2026-02-02" })]);
    expect([...mapa.keys()].sort()).toEqual([
      "2026-01-30",
      "2026-01-31",
      "2026-02-01",
      "2026-02-02",
    ]);
  });

  /**
   * Dado incoerente não pode travar a aba. Sem a guarda, um `endsOn` anterior
   * ao `startsOn` giraria para sempre com a página aberta.
   */
  it("não entra em laço infinito com intervalo invertido", () => {
    const mapa = eventsByDay([
      evento({ id: "torto", startsOn: "2026-09-07", endsOn: "2026-09-01" }),
    ]);
    expect(mapa.size).toBe(0);
  });

  it("lista vazia não quebra", () => {
    expect(eventsByDay([]).size).toBe(0);
  });
});
