import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import { createTestClassroom, createTestSchool } from "../../testing/fixtures";
import { createCalendarRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

type Repo = ReturnType<typeof createCalendarRepository>;

/** Um evento mínimo: o que muda entre os testes é o alvo. */
const evento = (
  repo: Repo,
  title: string,
  alvo: { scope: "institucional" | "turma"; classroomId: string | null },
) =>
  repo.createEvent({
    academicYear: 2026,
    type: "evento",
    dayEffect: "nenhum",
    title,
    startsOn: "2026-09-07",
    endsOn: "2026-09-07",
    createdByUserId: "u1",
    ...alvo,
  });

describe("createCalendarRepository", () => {
  it("guarda o alvo do evento e devolve o nome da turma junto", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "9º C");
      const repo = createCalendarRepository(tx, { schoolId: escola.id });

      await evento(repo, "Conselho do 9º C", { scope: "turma", classroomId: turma.id });

      const [lido] = await repo.listEvents(2026);

      expect(lido).toMatchObject({
        scope: "turma",
        classroomId: turma.id,
        // O `leftJoin` existe para isto: sem o nome, a tela mostraria um uuid.
        classroomName: "9º C",
      });
    });
  });

  /** Evento institucional não tem turma, então o `leftJoin` devolve nulo. */
  it("evento da escola inteira vem sem nome de turma", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createCalendarRepository(tx, { schoolId: escola.id });

      await evento(repo, "Independência", { scope: "institucional", classroomId: null });

      expect((await repo.listEvents(2026))[0]).toMatchObject({
        scope: "institucional",
        classroomId: null,
        classroomName: null,
      });
    });
  });

  /**
   * O recorte que a tela usa. É consulta SQL — `or(isNull, eq)` — e dublê em
   * memória não executa SQL: se o `or` virasse `and` numa refatoração, só um
   * teste contra o Postgres notaria.
   */
  it("filtrando por turma, traz a dela e a da escola, e nenhuma outra", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const noveC = await createTestClassroom(tx, escola.id, "9º C");
      const oitavoA = await createTestClassroom(tx, escola.id, "8º A");
      const repo = createCalendarRepository(tx, { schoolId: escola.id });

      await evento(repo, "Feriado", { scope: "institucional", classroomId: null });
      await evento(repo, "Conselho do 9º C", { scope: "turma", classroomId: noveC.id });
      await evento(repo, "Conselho do 8º A", { scope: "turma", classroomId: oitavoA.id });

      const doNoveC = await repo.listEvents(2026, noveC.id);
      expect(doNoveC.map((e) => e.title).sort()).toEqual(["Conselho do 9º C", "Feriado"]);

      // Sem filtro, a visão é a da escola: tudo aparece.
      expect(await repo.listEvents(2026)).toHaveLength(3);
    });
  });

  it("não devolve evento de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await evento(createCalendarRepository(tx, { schoolId: a.id }), "Da escola A", {
        scope: "institucional",
        classroomId: null,
      });

      expect(await createCalendarRepository(tx, { schoolId: b.id }).listEvents(2026)).toEqual([]);
    });
  });

  /**
   * A checagem que segura o isolamento na escrita. A chave estrangeira aceita
   * a turma da outra escola, porque ela existe — só não é nossa. Quem recusa é
   * o service, e é daqui que ele tira a resposta.
   */
  it("não encontra turma de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const daB = await createTestClassroom(tx, b.id, "9º C");

      const daA = createCalendarRepository(tx, { schoolId: a.id });

      expect(await daA.findClassroom(daB.id)).toBeNull();
    });
  });

  it("a edição troca o alvo do evento", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "9º C");
      const repo = createCalendarRepository(tx, { schoolId: escola.id });

      const criado = await evento(repo, "Reunião", {
        scope: "institucional",
        classroomId: null,
      });

      await repo.updateEvent(criado.id, {
        type: "reuniao",
        dayEffect: "nenhum",
        title: "Reunião",
        startsOn: "2026-09-07",
        endsOn: "2026-09-07",
        scope: "turma",
        classroomId: turma.id,
      });

      expect((await repo.listEvents(2026, turma.id))[0]).toMatchObject({
        scope: "turma",
        classroomName: "9º C",
      });
    });
  });
});
