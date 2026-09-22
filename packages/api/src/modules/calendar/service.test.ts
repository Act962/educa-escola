import { describe, expect, it } from "vitest";

import { NotFoundError, ValidationError } from "../../errors";
import type { CalendarRepository } from "./repository";
import { createCalendarService } from "./service";

type Ano = Awaited<ReturnType<CalendarRepository["findYear"]>>;
type Evento = Awaited<ReturnType<CalendarRepository["listEvents"]>>[number];

interface Estado {
  ano?: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  eventos?: Partial<Evento>[];
}

function fakeRepository(estado: Estado = {}): CalendarRepository {
  const criados: unknown[] = [];
  return {
    findYear: async () => (estado.ano ? ({ ...estado.ano } as unknown as Ano) : null),
    defineYear: async (data) => ({ ...data }) as never,
    listEvents: async () => (estado.eventos ?? []) as Evento[],
    createEvent: async (data) => {
      criados.push(data);
      return { ...data, id: "novo" } as never;
    },
    removeEvent: async (id) => ((estado.eventos ?? []).some((e) => e.id === id) ? { id } : null),
  };
}

const anoDefinido = { startsOn: "2026-02-02", endsOn: "2026-12-18", minimumSchoolDays: 200 };

describe("year", () => {
  /**
   * Contar a partir de 1º de janeiro daria um número plausível e errado, e
   * número errado sobre obrigação legal é pior que número nenhum.
   */
  it("sem ano definido devolve contagem nula, não zero", async () => {
    const visao = await createCalendarService(fakeRepository()).year(2026);

    expect(visao.ano).toBeNull();
    expect(visao.contagem).toBeNull();
  });

  it("com ano definido conta os dias letivos e compara com o mínimo", async () => {
    const visao = await createCalendarService(
      fakeRepository({
        ano: anoDefinido,
        eventos: [
          { startsOn: "2026-09-07", endsOn: "2026-09-07", dayEffect: "nao_letivo" },
        ] as Partial<Evento>[],
      }),
    ).year(2026);

    expect(visao.contagem?.perdidos).toBe(1);
    expect(visao.contagem?.minimo).toBe(200);
    expect(visao.contagem?.cumpreOMinimo).toBe(true);
  });

  it("alerta quando o ano fica abaixo do mínimo legal", async () => {
    const visao = await createCalendarService(
      fakeRepository({
        ano: { startsOn: "2026-02-02", endsOn: "2026-06-30", minimumSchoolDays: 200 },
      }),
    ).year(2026);

    expect(visao.contagem?.cumpreOMinimo).toBe(false);
    expect(visao.contagem?.faltam).toBeGreaterThan(0);
  });
});

describe("createEvent", () => {
  const evento = {
    academicYear: 2026,
    type: "feriado" as const,
    dayEffect: "nao_letivo" as const,
    title: "Independência",
    startsOn: "2026-09-07",
  };

  /** Evento fora do período não conta para nada e faria a pessoa desconfiar. */
  it("exige o ano letivo definido", async () => {
    await expect(createCalendarService(fakeRepository()).createEvent(evento, "u1")).rejects.toThrow(
      /Defina o período do ano letivo/,
    );
  });

  it("recusa evento fora do período, dizendo qual é o período", async () => {
    const servico = createCalendarService(fakeRepository({ ano: anoDefinido }));

    await expect(servico.createEvent({ ...evento, startsOn: "2026-01-05" }, "u1")).rejects.toThrow(
      ValidationError,
    );
    await expect(servico.createEvent({ ...evento, startsOn: "2026-01-05" }, "u1")).rejects.toThrow(
      /2026-02-02 e 2026-12-18/,
    );
  });

  it("recusa evento que termina depois do fim do ano", async () => {
    await expect(
      createCalendarService(fakeRepository({ ano: anoDefinido })).createEvent(
        { ...evento, startsOn: "2026-12-15", endsOn: "2026-12-31" },
        "u1",
      ),
    ).rejects.toThrow(ValidationError);
  });

  /** Evento de um dia: o fim é o próprio início, não nulo. */
  it("fecha o intervalo quando só o início foi informado", async () => {
    const criado = await createCalendarService(fakeRepository({ ano: anoDefinido })).createEvent(
      evento,
      "u1",
    );

    expect(criado).toMatchObject({ startsOn: "2026-09-07", endsOn: "2026-09-07" });
  });

  it("guarda quem criou", async () => {
    const criado = await createCalendarService(fakeRepository({ ano: anoDefinido })).createEvent(
      evento,
      "marina",
    );

    expect(criado).toMatchObject({ createdByUserId: "marina" });
  });
});

describe("removeEvent", () => {
  it("recusa evento de outra escola", async () => {
    await expect(createCalendarService(fakeRepository()).removeEvent("de-outra")).rejects.toThrow(
      NotFoundError,
    );
  });
});
