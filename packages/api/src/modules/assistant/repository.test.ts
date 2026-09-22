import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import { createTestMembership, createTestSchool, createTestUser } from "../../testing/fixtures";
import { createAssistantRepository } from "./repository";

afterAll(async () => {
  await closeTestDb();
});

describe("createAssistantRepository", () => {
  it("cria a configuração na primeira gravação e atualiza depois", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createAssistantRepository(tx, { schoolId: escola.id });

      expect(await repo.find()).toBeNull();

      await repo.save({ model: "modelo-x", enabled: false });
      expect(await repo.find()).toMatchObject({ model: "modelo-x", enabled: false });

      await repo.save({ model: "modelo-y" });
      const depois = await repo.find();
      expect(depois?.model).toBe("modelo-y");
      // O default da coluna continua valendo: o `upsert` não zera o resto.
      expect(depois?.dailyLimit).toBe(200);
    });
  });

  /**
   * O comportamento que a tela promete: salvar sem redigitar a credencial
   * mantém a que está lá. Um `set` que incluísse as colunas com `undefined`
   * apagaria a chave a cada edição de nome do modelo.
   */
  it("gravação parcial não apaga a credencial", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const repo = createAssistantRepository(tx, { schoolId: escola.id });

      await repo.save({ apiKeyCipher: "c", apiKeyIv: "i", apiKeyTag: "t", apiKeyHint: "••••7Z9K" });
      await repo.save({ model: "modelo-x" });

      expect(await repo.find()).toMatchObject({ apiKeyCipher: "c", apiKeyHint: "••••7Z9K" });
    });
  });

  it("não lê a configuração da outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");

      await createAssistantRepository(tx, { schoolId: a.id }).save({
        apiKeyCipher: "segredo-da-a",
      });

      expect(await createAssistantRepository(tx, { schoolId: b.id }).find()).toBeNull();
    });
  });

  it("conta o uso a partir do instante pedido", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      await createTestMembership(tx, { schoolId: escola.id, userId: conta.id, role: "owner" });
      const repo = createAssistantRepository(tx, { schoolId: escola.id });

      const ontem = new Date(Date.now() - 86_400_000);

      for (let i = 0; i < 3; i += 1) {
        await repo.recordUsage({ userId: conta.id, role: "owner", tokens: 10 });
      }

      expect(await repo.usoDesde(ontem)).toEqual({ perguntas: 3, tokens: 30, semContagem: 0 });
      // Janela que começa no futuro não conta nada: é o que faz o teto zerar
      // à meia-noite em vez de acumular para sempre.
      expect(await repo.usoDesde(new Date(Date.now() + 60_000))).toEqual({
        perguntas: 0,
        tokens: 0,
        semContagem: 0,
      });
    });
  });

  it("o teto de uma escola não é consumido pela outra", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "A");
      const b = await createTestSchool(tx, "B");
      const conta = await createTestUser(tx);
      await createTestMembership(tx, { schoolId: a.id, userId: conta.id, role: "owner" });

      await createAssistantRepository(tx, { schoolId: a.id }).recordUsage({
        userId: conta.id,
        role: "owner",
        tokens: 10,
      });

      const ontem = new Date(Date.now() - 86_400_000);
      expect(await createAssistantRepository(tx, { schoolId: b.id }).usoDesde(ontem)).toEqual({
        perguntas: 0,
        tokens: 0,
        semContagem: 0,
      });
    });
  });

  /** O provedor nem sempre informa tokens; a coluna precisa aceitar nulo. */
  it("aceita uso sem contagem de tokens", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      await createTestMembership(tx, { schoolId: escola.id, userId: conta.id, role: "teacher" });
      const repo = createAssistantRepository(tx, { schoolId: escola.id });

      await repo.recordUsage({ userId: conta.id, role: "teacher", tokens: null });

      // A pergunta conta para o teto diário; o token não entra no orçamento,
      // e `semContagem` é o que impede o mês de parecer mais barato do que foi.
      expect(await repo.usoDesde(new Date(Date.now() - 60_000))).toEqual({
        perguntas: 1,
        tokens: 0,
        semContagem: 1,
      });
    });
  });
});
