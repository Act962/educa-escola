import { organization } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createTestSchool } from "../../testing/fixtures";
import { createClassroomRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createClassroomRepository", () => {
  it("carimba a escola do tenant na criação", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createClassroomRepository(tx, { schoolId: escola.id });

      // `create` nem aceita schoolId na entrada (garantia de tipo): o valor
      // vem sempre do tenant recebido na construção do repositório.
      const created = await repo.create({ name: "3º ano B", academicYear: 2026 });

      expect(created.schoolId).toBe(escola.id);
    });
  });

  it("respeita o índice único de nome por ano letivo", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createClassroomRepository(tx, { schoolId: escola.id });

      await repo.create({ name: "3º ano B", academicYear: 2026 });

      await expect(repo.create({ name: "3º ano B", academicYear: 2026 })).rejects.toThrow();
    });
  });

  it("permite o mesmo nome de turma em escolas diferentes", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await createClassroomRepository(tx, { schoolId: a.id }).create({
        name: "3º ano B",
        academicYear: 2026,
      });

      await expect(
        createClassroomRepository(tx, { schoolId: b.id }).create({
          name: "3º ano B",
          academicYear: 2026,
        }),
      ).resolves.toMatchObject({ schoolId: b.id });
    });
  });

  /**
   * Este é o teste que sustenta a decisão de multi-tenant em banco único.
   * Se ele passar a falhar, há vazamento de dado entre escolas.
   */
  it("não lê, altera nem apaga turma de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      const repoA = createClassroomRepository(tx, { schoolId: a.id });
      const repoB = createClassroomRepository(tx, { schoolId: b.id });

      const turmaDeA = await repoA.create({ name: "3º ano B", academicYear: 2026 });

      expect(await repoB.list()).toHaveLength(0);
      expect(await repoB.findById(turmaDeA.id)).toBeNull();
      expect(await repoB.findByNameAndYear("3º ano B", 2026)).toBeNull();
      expect(await repoB.rename(turmaDeA.id, "invadida")).toBeNull();
      expect(await repoB.remove(turmaDeA.id)).toBeNull();

      // A turma de A segue intacta depois das tentativas de B.
      const intacta = await repoA.findById(turmaDeA.id);
      expect(intacta).toMatchObject({ name: "3º ano B", schoolId: a.id });
    });
  });

  it("lista ordenado por ano letivo e nome", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createClassroomRepository(tx, { schoolId: escola.id });

      await repo.create({ name: "2º ano B", academicYear: 2027 });
      await repo.create({ name: "1º ano C", academicYear: 2026 });
      await repo.create({ name: "1º ano A", academicYear: 2026 });

      expect((await repo.list()).map((c) => `${c.academicYear} ${c.name}`)).toEqual([
        "2026 1º ano A",
        "2026 1º ano C",
        "2027 2º ano B",
      ]);
    });
  });

  it("apaga as turmas junto com a escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createClassroomRepository(tx, { schoolId: escola.id });
      await repo.create({ name: "3º ano B", academicYear: 2026 });

      // A escola compartilha a PK com organization: apagar a org leva tudo junto.
      await tx.delete(organization).where(eq(organization.id, escola.id));

      expect(await repo.list()).toHaveLength(0);
    });
  });
});
