import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";
import { violaUnico } from "../../errors";
import {
  createTestEnrollment,
  createTestSchool,
  createTestStudent,
  createTestUser,
} from "../../testing/fixtures";
import { createReferralRepository } from "./repository";
import { PROGRAMA_PADRAO } from "./service";

afterAll(async () => {
  await closeTestDb();
});

describe("createReferralRepository", () => {
  it("cria o programa na primeira edição e regrava depois", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createReferralRepository(tx, { schoolId: escola.id });

      expect(await repo.findProgram()).toBeNull();

      await repo.saveProgram({ ...PROGRAMA_PADRAO, enabled: true, rewardValue: 15 });
      expect(await repo.findProgram()).toMatchObject({ enabled: true, rewardValue: 15 });

      // A segunda gravação atualiza a mesma linha — não estoura a chave.
      await repo.saveProgram({ ...PROGRAMA_PADRAO, enabled: true, rewardValue: 20 });
      expect(await repo.findProgram()).toMatchObject({ rewardValue: 20 });
    });
  });

  it("não lê o programa da outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");

      await createReferralRepository(tx, { schoolId: a.id }).saveProgram({
        ...PROGRAMA_PADRAO,
        enabled: true,
      });

      expect(await createReferralRepository(tx, { schoolId: b.id }).findProgram()).toBeNull();
    });
  });

  /**
   * O código é único **por escola**, não global: ele é curto e legível, e duas
   * escolas poderem ter `MA4K2Z` é o que permite manter seis caracteres.
   */
  it("o mesmo código pode existir em duas escolas", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");
      const conta = await createTestUser(tx);
      const alunoA = await createTestStudent(tx, { schoolId: a.id });
      const alunoB = await createTestStudent(tx, { schoolId: b.id });

      const link = (schoolId: string, studentId: string) =>
        createReferralRepository(tx, { schoolId }).createLink({
          studentId,
          code: "MA4K2Z",
          expiresAt: null,
          createdByUserId: conta.id,
        });

      await link(a.id, alunoA.id);
      await link(b.id, alunoB.id);

      expect(
        (await createReferralRepository(tx, { schoolId: a.id }).findLinkByCode("MA4K2Z"))
          ?.studentId,
      ).toBe(alunoA.id);
    });
  });

  it("um aluno tem um link só", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const aluno = await createTestStudent(tx, { schoolId: escola.id });
      const repo = createReferralRepository(tx, { schoolId: escola.id });

      await repo.createLink({
        studentId: aluno.id,
        code: "MA4K2Z",
        expiresAt: null,
        createdByUserId: conta.id,
      });

      // O nome da constraint mora no `cause`, não na mensagem que o Drizzle
      // devolve — conferir por `violaUnico` é o que o service faz.
      const erro = await repo
        .createLink({
          studentId: aluno.id,
          code: "OUTRO1",
          expiresAt: null,
          createdByUserId: conta.id,
        })
        .catch((e) => e);

      expect(violaUnico(erro, "referral_link_student_uidx")).toBe(true);
    });
  });

  it("não acha o código da outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");
      const conta = await createTestUser(tx);
      const aluno = await createTestStudent(tx, { schoolId: a.id });

      await createReferralRepository(tx, { schoolId: a.id }).createLink({
        studentId: aluno.id,
        code: "MA4K2Z",
        expiresAt: null,
        createdByUserId: conta.id,
      });

      expect(
        await createReferralRepository(tx, { schoolId: b.id }).findLinkByCode("MA4K2Z"),
      ).toBeNull();
    });
  });

  /**
   * O índice que o service traduz em conflito legível. Sem ele, a mesma
   * matrícula premiaria duas famílias — e o desconto dobrado só apareceria no
   * boleto.
   */
  it("uma matrícula premia uma indicação só", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const indicante = await createTestStudent(tx, { schoolId: escola.id, name: "Maria" });
      const outro = await createTestStudent(tx, { schoolId: escola.id, name: "Ana" });
      const novato = await createTestStudent(tx, { schoolId: escola.id, name: "João" });
      const matricula = await createTestEnrollment(tx, {
        schoolId: escola.id,
        studentId: novato.id,
      });
      const repo = createReferralRepository(tx, { schoolId: escola.id });

      const linkDaMaria = await repo.createLink({
        studentId: indicante.id,
        code: "MA4K2Z",
        expiresAt: null,
        createdByUserId: conta.id,
      });
      const linkDaAna = await repo.createLink({
        studentId: outro.id,
        code: "AN7P3Q",
        expiresAt: null,
        createdByUserId: conta.id,
      });

      const premiar = (linkId: string) =>
        repo.createConversion({
          linkId,
          enrollmentId: matricula.id,
          rewardKind: "percentual",
          rewardValue: 10,
          registeredByUserId: conta.id,
        });

      await premiar(linkDaMaria.id);

      const erro = await premiar(linkDaAna.id).catch((e) => e);
      expect(violaUnico(erro, "referral_conversion_enrollment_uidx")).toBe(true);
    });
  });

  it("a listagem traz a situação da matrícula, e só as do ano pedido", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const indicante = await createTestStudent(tx, { schoolId: escola.id, name: "Maria Clara" });
      const repo = createReferralRepository(tx, { schoolId: escola.id });

      const link = await repo.createLink({
        studentId: indicante.id,
        code: "MA4K2Z",
        expiresAt: null,
        createdByUserId: conta.id,
      });

      for (const [ano, status] of [
        [2026, "ativa"],
        [2026, "cancelada"],
        [2025, "ativa"],
      ] as const) {
        const novato = await createTestStudent(tx, { schoolId: escola.id });
        const matricula = await createTestEnrollment(tx, {
          schoolId: escola.id,
          studentId: novato.id,
          academicYear: ano,
          status,
        });
        await repo.createConversion({
          linkId: link.id,
          enrollmentId: matricula.id,
          rewardKind: "percentual",
          rewardValue: 10,
          registeredByUserId: conta.id,
        });
      }

      const de2026 = await repo.listConversions(2026);

      expect(de2026).toHaveLength(2);
      expect(de2026.map((c) => c.enrollmentStatus).sort()).toEqual(["ativa", "cancelada"]);
      expect(de2026[0]?.indicanteNome).toBe("Maria Clara");
      expect(await repo.listConversions(2025)).toHaveLength(1);
    });
  });

  it("não lista indicação de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");
      const conta = await createTestUser(tx);
      const indicante = await createTestStudent(tx, { schoolId: a.id });
      const novato = await createTestStudent(tx, { schoolId: a.id });
      const matricula = await createTestEnrollment(tx, { schoolId: a.id, studentId: novato.id });

      const daA = createReferralRepository(tx, { schoolId: a.id });
      const link = await daA.createLink({
        studentId: indicante.id,
        code: "MA4K2Z",
        expiresAt: null,
        createdByUserId: conta.id,
      });
      await daA.createConversion({
        linkId: link.id,
        enrollmentId: matricula.id,
        rewardKind: "percentual",
        rewardValue: 10,
        registeredByUserId: conta.id,
      });

      const daB = createReferralRepository(tx, { schoolId: b.id });
      expect(await daB.listConversions(2026)).toEqual([]);
      expect(await daB.countLinks()).toBe(0);
    });
  });

  it("acha a ficha de aluno pela conta de acesso", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      await createTestStudent(tx, { schoolId: escola.id, userId: conta.id, name: "Maria Clara" });

      const repo = createReferralRepository(tx, { schoolId: escola.id });
      expect((await repo.findStudentByUser(conta.id))?.name).toBe("Maria Clara");
      expect(await repo.findStudentByUser("ninguem")).toBeNull();
    });
  });
});
