import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestLesson,
  createTestSchool,
  createTestStudent,
  createTestSubject,
  createTestUser,
} from "../../testing/fixtures";
import { createLessonRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

async function cenario(tx: Parameters<Parameters<typeof withRollback>[0]>[0], nome = "Escola") {
  const escola = await createTestSchool(tx, nome);
  const turma = await createTestClassroom(tx, escola.id);
  const professor = await createTestUser(tx);
  const disciplina = await createTestSubject(tx, escola.id);
  const aula = await createTestLesson(tx, {
    schoolId: escola.id,
    classroomId: turma.id,
    subjectId: disciplina.id,
    teacherId: professor.id,
  });

  return { escola, turma, professor, disciplina, aula };
}

describe("createLessonRepository", () => {
  it("não enxerga aula de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await cenario(tx, "Escola A");
      const b = await cenario(tx, "Escola B");

      const repoB = createLessonRepository(tx, { schoolId: b.escola.id });

      expect(await repoB.findById(a.aula.id)).toBeNull();
      expect(await repoB.findById(b.aula.id)).not.toBeNull();
    });
  });

  /**
   * O motivo de a gravação ser "apaga e reinsere": um aluno removido da turma
   * não pode ficar com presença fantasma de uma chamada anterior.
   */
  it("substitui a chamada inteira em vez de acumular linhas", async () => {
    await withRollback(async (tx) => {
      const { escola, turma, aula } = await cenario(tx);
      const repo = createLessonRepository(tx, { schoolId: escola.id });

      const ana = await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Ana",
      });
      const bruno = await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        name: "Bruno",
      });

      await repo.replaceAttendance(
        aula.id,
        [
          { studentId: ana.id, status: "presente" },
          { studentId: bruno.id, status: "falta" },
        ],
        new Date(),
      );

      // Segunda gravação, agora só com a Ana: o Bruno some, não vira duplicata.
      await repo.replaceAttendance(aula.id, [{ studentId: ana.id, status: "atraso" }], new Date());

      const registrada = await repo.listAttendance(aula.id);
      expect(registrada).toEqual([{ studentId: ana.id, status: "atraso" }]);
    });
  });

  it("carimba o horário do registro, que é o que separa pendente de feita", async () => {
    await withRollback(async (tx) => {
      const { escola, turma, aula } = await cenario(tx);
      const repo = createLessonRepository(tx, { schoolId: escola.id });

      expect((await repo.findById(aula.id))?.attendanceRecordedAt).toBeNull();

      const aluno = await createTestStudent(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
      });
      await repo.replaceAttendance(
        aula.id,
        [{ studentId: aluno.id, status: "presente" }],
        new Date("2026-09-09T12:00:00Z"),
      );

      expect((await repo.findById(aula.id))?.attendanceRecordedAt).toBeInstanceOf(Date);
    });
  });

  it("só conta como pendente a aula anterior à data informada", async () => {
    await withRollback(async (tx) => {
      const { escola, turma, disciplina, professor } = await cenario(tx);
      const repo = createLessonRepository(tx, { schoolId: escola.id });

      // Uma no passado, uma no futuro. Só a primeira é cobrança.
      await createTestLesson(tx, {
        schoolId: escola.id,
        classroomId: turma.id,
        subjectId: disciplina.id,
        teacherId: professor.id,
        date: "2026-09-30",
      });

      const pendentes = await repo.listPendingForTeacher(professor.id, "2026-09-10");
      expect(pendentes).toHaveLength(1);
      expect(pendentes[0]?.date).toBe("2026-09-09");
    });
  });
});
