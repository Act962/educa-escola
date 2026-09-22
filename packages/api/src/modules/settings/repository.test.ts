import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import { createTestMembership, createTestSchool, createTestUser } from "../../testing/fixtures";
import { createSettingsRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createSettingsRepository", () => {
  it("junta o que é da auth com o que é do domínio", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx, "Dom Pedro II");

      const lida = await createSettingsRepository(tx, { schoolId: escola.id }).find();

      // Nome e identificador vêm de `organization`; fuso, de `school`.
      expect(lida?.name).toBe("Dom Pedro II");
      expect(lida?.slug).toMatch(/^escola-/);
      expect(lida?.timezone).toBe("America/Sao_Paulo");
      expect(lida?.inepCode).toBeNull();
    });
  });

  it("grava e apaga o código INEP", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createSettingsRepository(tx, { schoolId: escola.id });

      expect(await repo.update({ inepCode: "22004561" })).toEqual({
        id: escola.id,
        inepCode: "22004561",
      });
      expect((await repo.find())?.inepCode).toBe("22004561");

      await repo.update({ inepCode: null });
      expect((await repo.find())?.inepCode).toBeNull();
    });
  });

  /**
   * O teste que mais importa aqui: um id de outra escola não pode encontrar
   * linha. Sem o filtro no `where` do update, a secretaria de uma escola
   * gravaria o INEP na outra e nada acusaria.
   */
  it("não lê nem escreve na escola errada", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      const daA = createSettingsRepository(tx, { schoolId: a.id });
      await daA.update({ inepCode: "11111111" });

      const daB = createSettingsRepository(tx, { schoolId: b.id });
      expect((await daB.find())?.inepCode).toBeNull();
      expect((await daB.find())?.name).toBe("Escola B");
    });
  });

  it("conta os vínculos por papel", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      for (const role of ["owner", "admin", "teacher", "teacher"]) {
        const pessoa = await createTestUser(tx);
        await createTestMembership(tx, { schoolId: escola.id, userId: pessoa.id, role });
      }

      const contagem = await createSettingsRepository(tx, { schoolId: escola.id }).countByRole();

      expect(Object.fromEntries(contagem.map((c) => [c.role, c.total]))).toEqual({
        owner: 1,
        admin: 1,
        teacher: 2,
      });
    });
  });

  it("lista só quem tem acesso total, e só desta escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const outra = await createTestSchool(tx, "Outra");

      const diretora = await createTestUser(tx, "diretora@escola.br");
      const secretaria = await createTestUser(tx, "secretaria@escola.br");
      const professor = await createTestUser(tx, "professor@escola.br");
      const deFora = await createTestUser(tx, "defora@outra.br");

      await createTestMembership(tx, { schoolId: escola.id, userId: diretora.id, role: "owner" });
      await createTestMembership(tx, { schoolId: escola.id, userId: secretaria.id, role: "admin" });
      await createTestMembership(tx, {
        schoolId: escola.id,
        userId: professor.id,
        role: "teacher",
      });
      await createTestMembership(tx, { schoolId: outra.id, userId: deFora.id, role: "owner" });

      const lista = await createSettingsRepository(tx, { schoolId: escola.id }).administrators();

      expect(lista.map((l) => l.email)).toEqual(["secretaria@escola.br", "diretora@escola.br"]);
    });
  });
});
