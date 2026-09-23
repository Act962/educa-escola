import { describe, expect, it } from "vitest";

import { NotFoundError, ValidationError } from "../../errors";
import type { CalendarRepository } from "./repository";
import { createCalendarService } from "./service";

type Ano = Awaited<ReturnType<CalendarRepository["findYear"]>>;
type Evento = Awaited<ReturnType<CalendarRepository["listEvents"]>>[number];

interface Estado {
  year?: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  events?: Partial<Evento>[];
  /** Turmas que existem nesta escola, por id. */
  classrooms?: Record<string, string>;
}

function fakeRepository(estado: Estado = {}): CalendarRepository {
  const criados: unknown[] = [];
  // `institucional` é o default da coluna: um evento de fixture sem escopo é
  // da escola inteira, como seria no banco.
  const events = (estado.events ?? []).map((e) => ({
    scope: "institucional",
    ...e,
  })) as Evento[];
  const classrooms = estado.classrooms ?? {};

  return {
    findEvent: async (id) => (events.find((e) => e.id === id) ?? null) as never,
    updateEvent: async (id, data) =>
      events.some((e) => e.id === id) ? ({ id, ...data } as never) : null,
    findYear: async () => (estado.year ? ({ ...estado.year } as unknown as Ano) : null),
    defineYear: async (data) => ({ ...data }) as never,
    // Reproduz o recorte do repositório: com turma, devolve os dela mais os da
    // escola inteira. Sem turma, devolve tudo.
    listEvents: async (_ano, classroomId) =>
      classroomId
        ? events.filter((e) => e.classroomId === null || e.classroomId === classroomId)
        : events,
    findClassroom: async (id) => (classrooms[id] ? { id, name: classrooms[id] as string } : null),
    createEvent: async (data) => {
      criados.push(data);
      return { ...data, id: "novo" } as never;
    },
    removeEvent: async (id) => ((estado.events ?? []).some((e) => e.id === id) ? { id } : null),
  };
}

/** O escopo vem do Zod com default; o service, chamado direto, exige-o. */
const atSchool = { scope: "institucional" as const };

const anoDefinido = { startsOn: "2026-02-02", endsOn: "2026-12-18", minimumSchoolDays: 200 };

describe("year", () => {
  /**
   * Contar a partir de 1º de janeiro daria um número plausível e errado, e
   * número errado sobre obrigação legal é pior que número nenhum.
   */
  it("sem ano definido devolve contagem nula, não zero", async () => {
    const visao = await createCalendarService(fakeRepository()).year(2026);

    expect(visao.year).toBeNull();
    expect(visao.count).toBeNull();
  });

  it("com ano definido conta os dias letivos e compara com o mínimo", async () => {
    const visao = await createCalendarService(
      fakeRepository({
        year: anoDefinido,
        events: [
          { startsOn: "2026-09-07", endsOn: "2026-09-07", dayEffect: "nao_letivo" },
        ] as Partial<Evento>[],
      }),
    ).year(2026);

    expect(visao.count?.perdidos).toBe(1);
    expect(visao.count?.minimo).toBe(200);
    expect(visao.count?.cumpreOMinimo).toBe(true);
  });

  it("alerta quando o ano fica abaixo do mínimo legal", async () => {
    const visao = await createCalendarService(
      fakeRepository({
        year: { startsOn: "2026-02-02", endsOn: "2026-06-30", minimumSchoolDays: 200 },
      }),
    ).year(2026);

    expect(visao.count?.cumpreOMinimo).toBe(false);
    expect(visao.count?.faltam).toBeGreaterThan(0);
  });
});

describe("escopo por turma", () => {
  const conselhoDo9C = {
    id: "ev-turma",
    scope: "turma",
    classroomId: "t1",
    classroomName: "9º C",
    startsOn: "2026-09-08",
    endsOn: "2026-09-08",
    dayEffect: "nao_letivo",
  } as Partial<Evento>;

  const feriado = {
    id: "ev-escola",
    scope: "institucional",
    classroomId: null,
    startsOn: "2026-09-07",
    endsOn: "2026-09-07",
    dayEffect: "nao_letivo",
  } as Partial<Evento>;

  /**
   * **O teste que justifica a coluna de escopo.** Um conselho de classe do
   * 9º C marcado como não letivo tira aula do 9º C, não da escola. Se entrasse
   * na conta geral, a escola apareceria devendo dias letivos que só uma turma
   * deve — e a direção reporia aula para todo mundo.
   */
  it("evento de turma não tira dia letivo da escola", async () => {
    const visao = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: [feriado, conselhoDo9C] }),
    ).year(2026);

    expect(visao.count?.perdidos).toBe(1);
  });

  it("filtrando pela turma, a contagem dela desconta os dois", async () => {
    const visao = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: [feriado, conselhoDo9C] }),
    ).year(2026, "t1");

    // A da escola não muda: é o número que a secretaria de educação cobra.
    expect(visao.count?.perdidos).toBe(1);
    expect(visao.classroomCount?.perdidos).toBe(2);
    expect(visao.classroomCount?.letivos).toBe((visao.count?.letivos ?? 0) - 1);
  });

  /** Sem filtro não há segunda contagem: seria de qual turma? */
  it("sem filtro, a contagem da turma é nula", async () => {
    const visao = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: [feriado, conselhoDo9C] }),
    ).year(2026);

    expect(visao.classroomCount).toBeNull();
  });

  /**
   * O feriado nacional vale para o 9º C também. Um filtro que o escondesse
   * faria a coordenação achar que aquela turma tem aula em 7 de setembro.
   */
  it("o filtro por turma continua mostrando o que é da escola inteira", async () => {
    const visao = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: [feriado, conselhoDo9C] }),
    ).year(2026, "t1");

    expect(visao.events.map((e) => e.id)).toEqual(["ev-escola", "ev-turma"]);
  });

  it("não traz evento de outra turma", async () => {
    const visao = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: [feriado, conselhoDo9C] }),
    ).year(2026, "t2");

    expect(visao.events.map((e) => e.id)).toEqual(["ev-escola"]);
  });

  /**
   * O Zod garante que escopo e turma são coerentes entre si; o que ele não tem
   * como saber é se a turma existe **aqui**. Sem esta checagem, um id de outra
   * escola entraria — a chave estrangeira aceitaria, porque a turma existe — e
   * o evento sumiria de toda tela.
   */
  it("recusa turma que não é desta escola", async () => {
    const servico = createCalendarService(
      fakeRepository({ year: anoDefinido, classrooms: { t1: "9º C" } }),
    );

    const evento = {
      academicYear: 2026,
      type: "conselho" as const,
      dayEffect: "nao_letivo" as const,
      title: "Conselho de classe",
      startsOn: "2026-09-08",
    };

    await expect(
      servico.createEvent({ ...evento, scope: "turma", classroomId: "de-outra-escola" }, "u1"),
    ).rejects.toThrow(ValidationError);

    await expect(
      servico.createEvent({ ...evento, scope: "turma", classroomId: "t1" }, "u1"),
    ).resolves.toMatchObject({ scope: "turma", classroomId: "t1" });
  });

  /**
   * Escopo institucional com turma junto seria um evento que vale para a
   * escola e some quando a secretaria filtra por outra turma. O service limpa
   * em vez de confiar em quem chamou.
   */
  it("apaga a turma quando o evento é da escola inteira", async () => {
    const criado = await createCalendarService(
      fakeRepository({ year: anoDefinido, classrooms: { t1: "9º C" } }),
    ).createEvent(
      {
        academicYear: 2026,
        type: "feriado",
        dayEffect: "nao_letivo",
        title: "Independência",
        startsOn: "2026-09-07",
        scope: "institucional",
        classroomId: "t1",
      },
      "u1",
    );

    expect(criado).toMatchObject({ scope: "institucional", classroomId: null });
  });

  /** O calendário brasileiro é da escola inteira, por definição. */
  it("a importação entra como institucional", async () => {
    const servico = createCalendarService(fakeRepository({ year: anoDefinido }));
    const resultado = await servico.importar(2026, "u1");

    expect(resultado.criados).toBeGreaterThan(0);
  });

  it("mudar um evento da escola para uma turma também valida a turma", async () => {
    const servico = createCalendarService(
      fakeRepository({
        year: anoDefinido,
        events: [feriado],
        classrooms: { t1: "9º C" },
      }),
    );

    const edicao = {
      id: "ev-escola",
      type: "conselho" as const,
      dayEffect: "nao_letivo" as const,
      title: "Conselho de classe",
      startsOn: "2026-09-08",
    };

    await expect(
      servico.updateEvent({ ...edicao, scope: "turma", classroomId: "nao-existe" }),
    ).rejects.toThrow(ValidationError);

    await expect(
      servico.updateEvent({ ...edicao, scope: "turma", classroomId: "t1" }),
    ).resolves.toMatchObject({ scope: "turma", classroomId: "t1" });
  });
});

describe("createEvent", () => {
  const evento = {
    ...atSchool,
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
    const servico = createCalendarService(fakeRepository({ year: anoDefinido }));

    await expect(servico.createEvent({ ...evento, startsOn: "2026-01-05" }, "u1")).rejects.toThrow(
      ValidationError,
    );
    await expect(servico.createEvent({ ...evento, startsOn: "2026-01-05" }, "u1")).rejects.toThrow(
      /2026-02-02 e 2026-12-18/,
    );
  });

  it("recusa evento que termina depois do fim do ano", async () => {
    await expect(
      createCalendarService(fakeRepository({ year: anoDefinido })).createEvent(
        { ...evento, startsOn: "2026-12-15", endsOn: "2026-12-31" },
        "u1",
      ),
    ).rejects.toThrow(ValidationError);
  });

  /** Evento de um dia: o fim é o próprio início, não nulo. */
  it("fecha o intervalo quando só o início foi informado", async () => {
    const criado = await createCalendarService(fakeRepository({ year: anoDefinido })).createEvent(
      evento,
      "u1",
    );

    expect(criado).toMatchObject({ startsOn: "2026-09-07", endsOn: "2026-09-07" });
  });

  it("guarda quem criou", async () => {
    const criado = await createCalendarService(fakeRepository({ year: anoDefinido })).createEvent(
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

describe("updateEvent", () => {
  const edicao = {
    ...atSchool,
    id: "e1",
    type: "reuniao" as const,
    dayEffect: "nenhum" as const,
    title: "Reunião de pais — nova data",
    startsOn: "2026-10-20",
  };

  const existente = [
    { id: "e1", academicYear: 2026, startsOn: "2026-09-16", endsOn: "2026-09-16" },
  ] as Partial<Evento>[];

  it("recusa evento que não é desta escola", async () => {
    await expect(
      createCalendarService(fakeRepository({ year: anoDefinido })).updateEvent(edicao),
    ).rejects.toThrow(NotFoundError);
  });

  /**
   * Corrigir a data para fora do ano letivo tiraria o evento da contagem sem
   * avisar ninguém, o que é pior que recusar.
   */
  it("recusa mover o evento para fora do ano letivo", async () => {
    const servico = createCalendarService(fakeRepository({ year: anoDefinido, events: existente }));

    await expect(servico.updateEvent({ ...edicao, startsOn: "2027-01-05" })).rejects.toThrow(
      ValidationError,
    );
    await expect(servico.updateEvent({ ...edicao, startsOn: "2027-01-05" })).rejects.toThrow(
      /2026-02-02 e 2026-12-18/,
    );
  });

  it("fecha o intervalo quando só o início foi informado", async () => {
    const atualizado = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: existente }),
    ).updateEvent(edicao);

    expect(atualizado).toMatchObject({ startsOn: "2026-10-20", endsOn: "2026-10-20" });
  });

  it("troca tipo e efeito no dia letivo", async () => {
    const atualizado = await createCalendarService(
      fakeRepository({ year: anoDefinido, events: existente }),
    ).updateEvent({ ...edicao, type: "recesso", dayEffect: "nao_letivo" });

    expect(atualizado).toMatchObject({ type: "recesso", dayEffect: "nao_letivo" });
  });
});
