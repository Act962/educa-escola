import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestLesson,
  createTestSchool,
  createTestStudent,
  createTestSubject,
  createTestUser,
  recordTestAttendance,
} from "../../testing/fixtures";
import { createScoreRepository } from "./repository";
import type { NewEvent } from "./tally";

afterAll(async () => {
  await closeTestDb();
});

function evento(over: Partial<NewEvent> = {}): NewEvent {
  return {
    subjectKind: "aluno",
    subjectId: "aluno-1",
    ruleKey: "aluno.presenca",
    points: 2,
    academicYear: 2026,
    term: null,
    sourceKind: "attendance",
    sourceId: "att-1",
    occurredAt: new Date("2026-03-02T12:00:00Z"),
    ...over,
  };
}

describe("createScoreRepository", () => {
  it("carimba a escola do tenant nos eventos", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createScoreRepository(tx, { schoolId: escola.id });

      await repo.appendEvents([evento()]);
      const lista = await repo.listEvents({
        subjectKind: "aluno",
        subjectId: "aluno-1",
        academicYear: 2026,
        limit: 10,
      });

      expect(lista).toHaveLength(1);
    });
  });

  /**
   * A garantia da apuração inteira. Sem agendador, alguém vai clicar duas
   * vezes — e o índice único de origem é o que impede a pontuação de dobrar.
   */
  it("reapurar não duplica ponto", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createScoreRepository(tx, { schoolId: escola.id });

      const primeira = await repo.appendEvents([evento(), evento({ sourceId: "att-2" })]);
      const segunda = await repo.appendEvents([evento(), evento({ sourceId: "att-2" })]);

      expect(primeira).toBe(2);
      expect(segunda).toBe(0);
    });
  });

  /** Mesma origem, regras diferentes: presença e constância saem da mesma linha. */
  it("a mesma origem pode render regras diferentes", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createScoreRepository(tx, { schoolId: escola.id });

      const gravados = await repo.appendEvents([
        evento({ ruleKey: "aluno.presenca" }),
        evento({ ruleKey: "aluno.sequencia_10", points: 10 }),
      ]);

      expect(gravados).toBe(2);
    });
  });

  it("não enxerga pontuação de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await createScoreRepository(tx, { schoolId: a.id }).appendEvents([evento()]);

      const daOutra = createScoreRepository(tx, { schoolId: b.id });
      expect(
        await daOutra.listEvents({
          subjectKind: "aluno",
          subjectId: "aluno-1",
          academicYear: 2026,
          limit: 10,
        }),
      ).toHaveLength(0);
      expect(await daOutra.scoreboard({ subjectKind: "aluno", academicYear: 2026 })).toHaveLength(
        0,
      );
    });
  });

  /** O mesmo aluno e a mesma origem em escolas diferentes não colidem. */
  it("escolas diferentes podem ter a mesma origem", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await createScoreRepository(tx, { schoolId: a.id }).appendEvents([evento()]);
      const naOutra = await createScoreRepository(tx, { schoolId: b.id }).appendEvents([evento()]);

      expect(naOutra).toBe(1);
    });
  });

  describe("rebuildBalances", () => {
    it("soma os eventos do ano e conta quantos somaram", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createScoreRepository(tx, { schoolId: escola.id });

        await repo.appendEvents([
          evento({ points: 2, sourceId: "a" }),
          evento({ points: 10, sourceId: "b" }),
          evento({ points: 99, sourceId: "c", academicYear: 2025 }),
        ]);
        await repo.rebuildBalances(2026);

        const saldo = await repo.balance({
          subjectKind: "aluno",
          subjectId: "aluno-1",
          academicYear: 2026,
        });

        expect(saldo).toMatchObject({ points: 12, eventCount: 2 });
      });
    });

    /**
     * Reconstrução completa, não incremento: se o saldo só soubesse somar,
     * divergiria da fonte no primeiro evento que não chegasse. Rodar de novo
     * tem de dar o mesmo número.
     */
    it("é idempotente e reflete a fonte, não o histórico", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createScoreRepository(tx, { schoolId: escola.id });

        await repo.appendEvents([evento({ points: 2 })]);
        await repo.rebuildBalances(2026);
        await repo.rebuildBalances(2026);

        const saldo = await repo.balance({
          subjectKind: "aluno",
          subjectId: "aluno-1",
          academicYear: 2026,
        });
        expect(saldo?.points).toBe(2);
      });
    });

    it("ordena o placar do maior para o menor", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createScoreRepository(tx, { schoolId: escola.id });

        await repo.appendEvents([
          evento({ subjectId: "aluno-1", points: 5, sourceId: "a" }),
          evento({ subjectId: "aluno-2", points: 50, sourceId: "b" }),
          evento({ subjectId: "aluno-3", points: 20, sourceId: "c" }),
        ]);
        await repo.rebuildBalances(2026);

        const placar = await repo.scoreboard({ subjectKind: "aluno", academicYear: 2026 });
        expect(placar.map((linha) => linha.subjectId)).toEqual(["aluno-2", "aluno-3", "aluno-1"]);
      });
    });
  });

  describe("leitura dos fatos da escola", () => {
    it("traz presença com a data da aula, e só do ano pedido", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const professor = await createTestUser(tx);
        const turma = await createTestClassroom(tx, escola.id);
        const disciplina = await createTestSubject(tx, escola.id);
        const aluno = await createTestStudent(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
        });

        const deste = await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          date: "2026-03-02",
        });
        const doAnterior = await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          date: "2025-03-02",
        });

        await recordTestAttendance(tx, escola.id, deste.id, [
          { studentId: aluno.id, status: "presente" },
        ]);
        await recordTestAttendance(tx, escola.id, doAnterior.id, [
          { studentId: aluno.id, status: "presente" },
        ]);

        const repo = createScoreRepository(tx, { schoolId: escola.id });
        const presencas = await repo.presencasDoAno(2026);

        expect(presencas).toHaveLength(1);
        expect(presencas[0]).toMatchObject({ studentId: aluno.id, date: "2026-03-02" });
      });
    });

    it("não lê aula de outra escola", async () => {
      await withRollback(async (tx) => {
        const a = await createTestSchool(tx, "Escola A");
        const b = await createTestSchool(tx, "Escola B");
        const professor = await createTestUser(tx);
        const turma = await createTestClassroom(tx, a.id);
        const disciplina = await createTestSubject(tx, a.id);

        await createTestLesson(tx, {
          schoolId: a.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          date: "2026-03-02",
        });

        const daOutra = createScoreRepository(tx, { schoolId: b.id });
        expect(await daOutra.aulasDoAno(2026)).toHaveLength(0);
        expect(await daOutra.presencasDoAno(2026)).toHaveLength(0);
      });
    });
  });
});

describe("volume de escola de verdade", () => {
  /**
   * Um ano de chamadas de uma escola com centenas de alunos produz dezenas de
   * milhares de eventos. Numa tacada só, o `insert` estoura a pilha ao montar
   * a query e passa do teto de parâmetros do Postgres — defeito que não
   * aparece com uma turma no banco e aparece no primeiro clique em produção.
   */
  const ACIMA_DO_TETO = 7_000;

  // Dois lotes gravados e dois conferidos, contra Postgres de verdade: é mais
  // lento que o teste comum, e o prazo padrão de 5s não cobre.
  it("grava muito mais eventos do que cabe num único insert", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createScoreRepository(tx, { schoolId: escola.id });

      const muitos = Array.from({ length: ACIMA_DO_TETO }, (_, i) =>
        evento({ sourceId: `att-${i}`, subjectId: `aluno-${i % 300}` }),
      );

      expect(await repo.appendEvents(muitos)).toBe(ACIMA_DO_TETO);
      // E reapurar continua sendo inofensivo no mesmo volume.
      expect(await repo.appendEvents(muitos)).toBe(0);
    });
  }, 30_000);
});
