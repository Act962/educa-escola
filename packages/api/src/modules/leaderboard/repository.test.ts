import { lesson } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestLesson,
  createTestSchool,
  createTestSubject,
  createTestUser,
} from "../../testing/fixtures";
import { createLeaderboardLookup, createLeaderboardRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

async function escolaPublicada(
  tx: Parameters<Parameters<typeof withRollback>[0]>[0],
  nome: string,
  points: number,
) {
  const escola = await createTestSchool(tx, nome);
  const usuario = await createTestUser(tx);
  const repo = createLeaderboardRepository(tx, { schoolId: escola.id });

  await repo.optIn({ displayName: nome, academicYear: 2026, userId: usuario.id });
  await repo.publish({
    displayName: nome,
    academicYear: 2026,
    points,
    chamadaNoPrazo: points,
    notasSemPendencia: 0,
    frequenciaMedia: 0,
  });

  return { escola, repo };
}

describe("createLeaderboardRepository", () => {
  it("guarda a adesão da própria escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const usuario = await createTestUser(tx);
      const repo = createLeaderboardRepository(tx, { schoolId: escola.id });

      await repo.optIn({ displayName: "Dom Pedro II", academicYear: 2026, userId: usuario.id });

      expect(await repo.currentOptIn()).toMatchObject({
        displayName: "Dom Pedro II",
        status: "ativa",
      });
    });
  });

  it("não enxerga a adesão de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const usuario = await createTestUser(tx);

      await createLeaderboardRepository(tx, { schoolId: a.id }).optIn({
        displayName: "A",
        academicYear: 2026,
        userId: usuario.id,
      });

      const daOutra = createLeaderboardRepository(tx, { schoolId: b.id });
      expect(await daOutra.currentOptIn()).toBeNull();
    });
  });

  /** Consentimento retirado é dado retirado, não dado escondido. */
  it("sair do placar apaga a linha publicada", async () => {
    await withRollback(async (tx) => {
      const { escola, repo } = await escolaPublicada(tx, "Escola A", 200);
      const lookup = createLeaderboardLookup(tx);

      expect(await lookup.scoreboard(2026)).toHaveLength(1);

      await repo.optOut();

      expect(await lookup.scoreboard(2026)).toHaveLength(0);
      expect(await repo.currentOptIn()).toMatchObject({ status: "suspensa" });
      expect(escola.id).toBeTruthy();
    });
  });
});

describe("createLeaderboardLookup", () => {
  /**
   * O teste que justifica a exceção de isolamento existir.
   *
   * A consulta devolve exatamente escola, nome de exibição e números — e
   * nenhuma coluna onde um aluno ou um professor caberia.
   */
  it("devolve só escola, nome e indicadores", async () => {
    await withRollback(async (tx) => {
      await escolaPublicada(tx, "Escola A", 200);

      const [linha] = await createLeaderboardLookup(tx).scoreboard(2026);

      expect(Object.keys(linha ?? {}).sort()).toEqual([
        "chamadaNoPrazo",
        "displayName",
        "frequenciaMedia",
        "notasSemPendencia",
        "points",
        "schoolId",
      ]);
    });
  });

  /**
   * Escola sem adesão não é filtrada — ela não existe para juntar. O
   * `innerJoin` é a origem das linhas, não um `where` que alguém pode apagar.
   */
  it("escola sem adesão não aparece", async () => {
    await withRollback(async (tx) => {
      await escolaPublicada(tx, "Aderiu", 200);

      const semAdesao = await createTestSchool(tx, "Não aderiu");
      await createLeaderboardRepository(tx, { schoolId: semAdesao.id }).publish({
        displayName: "Não aderiu",
        academicYear: 2026,
        points: 300,
        chamadaNoPrazo: 100,
        notasSemPendencia: 100,
        frequenciaMedia: 100,
      });

      const placar = await createLeaderboardLookup(tx).scoreboard(2026);
      expect(placar.map((linha) => linha.displayName)).toEqual(["Aderiu"]);
    });
  });

  it("ordena do maior para o menor", async () => {
    await withRollback(async (tx) => {
      await escolaPublicada(tx, "Bronze", 100);
      await escolaPublicada(tx, "Ouro", 300);
      await escolaPublicada(tx, "Prata", 200);

      const placar = await createLeaderboardLookup(tx).scoreboard(2026);
      expect(placar.map((linha) => linha.displayName)).toEqual(["Ouro", "Prata", "Bronze"]);
    });
  });

  it("separa por ano letivo", async () => {
    await withRollback(async (tx) => {
      await escolaPublicada(tx, "Escola A", 200);
      expect(await createLeaderboardLookup(tx).scoreboard(2025)).toHaveLength(0);
    });
  });
});

describe("contagens da escola", () => {
  /**
   * A coluna é `timestamp` sem fuso, gravada em UTC. Um `at time zone` só
   * interpretaria o valor **como** horário de São Paulo em vez de convertê-lo
   * para lá, e a chamada das 21h cairia no dia seguinte — tirando do
   * professor um ponto que ele ganhou.
   */
  it("conta a chamada da noite no dia da aula, e não no seguinte", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      const turma = await createTestClassroom(tx, escola.id);
      const disciplina = await createTestSubject(tx, escola.id);

      const aula = await createTestLesson(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        subjectId: disciplina.id,
        teacherId: professor.id,
        date: "2026-03-02",
      });

      // 21h de 2 de março em São Paulo = meia-noite de 3 de março em UTC.
      await tx
        .update(lesson)
        .set({ attendanceRecordedAt: new Date("2026-03-03T00:00:00Z") })
        .where(eq(lesson.id, aula.id));

      const contagens = await createLeaderboardRepository(tx, {
        schoolId: escola.id,
      }).contagens(2026);

      expect(contagens).toMatchObject({ aulasComChamada: 1, aulasNoPrazo: 1 });
    });
  });
});
