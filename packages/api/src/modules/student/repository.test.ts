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
import { createStudentRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createStudentRepository", () => {
  it("carimba a escola do tenant na criação", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createStudentRepository(tx, { schoolId: escola.id });

      const criado = await repo.create({
        name: "Ana Clara Souza Lima",
        registration: "2026-0301",
        shift: "manha",
      });

      expect(criado.schoolId).toBe(escola.id);
    });
  });

  /**
   * O teste que justifica o isolamento existir: duas escolas, um repositório
   * de cada, e nenhum enxerga o aluno do outro — nem por listagem, nem pelo id.
   */
  it("não enxerga aluno de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      const deA = await createTestStudent(tx, { schoolId: a.id, name: "Aluno da A" });
      await createTestStudent(tx, { schoolId: b.id, name: "Aluno da B" });

      const repoB = createStudentRepository(tx, { schoolId: b.id });

      const lista = await repoB.list({ limit: 50, offset: 0 });
      expect(lista.map((linha) => linha.name)).toEqual(["Aluno da B"]);

      expect(await repoB.findById(deA.id)).toBeNull();
      expect(await repoB.countMatching({})).toBe(1);
    });
  });

  it("permite a mesma matrícula em escolas diferentes", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await createStudentRepository(tx, { schoolId: a.id }).create({
        name: "Aluno",
        registration: "2026-0001",
        shift: "manha",
      });

      await expect(
        createStudentRepository(tx, { schoolId: b.id }).create({
          name: "Outro aluno",
          registration: "2026-0001",
          shift: "manha",
        }),
      ).resolves.toMatchObject({ registration: "2026-0001" });
    });
  });

  it("recusa matrícula repetida dentro da mesma escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createStudentRepository(tx, { schoolId: escola.id });

      await repo.create({ name: "Aluno", registration: "2026-0001", shift: "manha" });

      await expect(
        repo.create({ name: "Outro", registration: "2026-0001", shift: "manha" }),
      ).rejects.toThrow();
    });
  });

  it("traz a contagem de presença junto da listagem", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id);
      const professor = await createTestUser(tx);
      const disciplina = await createTestSubject(tx, escola.id);

      const aluno = await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Aluno com faltas",
      });

      for (const [indice, status] of (["presente", "falta", "atraso"] as const).entries()) {
        const aula = await createTestLesson(tx, {
          schoolId: escola.id,
          classroomId: turma.id,
          subjectId: disciplina.id,
          teacherId: professor.id,
          date: `2026-09-0${indice + 1}`,
        });
        await recordTestAttendance(tx, escola.id, aula.id, [{ studentId: aluno.id, status }]);
      }

      const [linha] = await createStudentRepository(tx, { schoolId: escola.id }).list({
        limit: 10,
        offset: 0,
      });

      expect(linha).toMatchObject({
        presentCount: 1,
        absentCount: 1,
        lateCount: 1,
        classroomName: turma.name,
      });
    });
  });

  /**
   * Documentação pendente não tira ninguém da chamada: a pessoa está na sala.
   * Excluí-la produziria falta silenciosa no histórico.
   */
  it("mantém aluno com documentação pendente na lista de chamada", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id);

      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Ativo",
      });
      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Documentação pendente",
        status: "documentacao_pendente",
      });
      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Transferido",
        status: "transferido",
      });

      const roster = await createStudentRepository(tx, { schoolId: escola.id }).listByClassroom(
        turma.id,
      );

      // Quem foi transferido sai; quem só deve documento continua.
      expect(roster.map((linha) => linha.name).sort()).toEqual(["Ativo", "Documentação pendente"]);
    });
  });
});
