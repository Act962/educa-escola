import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestLesson,
  createTestMembership,
  createTestSchool,
  createTestStudent,
  createTestSubject,
  createTestUser,
} from "../../testing/fixtures";
import { createProfileRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createProfileRepository", () => {
  it("traz a identidade pelo vínculo desta escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx, "Dom Pedro II");
      const pessoa = await createTestUser(tx);
      await createTestMembership(tx, { schoolId: escola.id, userId: pessoa.id, role: "admin" });

      const identidade = await createProfileRepository(tx, { schoolId: escola.id }).identity(
        pessoa.id,
      );

      expect(identidade?.role).toBe("admin");
      expect(identidade?.schoolName).toBe("Dom Pedro II");
    });
  });

  /**
   * O mesmo usuário em duas escolas é o caso que o requisito prevê para o
   * professor. Cada escola precisa devolver o **seu** vínculo — somar os dois
   * ou devolver o primeiro que aparecer daria uma resposta plausível e errada.
   */
  it("devolve o vínculo da escola pedida, e não o da outra", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const pessoa = await createTestUser(tx);

      await createTestMembership(tx, { schoolId: a.id, userId: pessoa.id, role: "teacher" });
      await createTestMembership(tx, { schoolId: b.id, userId: pessoa.id, role: "admin" });

      expect(
        (await createProfileRepository(tx, { schoolId: a.id }).identity(pessoa.id))?.role,
      ).toBe("teacher");
      expect(
        (await createProfileRepository(tx, { schoolId: b.id }).identity(pessoa.id))?.role,
      ).toBe("admin");
    });
  });

  it("não encontra quem não tem vínculo nesta escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const pessoa = await createTestUser(tx);
      await createTestMembership(tx, { schoolId: a.id, userId: pessoa.id });

      expect(await createProfileRepository(tx, { schoolId: b.id }).identity(pessoa.id)).toBeNull();
    });
  });

  it("liga a conta do aluno à ficha e à turma", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const turma = await createTestClassroom(tx, escola.id, "9º C");
      await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        userId: conta.id,
        registration: "2026-0042",
      });

      const ficha = await createProfileRepository(tx, { schoolId: escola.id }).studentBond(
        conta.id,
      );

      expect(ficha?.registration).toBe("2026-0042");
      expect(ficha?.classroomName).toBe("9º C");
    });
  });

  /** Aluno sem turma alocada continua tendo ficha: o `leftJoin` é o que garante. */
  it("devolve a ficha mesmo sem turma", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      await createTestStudent(tx, { schoolId: escola.id, userId: conta.id });

      const ficha = await createProfileRepository(tx, { schoolId: escola.id }).studentBond(
        conta.id,
      );

      expect(ficha).not.toBeNull();
      expect(ficha?.classroomName).toBeNull();
    });
  });

  it("não devolve ficha de aluno de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const conta = await createTestUser(tx);
      await createTestStudent(tx, { schoolId: a.id, userId: conta.id });

      expect(
        await createProfileRepository(tx, { schoolId: b.id }).studentBond(conta.id),
      ).toBeNull();
    });
  });

  it("conta turmas, disciplinas e aulas do ano, e ignora outro ano", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);
      const turmaA = await createTestClassroom(tx, escola.id, "8º A");
      const turmaB = await createTestClassroom(tx, escola.id, "8º B");
      const matematica = await createTestSubject(tx, escola.id, "Matemática");

      const aula = (classroomId: string, date: string) =>
        createTestLesson(tx, {
          schoolId: escola.id,
          classroomId,
          subjectId: matematica.id,
          teacherId: professor.id,
          date,
        });

      await aula(turmaA.id, "2026-03-10");
      await aula(turmaA.id, "2026-03-11");
      await aula(turmaB.id, "2026-03-10");
      await aula(turmaB.id, "2025-03-10");

      const carga = await createProfileRepository(tx, { schoolId: escola.id }).teacherBond(
        professor.id,
        2026,
      );

      expect(carga).toEqual({ turmas: 2, disciplinas: 1, aulas: 3 });
    });
  });

  /**
   * Professor recém-chegado tem zero, não `undefined`. `count()` sobre conjunto
   * vazio devolve uma linha com zeros — se um dia devolvesse nenhuma, a tela
   * quebraria em cima do primeiro acesso da pessoa.
   */
  it("devolve zeros para quem ainda não tem aula", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const professor = await createTestUser(tx);

      expect(
        await createProfileRepository(tx, { schoolId: escola.id }).teacherBond(professor.id, 2026),
      ).toEqual({ turmas: 0, disciplinas: 0, aulas: 0 });
    });
  });
});
