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

  /**
   * A consulta da janela de 24 horas: ela roda antes de todo envio de texto
   * livre e decide se a cota gratuita é consumida.
   */
  describe("a janela de atendimento", () => {
    const envio = (over: Record<string, unknown>) => ({
      toPhoneE164: "+5586998122039",
      kind: "texto",
      billingCategory: "servico" as const,
      renderedText: "Bom dia",
      status: "enviado" as const,
      ...over,
    });

    it("devolve o último envio de serviço para aquele número", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        await repo.insertMessage(
          envio({ accountId: conta.id, sentAt: new Date("2026-09-20T10:00:00Z") }),
        );
        await repo.insertMessage(
          envio({ accountId: conta.id, sentAt: new Date("2026-09-22T10:00:00Z") }),
        );

        expect(await repo.lastServiceSendTo(conta.id, "+5586998122039")).toEqual(
          new Date("2026-09-22T10:00:00Z"),
        );
      });
    });

    /**
     * Mensagem recusada pela Meta não abriu janela nenhuma. Tratá-la como se
     * tivesse aberto faria a seguinte pegar carona numa conversa que não
     * existe — e a escola pagaria por ela sem o painel avisar.
     */
    it("ignora o que falhou", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        await repo.insertMessage(
          envio({
            accountId: conta.id,
            status: "falhou",
            sentAt: new Date("2026-09-22T10:00:00Z"),
          }),
        );

        expect(await repo.lastServiceSendTo(conta.id, "+5586998122039")).toBeNull();
      });
    });

    it("mensagem por modelo não abre janela de serviço", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        await repo.insertMessage(
          envio({
            accountId: conta.id,
            kind: "modelo",
            billingCategory: "modelo",
            sentAt: new Date("2026-09-22T10:00:00Z"),
          }),
        );

        expect(await repo.lastServiceSendTo(conta.id, "+5586998122039")).toBeNull();
      });
    });

    it("cada número tem a sua janela", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        await repo.insertMessage(
          envio({ accountId: conta.id, sentAt: new Date("2026-09-22T10:00:00Z") }),
        );

        expect(await repo.lastServiceSendTo(conta.id, "+5586998122040")).toBeNull();
      });
    });
  });

  describe("o contador do mês", () => {
    it("separa conversas abertas de mensagens por modelo", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        const base = { accountId: conta.id, renderedText: "x", status: "enviado" as const };

        // Duas conversas abertas, mais uma mensagem que pegou carona.
        await repo.insertMessage({
          ...base,
          toPhoneE164: "+5586998122039",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: true,
        });
        await repo.insertMessage({
          ...base,
          toPhoneE164: "+5586998122039",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: false,
        });
        await repo.insertMessage({
          ...base,
          toPhoneE164: "+5586998122040",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: true,
        });
        await repo.insertMessage({
          ...base,
          toPhoneE164: "+5586998122041",
          kind: "modelo",
          billingCategory: "modelo",
        });

        const contagem = await repo.countBillingSince(conta.id, new Date("2026-09-01T00:00:00Z"));
        expect(contagem).toEqual({ conversas: 2, mensagensPorModelo: 1 });
      });
    });

    it("não conta o que falhou nem o que é de antes do mês", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const conta = await repo.insertAccount({ label: "Secretaria" });

        await repo.insertMessage({
          accountId: conta.id,
          toPhoneE164: "+5586998122039",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: true,
          renderedText: "x",
          status: "falhou",
        });
        await repo.insertMessage({
          accountId: conta.id,
          toPhoneE164: "+5586998122040",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: true,
          renderedText: "x",
          status: "enviado",
          createdAt: new Date("2026-08-15T10:00:00Z"),
        });

        const contagem = await repo.countBillingSince(conta.id, new Date("2026-09-01T00:00:00Z"));
        expect(contagem.conversas).toBe(0);
      });
    });

    /** Cota é por conta: o consumo de um número não come o do outro. */
    it("cada conta tem o seu contador", async () => {
      await withRollback(async (tx) => {
        const escola = await createTestSchool(tx);
        const repo = createWhatsAppRepository(tx, { schoolId: escola.id });
        const a = await repo.insertAccount({ label: "Secretaria" });
        const b = await repo.insertAccount({ label: "Unidade Centro" });

        await repo.insertMessage({
          accountId: a.id,
          toPhoneE164: "+5586998122039",
          kind: "texto",
          billingCategory: "servico",
          openedConversation: true,
          renderedText: "x",
          status: "enviado",
        });

        const desde = new Date("2026-09-01T00:00:00Z");
        expect((await repo.countBillingSince(a.id, desde)).conversas).toBe(1);
        expect((await repo.countBillingSince(b.id, desde)).conversas).toBe(0);
      });
    });
  });
});
