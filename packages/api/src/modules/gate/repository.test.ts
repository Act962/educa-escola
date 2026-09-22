import { enrollmentConsent, studentFaceTemplate } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  createTestClassroom,
  createTestEnrollment,
  createTestSchool,
  createTestStudent,
  createTestUser,
} from "../../testing/fixtures";
import { createGateRepository } from "./repository";
import { cifrarMolde } from "./segredo";

const CHAVE = Buffer.alloc(32, 9).toString("base64");

afterAll(closeTestDb);

/** Uma escola com um aluno matriculado em turma, que é o caso da portaria. */
async function cenario(tx: Parameters<Parameters<typeof withRollback>[0]>[0], nome = "Escola A") {
  const escola = await createTestSchool(tx, nome);
  const turma = await createTestClassroom(tx, escola.id, "9º C");
  const operador = await createTestUser(tx);
  const aluno = await createTestStudent(tx, {
    schoolId: escola.id,
    classroomId: turma.id,
    name: "Weydson Lima",
  });
  const matricula = await createTestEnrollment(tx, {
    schoolId: escola.id,
    studentId: aluno.id,
    status: "ativa",
  });

  return {
    escola,
    aluno,
    operador,
    matricula,
    repo: createGateRepository(tx, { schoolId: escola.id }),
  };
}

async function autorizarBiometria(
  tx: Parameters<Parameters<typeof withRollback>[0]>[0],
  input: { schoolId: string; enrollmentId: string; granted?: boolean; revoked?: boolean },
) {
  await tx.insert(enrollmentConsent).values({
    schoolId: input.schoolId,
    enrollmentId: input.enrollmentId,
    purpose: "biometria",
    termVersion: "2026.1",
    granted: input.granted ?? true,
    revokedAt: input.revoked ? new Date() : null,
    actorName: "Responsável Teste",
  });
}

describe("createGateRepository", () => {
  it("guarda o molde cifrado e o devolve com o extrator", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const cifrado = cifrarMolde([0.1, 0.2, 0.3], CHAVE);

      await c.repo.saveTemplate({
        studentId: c.aluno.id,
        ...cifrado,
        authTag: cifrado.authTag,
        dimensions: 3,
        extractor: "ext-a",
        enrolledByUserId: c.operador.id,
      });

      const moldes = await c.repo.listTemplates();
      expect(moldes).toHaveLength(1);
      expect(moldes[0]?.extractor).toBe("ext-a");

      // O que está na coluna é ruído: o vetor em claro não aparece no banco.
      const [linha] = await tx
        .select({ cipher: studentFaceTemplate.cipher })
        .from(studentFaceTemplate)
        .where(eq(studentFaceTemplate.studentId, c.aluno.id));
      expect(linha?.cipher).not.toContain("0.1");
    });
  });

  /** Recadastrar substitui: dois moldes do mesmo aluno disputariam a leitura. */
  it("um molde por aluno", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const base = {
        studentId: c.aluno.id,
        dimensions: 3,
        extractor: "ext-a",
        enrolledByUserId: c.operador.id,
      };

      await c.repo.saveTemplate({ ...base, ...cifrarMolde([0, 0, 0], CHAVE) });
      await c.repo.saveTemplate({ ...base, ...cifrarMolde([1, 1, 1], CHAVE) });

      expect(await c.repo.listTemplates()).toHaveLength(1);
    });
  });

  /**
   * Aluno que saiu da escola não pode continuar disputando identificação — o
   * rosto dele abriria o portão de uma escola onde ele não estuda mais.
   */
  it("o lote ignora aluno fora da matrícula ativa", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const saiu = await createTestStudent(tx, {
        schoolId: c.escola.id,
        name: "Transferido",
        status: "transferido",
      });

      for (const id of [c.aluno.id, saiu.id]) {
        await c.repo.saveTemplate({
          studentId: id,
          ...cifrarMolde([0, 0, 0], CHAVE),
          dimensions: 3,
          extractor: "ext-a",
          enrolledByUserId: c.operador.id,
        });
      }

      const moldes = await c.repo.listTemplates();
      expect(moldes.map((m) => m.studentId)).toEqual([c.aluno.id]);
    });
  });

  it("o molde de uma escola não é visível pela outra", async () => {
    await withRollback(async (tx) => {
      const a = await cenario(tx, "Escola A");
      const b = await cenario(tx, "Escola B");

      await a.repo.saveTemplate({
        studentId: a.aluno.id,
        ...cifrarMolde([0, 0, 0], CHAVE),
        dimensions: 3,
        extractor: "ext-a",
        enrolledByUserId: a.operador.id,
      });

      expect(await b.repo.listTemplates()).toHaveLength(0);
      expect(await b.repo.findStudent(a.aluno.id)).toBeNull();
    });
  });

  describe("consentimento de biometria", () => {
    it("reconhece o aceite vigente", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        await autorizarBiometria(tx, { schoolId: c.escola.id, enrollmentId: c.matricula.id });

        expect(await c.repo.hasBiometricConsent(c.aluno.id)).toBe(true);
      });
    });

    it("sem aceite nenhum, não autoriza", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        expect(await c.repo.hasBiometricConsent(c.aluno.id)).toBe(false);
      });
    });

    /** A pergunta é "vale agora?", não "existe linha?". */
    it("aceite revogado não autoriza", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        await autorizarBiometria(tx, {
          schoolId: c.escola.id,
          enrollmentId: c.matricula.id,
          revoked: true,
        });

        expect(await c.repo.hasBiometricConsent(c.aluno.id)).toBe(false);
      });
    });

    it("recusa explícita não autoriza", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        await autorizarBiometria(tx, {
          schoolId: c.escola.id,
          enrollmentId: c.matricula.id,
          granted: false,
        });

        expect(await c.repo.hasBiometricConsent(c.aluno.id)).toBe(false);
      });
    });
  });

  describe("passagens", () => {
    const passar = (
      c: Awaited<ReturnType<typeof cenario>>,
      direction: "entrada" | "saida",
      minutos: number,
    ) =>
      c.repo.recordEntry({
        studentId: c.aluno.id,
        direction,
        method: "rosto",
        operatorUserId: c.operador.id,
        deviceLabel: "Portaria 1",
        occurredAt: new Date(Date.now() - minutos * 60_000),
      });

    /**
     * Conta quem tem `entrada` como passagem mais recente — e não entradas
     * menos saídas: portão de escola relê a mesma pessoa o tempo todo, e a
     * subtração daria número negativo num dia movimentado.
     */
    it("quem está dentro é quem entrou por último", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        const inicio = new Date(Date.now() - 86_400_000);

        await passar(c, "entrada", 120);
        expect(await c.repo.presentCount(inicio)).toBe(1);

        await passar(c, "saida", 60);
        expect(await c.repo.presentCount(inicio)).toBe(0);

        await passar(c, "entrada", 10);
        expect(await c.repo.presentCount(inicio)).toBe(1);

        // Entrada repetida não soma duas vezes a mesma pessoa.
        await passar(c, "entrada", 5);
        expect(await c.repo.presentCount(inicio)).toBe(1);
      });
    });

    it("a última passagem do aluno vem com a direção", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        await passar(c, "entrada", 30);
        await passar(c, "saida", 5);

        const ultima = await c.repo.lastEntryOf(c.aluno.id, new Date(Date.now() - 86_400_000));
        expect(ultima?.direction).toBe("saida");
      });
    });

    it("a passagem de uma escola não conta para a outra", async () => {
      await withRollback(async (tx) => {
        const a = await cenario(tx, "Escola A");
        const b = await cenario(tx, "Escola B");
        await passar(a, "entrada", 10);

        expect(await b.repo.presentCount(new Date(Date.now() - 86_400_000))).toBe(0);
      });
    });

    it("a lista traz nome e turma para a tela da gestão", async () => {
      await withRollback(async (tx) => {
        const c = await cenario(tx);
        await passar(c, "entrada", 10);

        const [linha] = await c.repo.listEntries({
          desde: new Date(Date.now() - 86_400_000),
          ate: new Date(Date.now() + 86_400_000),
          limite: 10,
        });
        expect(linha?.name).toBe("Weydson Lima");
        expect(linha?.classroomName).toBe("9º C");
        expect(linha?.method).toBe("rosto");
      });
    });
  });
});

describe("exclusão de passagem", () => {
  const janela = () => ({
    desde: new Date(Date.now() - 86_400_000),
    ate: new Date(Date.now() + 86_400_000),
    limite: 20,
  });

  const passar = (c: Awaited<ReturnType<typeof cenario>>) =>
    c.repo.recordEntry({
      studentId: c.aluno.id,
      direction: "entrada",
      method: "rosto",
      operatorUserId: c.operador.id,
      deviceLabel: "Portaria 1",
      occurredAt: new Date(),
    });

  /**
   * Marca, não apaga. A passagem diz a que horas uma criança entrou na escola:
   * apagar a linha destruiria a resposta e o rastro de quem a destruiu.
   */
  it("a passagem sai da lista e continua no banco, com autor e instante", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const passagem = await passar(c);

      const removida = await c.repo.softDelete(passagem.id, c.operador.id, new Date());
      expect(removida?.id).toBe(passagem.id);

      expect(await c.repo.listEntries(janela())).toHaveLength(0);

      const [excluida] = await c.repo.listEntries({ ...janela(), excluidas: true });
      expect(excluida?.id).toBe(passagem.id);
      expect(excluida?.deletedAt).toBeInstanceOf(Date);
      expect(excluida?.deletedByName).toBeTruthy();
    });
  });

  /** Excluir de novo não troca o autor da primeira — é o que a trilha guarda. */
  it("excluir duas vezes não reescreve quem excluiu", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const passagem = await passar(c);
      const outro = await createTestUser(tx);

      await c.repo.softDelete(passagem.id, c.operador.id, new Date());
      // A segunda tentativa não encontra linha: já estava excluída.
      expect(await c.repo.softDelete(passagem.id, outro.id, new Date())).toBeNull();

      const [antes] = await c.repo.listEntries({ ...janela(), excluidas: true });
      const quandoExcluiu = antes?.deletedAt;
      expect(quandoExcluiu).toBeInstanceOf(Date);
      expect(antes?.deletedByName).toBeTruthy();
    });
  });

  /**
   * Se a excluída contasse, excluir um registro errado deixaria o número de
   * quem está dentro errado do mesmo jeito.
   */
  it("passagem excluída não conta para quem está na escola", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const passagem = await passar(c);
      const inicio = new Date(Date.now() - 86_400_000);

      expect(await c.repo.presentCount(inicio)).toBe(1);
      await c.repo.softDelete(passagem.id, c.operador.id, new Date());
      expect(await c.repo.presentCount(inicio)).toBe(0);
    });
  });

  it("uma escola não exclui a passagem da outra", async () => {
    await withRollback(async (tx) => {
      const a = await cenario(tx, "Escola A");
      const b = await cenario(tx, "Escola B");
      const passagem = await passar(a);

      expect(await b.repo.softDelete(passagem.id, b.operador.id, new Date())).toBeNull();
      expect(await a.repo.listEntries(janela())).toHaveLength(1);
    });
  });

  it("filtra por aluno", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      const outro = await createTestStudent(tx, { schoolId: c.escola.id, name: "Outro Aluno" });
      await passar(c);
      await c.repo.recordEntry({
        studentId: outro.id,
        direction: "entrada",
        method: "carteirinha",
        operatorUserId: c.operador.id,
        deviceLabel: null,
        occurredAt: new Date(),
      });

      expect(await c.repo.listEntries(janela())).toHaveLength(2);
      const so = await c.repo.listEntries({ ...janela(), studentId: outro.id });
      expect(so.map((l) => l.name)).toEqual(["Outro Aluno"]);
    });
  });

  /** A janela é do dia civil: passagem de ontem não entra na lista de hoje. */
  it("filtra pela janela do dia", async () => {
    await withRollback(async (tx) => {
      const c = await cenario(tx);
      await c.repo.recordEntry({
        studentId: c.aluno.id,
        direction: "entrada",
        method: "rosto",
        operatorUserId: c.operador.id,
        deviceLabel: null,
        occurredAt: new Date(Date.now() - 3 * 86_400_000),
      });

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      const amanha = new Date(hoje.getTime() + 86_400_000);

      expect(await c.repo.listEntries({ desde: hoje, ate: amanha, limite: 20 })).toHaveLength(0);
    });
  });
});
