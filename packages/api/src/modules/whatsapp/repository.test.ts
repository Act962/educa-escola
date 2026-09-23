import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import { createTestSchool } from "../../testing/fixtures";
import { createWhatsAppRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createWhatsAppRepository", () => {
  it("carimba a escola do tenant na criação", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      // `insertAccount` nem aceita `schoolId` na entrada (garantia de tipo):
      // o valor vem sempre do tenant recebido na construção.
      const conta = await repo.insertAccount({ label: "Secretaria" });

      expect(conta.schoolId).toBe(escola.id);
    });
  });

  /**
   * O `where` do update carrega o tenant. Sem ele, um id de outra escola
   * encontraria linha e a escreveria — que é o vazamento que a arquitetura
   * inteira existe para impedir.
   */
  it("não atualiza conta de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      const daA = await createWhatsAppRepository(tx, { schoolId: a.id }).insertAccount({
        label: "Secretaria",
      });

      const tentativa = await createWhatsAppRepository(tx, { schoolId: b.id }).updateAccount(
        daA.id,
        { label: "Invadida" },
      );

      expect(tentativa).toBeNull();
    });
  });

  it("não enxerga nem apaga conta de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      const daA = await createWhatsAppRepository(tx, { schoolId: a.id }).insertAccount({
        label: "Secretaria",
      });

      const deB = createWhatsAppRepository(tx, { schoolId: b.id });

      expect(await deB.findAccount(daA.id)).toBeNull();
      expect(await deB.deleteAccount(daA.id)).toBeNull();
      expect(await deB.listAccounts()).toEqual([]);
    });
  });

  /**
   * Dois principais é o tipo de estado que ninguém percebe até a mensagem
   * sair pelo número errado. O índice parcial é quem garante — e por isso o
   * service limpa antes de marcar.
   */
  it("admite um só número principal por escola", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      await repo.insertAccount({ label: "Secretaria", isDefault: true });

      await expect(
        repo.insertAccount({ label: "Unidade Centro", isDefault: true }),
      ).rejects.toThrow();
    });
  });

  it("duas escolas podem ter, cada uma, o seu principal", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");

      await createWhatsAppRepository(tx, { schoolId: a.id }).insertAccount({
        label: "Secretaria",
        isDefault: true,
      });

      await expect(
        createWhatsAppRepository(tx, { schoolId: b.id }).insertAccount({
          label: "Secretaria",
          isDefault: true,
        }),
      ).resolves.toMatchObject({ isDefault: true });
    });
  });

  /** Nome de modelo é chave na Meta: único por escola e idioma, espelhado aqui. */
  it("respeita o nome único de modelo por escola e idioma", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      await repo.insertTemplate({ name: "aviso", body: "Olá, {{a}}. Tudo bem?" });

      await expect(
        repo.insertTemplate({ name: "aviso", body: "Outro texto qualquer." }),
      ).rejects.toThrow();
    });
  });

  /**
   * Caso próprio, e não a continuação do de cima: violar um índice **aborta a
   * transação** no Postgres, e todo comando seguinte falha com "current
   * transaction is aborted". Num teste que roda dentro de `withRollback`, isso
   * transforma a asserção seguinte num falso negativo sobre outra coisa.
   */
  it("o mesmo nome em outro idioma é outro modelo", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      await repo.insertTemplate({ name: "aviso", body: "Olá, {{a}}. Tudo bem?" });

      await expect(
        repo.insertTemplate({ name: "aviso", language: "es", body: "Hola." }),
      ).resolves.toMatchObject({ language: "es" });
    });
  });

  it("sem principal marcado, devolve o mais antigo em vez de nada", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      const primeira = await repo.insertAccount({ label: "Secretaria" });
      await repo.insertAccount({ label: "Unidade Centro" });

      expect((await repo.defaultAccount())?.id).toBe(primeira.id);
    });
  });

  it("as mensagens voltam da mais recente para a mais antiga", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createWhatsAppRepository(tx, { schoolId: escola.id });

      await repo.insertMessage({
        toPhoneE164: "+5586998122039",
        kind: "texto",
        renderedText: "Primeira",
        createdAt: new Date("2026-09-20T10:00:00Z"),
      });
      await repo.insertMessage({
        toPhoneE164: "+5586998122039",
        kind: "texto",
        renderedText: "Segunda",
        createdAt: new Date("2026-09-21T10:00:00Z"),
      });

      const mensagens = await repo.listMessages();
      expect(mensagens.map((m) => m.renderedText)).toEqual(["Segunda", "Primeira"]);
    });
  });
});
