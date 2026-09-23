import { classroom } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createTestClassroom, createTestSchool, createTestSubject } from "../../testing/fixtures";
import { createAcademicRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createAcademicRepository", () => {
  it("carimba a escola do tenant na disciplina criada", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createAcademicRepository(tx, { schoolId: escola.id });

      const criada = await repo.createSubject({
        name: "Filosofia",
        kind: "obrigatoria",
        composesAverage: true,
        tracksAttendance: true,
      });

      expect(criada.schoolId).toBe(escola.id);
      expect(criada.kind).toBe("obrigatoria");
    });
  });

  it("não enxerga disciplina de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      await createTestSubject(tx, a.id, "Química");

      expect(await createAcademicRepository(tx, { schoolId: b.id }).listSubjects()).toEqual([]);
    });
  });

  /**
   * Montar a grade é operação que a secretaria repete. "Já está na grade" não
   * é erro — é a carga horária sendo corrigida.
   */
  it("pôr a mesma disciplina duas vezes atualiza a carga, não duplica", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const disciplina = await createTestSubject(tx, escola.id);
      const repo = createAcademicRepository(tx, { schoolId: escola.id });

      const base = {
        academicYear: 2026,
        stage: "fundamental_ii" as const,
        gradeLevel: 6,
        subjectId: disciplina.id,
      };

      await repo.setCurriculum({ ...base, weeklyHours: 4 });
      await repo.setCurriculum({ ...base, weeklyHours: 6 });

      const grade = await repo.listCurriculum(2026);
      expect(grade).toHaveLength(1);
      expect(grade[0]?.weeklyHours).toBe(6);
    });
  });

  it("separa a grade por série, segmento e ano letivo", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const disciplina = await createTestSubject(tx, escola.id);
      const repo = createAcademicRepository(tx, { schoolId: escola.id });

      const base = { subjectId: disciplina.id, weeklyHours: 2 };
      await repo.setCurriculum({
        ...base,
        academicYear: 2026,
        stage: "fundamental_ii",
        gradeLevel: 6,
      });
      await repo.setCurriculum({
        ...base,
        academicYear: 2026,
        stage: "fundamental_ii",
        gradeLevel: 7,
      });
      await repo.setCurriculum({
        ...base,
        academicYear: 2025,
        stage: "fundamental_ii",
        gradeLevel: 6,
      });
      // Mesma série numérica, outro segmento: são grades diferentes.
      await repo.setCurriculum({ ...base, academicYear: 2026, stage: "medio", gradeLevel: 1 });

      expect(await repo.listCurriculum(2026)).toHaveLength(3);
      expect(await repo.listCurriculum(2025)).toHaveLength(1);
      expect(await repo.listCurriculum(2026, "medio")).toHaveLength(1);
    });
  });

  /**
   * A grade se monta para série que tem turma. Oferecer as combinações
   * possíveis faria a secretaria montar grade para série que não existe.
   */
  it("tira as séries em uso das turmas, e ignora turma sem série", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);

      const seis = await createTestClassroom(tx, escola.id, "6º A");
      const seisB = await createTestClassroom(tx, escola.id, "6º B");
      const sete = await createTestClassroom(tx, escola.id, "7º A");
      const bercario = await createTestClassroom(tx, escola.id, "Berçário II");

      for (const [turma, gradeLevel] of [
        [seis, 6],
        [seisB, 6],
        [sete, 7],
      ] as const) {
        await tx
          .update(classroom)
          .set({ gradeLevel: gradeLevel, stage: "fundamental_ii" })
          .where(eq(classroom.id, turma.id));
      }

      const series = await createAcademicRepository(tx, { schoolId: escola.id }).gradeLevelsInUse(
        2026,
      );

      expect(series.map((s) => [s.gradeLevel, s.classrooms])).toEqual([
        [6, 2],
        [7, 1],
      ]);
      expect(bercario.id).toBeTruthy();
    });
  });
});
