import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { CommunicationRepository } from "./repository";
import {
  audiencesDoPapel,
  createCommunicationService,
  PUBLICO_QUE_EXIGE_CONFIRMACAO,
} from "./service";

const AGORA = new Date("2026-09-22T12:00:00Z");

type Comunicado = Awaited<ReturnType<CommunicationRepository["list"]>>[number];

interface Estado {
  comunicados?: Partial<Comunicado>[];
  publico?: number;
  recibos?: { communicationId: string; leram: number; confirmaram: number }[];
}

function fakeRepository(estado: Estado = {}) {
  const comunicados = (estado.comunicados ?? []) as Comunicado[];
  const publicados: string[] = [];
  const retificados: string[] = [];

  const repo: CommunicationRepository = {
    list: async () => comunicados,
    findById: async (id) => comunicados.find((c) => c.id === id) ?? null,
    createDraft: async (data) => ({ ...data, id: "novo", status: "rascunho" }) as never,
    publish: async (id) => {
      publicados.push(id);
      return { id, status: "publicado" } as never;
    },
    markAsRectified: async (id) => {
      retificados.push(id);
      return { id };
    },
    removeDraft: async (id) =>
      comunicados.some((c) => c.id === id && c.status === "rascunho") ? { id } : null,
    audienceSize: async () => estado.publico ?? 0,
    receiptCounts: async () => estado.recibos ?? [],
    registerRead: async (input) => ({ ...input, id: "recibo" }) as never,
    inboxOf: async () => [],
    unreadCountOf: async () => 0,
  };

  return { repo, publicados, retificados };
}

const rascunho = (over: Partial<Comunicado> = {}) =>
  ({
    id: "c1",
    title: "Reunião de pais",
    status: "rascunho",
    priority: "normal",
    audience: "toda_a_escola",
    classroomId: null,
    requiresAck: false,
    publishedAt: null,
    ...over,
  }) as Partial<Comunicado>;

describe("audiencesDoPapel", () => {
  it("cada papel recebe o que é dele, e o institucional vai para todos", () => {
    expect(audiencesDoPapel("student")).toEqual(["toda_a_escola", "alunos"]);
    expect(audiencesDoPapel("teacher")).toEqual(["toda_a_escola", "professores"]);
  });

  /** Aluno não recebe comunicado de professores. */
  it("aluno não recebe o que é dos professores", () => {
    expect(audiencesDoPapel("student")).not.toContain("professores");
  });
});

describe("publish", () => {
  /** §8.3, regra 5: envio em massa exige confirmação explícita. */
  it("exige confirmação acima do limite, dizendo para quantos vai", async () => {
    const { repo } = fakeRepository({
      comunicados: [rascunho()],
      publico: PUBLICO_QUE_EXIGE_CONFIRMACAO,
    });

    await expect(createCommunicationService(repo).publish({ id: "c1" }, AGORA)).rejects.toThrow(
      ValidationError,
    );
    await expect(createCommunicationService(repo).publish({ id: "c1" }, AGORA)).rejects.toThrow(
      new RegExp(`${PUBLICO_QUE_EXIGE_CONFIRMACAO} pessoas`),
    );
  });

  it("público pequeno publica sem cerimônia", async () => {
    const { repo, publicados } = fakeRepository({ comunicados: [rascunho()], publico: 3 });

    await createCommunicationService(repo).publish({ id: "c1" }, AGORA);
    expect(publicados).toEqual(["c1"]);
  });

  /**
   * O que a pessoa confirmou foi um número. Se o público mudou entre o aviso e
   * o clique — uma turma nova, trinta matrículas —, publicar alcançaria mais
   * gente do que foi aprovado.
   */
  it("recusa quando o público mudou desde a confirmação", async () => {
    const { repo } = fakeRepository({ comunicados: [rascunho()], publico: 303 });

    await expect(
      createCommunicationService(repo).publish({ id: "c1", publicoConfirmado: 288 }, AGORA),
    ).rejects.toThrow(ConflictError);
    await expect(
      createCommunicationService(repo).publish({ id: "c1", publicoConfirmado: 288 }, AGORA),
    ).rejects.toThrow(/mudou de 288 para 303/);
  });

  it("publica quando o número confirmado bate", async () => {
    const { repo, publicados } = fakeRepository({ comunicados: [rascunho()], publico: 303 });

    await createCommunicationService(repo).publish({ id: "c1", publicoConfirmado: 303 }, AGORA);
    expect(publicados).toEqual(["c1"]);
  });

  it("não publica duas vezes", async () => {
    const { repo } = fakeRepository({
      comunicados: [rascunho({ status: "publicado" })],
      publico: 3,
    });

    await expect(createCommunicationService(repo).publish({ id: "c1" }, AGORA)).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("remove", () => {
  /** §8.3, regra 2: apagar o que a escola já leu reescreveria o passado. */
  it("recusa apagar comunicado publicado, e diz o que fazer", async () => {
    const { repo } = fakeRepository({ comunicados: [rascunho({ status: "publicado" })] });

    await expect(createCommunicationService(repo).remove("c1")).rejects.toThrow(ValidationError);
    await expect(createCommunicationService(repo).remove("c1")).rejects.toThrow(/retificação/);
  });

  it("apaga rascunho, que ninguém leu", async () => {
    const { repo } = fakeRepository({ comunicados: [rascunho()] });
    await expect(createCommunicationService(repo).remove("c1")).resolves.toEqual({ id: "c1" });
  });
});

describe("rectify", () => {
  const novo = {
    academicYear: 2026,
    title: "Reunião de pais — nova data",
    body: "A reunião foi adiada para 20 de outubro.",
    priority: "importante" as const,
    audience: "toda_a_escola" as const,
    requiresAck: false,
    replacesId: "c1",
  };

  it("marca o anterior como retificado e cria um rascunho novo", async () => {
    const { repo, retificados } = fakeRepository({
      comunicados: [rascunho({ status: "publicado" })],
    });

    const criado = await createCommunicationService(repo).rectify(novo, "marina");

    expect(criado).toMatchObject({ status: "rascunho", replacesId: "c1" });
    expect(retificados).toEqual(["c1"]);
  });

  it("rascunho se edita, não se retifica", async () => {
    const { repo } = fakeRepository({ comunicados: [rascunho()] });
    await expect(createCommunicationService(repo).rectify(novo, "marina")).rejects.toThrow(
      /Rascunho se edita/,
    );
  });

  it("recusa retificar o que não existe", async () => {
    const { repo } = fakeRepository();
    await expect(createCommunicationService(repo).rectify(novo, "marina")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("list", () => {
  /** Taxa de 0% num rascunho faria parecer que o comunicado fracassou. */
  it("rascunho não tem público nem taxa de leitura", async () => {
    const { repo } = fakeRepository({ comunicados: [rascunho()], publico: 300 });
    const [linha] = await createCommunicationService(repo).list(2026);

    expect(linha?.publico).toBeNull();
    expect(linha?.taxaDeLeitura).toBeNull();
  });

  it("publicado traz público, leituras e taxa", async () => {
    const { repo } = fakeRepository({
      comunicados: [rascunho({ status: "publicado" })],
      publico: 200,
      recibos: [{ communicationId: "c1", leram: 50, confirmaram: 20 }],
    });

    const [linha] = await createCommunicationService(repo).list(2026);

    expect(linha).toMatchObject({ publico: 200, leram: 50, confirmaram: 20 });
    expect(linha?.taxaDeLeitura).toBeCloseTo(0.25);
  });
});
