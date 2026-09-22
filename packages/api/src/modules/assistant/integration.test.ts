import { assistantSettings } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import type { LanguageModel } from "../../integrations/model/client";
import { createTestSchool, createTestUser } from "../../testing/fixtures";
import { createAssistantRepository } from "./repository";
import { createAssistantService } from "./service";

afterAll(async () => {
  await closeTestDb();
});

const CHAVE = Buffer.alloc(32, 3).toString("base64");
const SEGREDO = "sk-credencial-de-verdade-9XK2";

/**
 * A cadeia inteira, sem dublê no meio: serviço, repositório de verdade,
 * cifragem de verdade e Postgres de verdade. Só o provedor é falso.
 *
 * Os testes de unidade cobrem cada peça; este cobre a costura — que é onde o
 * defeito aparece quando alguém troca `encrypt` por `base64`, esquece de
 * gravar o IV, ou decide "otimizar" o `upsert` parcial.
 */
describe("Astro, de ponta a ponta", () => {
  const modeloQueEcoa = (visto: { sistema?: string }): LanguageModel => ({
    responder: async ({ sistema }) => {
      visto.sistema = sistema;
      return { texto: "São 289 alunos ativos.", tokens: 87 };
    },
    listarModelos: async () => ["modelo-x"],
  });

  it("grava cifrado, decifra na pergunta e nunca devolve a credencial", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx, "Dom Pedro II");
      const conta = await createTestUser(tx);
      const visto: { sistema?: string } = {};

      const servico = createAssistantService(
        createAssistantRepository(tx, { schoolId: escola.id }),
        { now: () => new Date(), chave: CHAVE, modelo: () => modeloQueEcoa(visto) },
      );

      const salva = await servico.salvar(
        {
          enabled: true,
          providerLabel: "Provedor de teste",
          baseUrl: "https://api.exemplo.com/v1",
          model: "modelo-x",
          apiKey: SEGREDO,
          maxTokens: 300,
          dailyLimit: 5,
          allowTeachers: true,
          allowStudents: false,
        },
        conta.id,
      );

      // 1. O que volta para a tela não tem a credencial, em forma nenhuma.
      expect(JSON.stringify(salva)).not.toContain(SEGREDO);
      expect(salva.credencialGravada).toBe(true);
      expect(salva.apiKeyHint).toBe("••••9XK2");

      // 2. O que está no banco também não: um dump sem a chave devolve ruído.
      const [linha] = await tx
        .select()
        .from(assistantSettings)
        .where(eq(assistantSettings.schoolId, escola.id));
      expect(JSON.stringify(linha)).not.toContain(SEGREDO);
      expect(linha?.apiKeyIv).toBeTruthy();
      expect(linha?.apiKeyTag).toBeTruthy();

      // 3. E mesmo assim a pergunta funciona: a chave é decifrada na hora.
      const resposta = await servico.perguntar(
        { pergunta: "quantos alunos ativos?", fatos: "Alunos ativos: 289." },
        { userId: conta.id, role: "owner", nome: "Marina", escola: "Dom Pedro II" },
      );

      expect(resposta.texto).toBe("São 289 alunos ativos.");
      expect(resposta.restantesHoje).toBe(4);

      // 4. O que foi ao modelo carrega os fatos e não carrega a credencial.
      expect(visto.sistema).toContain("Alunos ativos: 289.");
      expect(visto.sistema).not.toContain(SEGREDO);
    });
  });

  /** O comportamento que a tela promete a cada edição de nome do modelo. */
  it("editar sem redigitar a credencial mantém a chave funcionando", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const visto: { sistema?: string } = {};

      const servico = createAssistantService(
        createAssistantRepository(tx, { schoolId: escola.id }),
        { now: () => new Date(), chave: CHAVE, modelo: () => modeloQueEcoa(visto) },
      );

      const base = {
        enabled: true,
        baseUrl: "https://api.exemplo.com/v1",
        model: "modelo-x",
        maxTokens: 300,
        dailyLimit: 5,
        allowTeachers: true,
        allowStudents: false,
      };

      await servico.salvar({ ...base, apiKey: SEGREDO }, conta.id);
      // Sem `apiKey`: só troca o modelo.
      const depois = await servico.salvar({ ...base, model: "modelo-y" }, conta.id);

      expect(depois.model).toBe("modelo-y");
      expect(depois.credencialGravada).toBe(true);
      expect(depois.apiKeyHint).toBe("••••9XK2");

      await expect(
        servico.perguntar(
          { pergunta: "oi", fatos: "x" },
          { userId: conta.id, role: "owner", nome: "M", escola: "E" },
        ),
      ).resolves.toMatchObject({ texto: "São 289 alunos ativos." });
    });
  });

  /**
   * Chave errada não pode devolver lixo silencioso: o GCM autentica, e a
   * etiqueta tem de estourar. É o que impede uma credencial adulterada no
   * banco de virar requisição com segredo de outra pessoa.
   */
  it("credencial não abre com a chave errada", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);
      const repo = createAssistantRepository(tx, { schoolId: escola.id });

      const comChaveCerta = createAssistantService(repo, {
        now: () => new Date(),
        chave: CHAVE,
        modelo: () => modeloQueEcoa({}),
      });

      await comChaveCerta.salvar(
        {
          enabled: true,
          baseUrl: "https://api.exemplo.com/v1",
          model: "modelo-x",
          apiKey: SEGREDO,
          maxTokens: 300,
          dailyLimit: 5,
          allowTeachers: true,
          allowStudents: false,
        },
        conta.id,
      );

      const comOutraChave = createAssistantService(repo, {
        now: () => new Date(),
        chave: Buffer.alloc(32, 9).toString("base64"),
        modelo: () => modeloQueEcoa({}),
      });

      await expect(
        comOutraChave.perguntar(
          { pergunta: "oi", fatos: "x" },
          { userId: conta.id, role: "owner", nome: "M", escola: "E" },
        ),
      ).rejects.toThrow();
    });
  });

  it("o teto diário conta o que foi gravado de verdade", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const conta = await createTestUser(tx);

      const servico = createAssistantService(
        createAssistantRepository(tx, { schoolId: escola.id }),
        { now: () => new Date(), chave: CHAVE, modelo: () => modeloQueEcoa({}) },
      );

      await servico.salvar(
        {
          enabled: true,
          baseUrl: "https://api.exemplo.com/v1",
          model: "modelo-x",
          apiKey: SEGREDO,
          maxTokens: 300,
          dailyLimit: 2,
          allowTeachers: true,
          allowStudents: false,
        },
        conta.id,
      );

      const quem = { userId: conta.id, role: "owner" as const, nome: "M", escola: "E" };
      const perguntar = () => servico.perguntar({ pergunta: "oi", fatos: "x" }, quem);

      expect((await perguntar()).restantesHoje).toBe(1);
      expect((await perguntar()).restantesHoje).toBe(0);
      await expect(perguntar()).rejects.toThrow(/limite de 2 perguntas/);
    });
  });
});
