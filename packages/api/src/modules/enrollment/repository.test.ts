import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import { createManualMessenger } from "../../messaging/messenger";
import {
  createTestClassroom,
  createTestSchool,
  createTestStudent,
  createTestUser,
} from "../../testing/fixtures";
import { createStudentRepository } from "../student/repository";
import { createEnrollmentRepository } from "./repository";
import { createEnrollmentService } from "./service";

afterAll(async () => {
  await closeTestDb();
});

const ANO = 2026;

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

/**
 * O `userId` precisa existir de verdade: `enrollment.created_by_user_id` tem
 * chave estrangeira, e é ela que garante que a trilha aponte para gente real.
 */
async function serviceFor(tx: Tx, schoolId: string) {
  const operador = await createTestUser(tx);
  return createEnrollmentService(createEnrollmentRepository(tx, { schoolId }), {
    now: () => new Date("2026-09-21T12:00:00Z"),
    messenger: createManualMessenger(),
    linkBaseUrl: "http://localhost:3001",
    schoolName: "Escola Teste",
    actor: { userId: operador.id },
  });
}

describe("createEnrollmentRepository", () => {
  it("carimba a escola do tenant na criação", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const aluno = await createTestStudent(tx, { schoolId: escola.id });
      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });

      const criada = await repo.create({ studentId: aluno.id, academicYear: ANO });

      expect(criada.schoolId).toBe(escola.id);
    });
  });

  /**
   * O índice é parcial: só `ativa` é exclusiva. Cancelar e rematricular no
   * mesmo ano é rotina, então pendentes e canceladas precisam coexistir.
   */
  it("RN-040: recusa duas matrículas ativas do mesmo aluno no mesmo ano", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const aluno = await createTestStudent(tx, { schoolId: escola.id });
      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });

      await repo.create({ studentId: aluno.id, academicYear: ANO, status: "ativa" });

      await expect(
        repo.create({ studentId: aluno.id, academicYear: ANO, status: "ativa" }),
      ).rejects.toThrow();
    });
  });

  it("mas aceita uma ativa ao lado de pendentes e canceladas", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const aluno = await createTestStudent(tx, { schoolId: escola.id });
      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });

      await repo.create({ studentId: aluno.id, academicYear: ANO, status: "cancelada" });
      await repo.create({ studentId: aluno.id, academicYear: ANO, status: "pendente" });
      const ativa = await repo.create({
        studentId: aluno.id,
        academicYear: ANO,
        status: "ativa",
      });

      expect(ativa.status).toBe("ativa");
    });
  });

  it("não enxerga matrícula de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      const aluno = await createTestStudent(tx, { schoolId: a.id });

      const daA = createEnrollmentRepository(tx, { schoolId: a.id });
      const daB = createEnrollmentRepository(tx, { schoolId: b.id });

      const criada = await daA.create({ studentId: aluno.id, academicYear: ANO });

      expect(await daB.findById(criada.id)).toBeNull();
      expect(await daB.update(criada.id, { status: "ativa" })).toBeNull();
      expect(await daA.findById(criada.id)).not.toBeNull();
    });
  });

  it("o histórico é somente de acréscimo e sai do mais recente para o mais antigo", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const aluno = await createTestStudent(tx, { schoolId: escola.id });
      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });
      const matricula = await repo.create({ studentId: aluno.id, academicYear: ANO });

      await repo.appendEvent({ enrollmentId: matricula.id, type: "criada", actor: "gestao" });
      await repo.appendEvent({
        enrollmentId: matricula.id,
        type: "link_gerado",
        actor: "gestao",
      });

      const events = await repo.listEvents(matricula.id);

      expect(events).toHaveLength(2);
      // O repositório não expõe update nem delete de evento — é a trilha.
      expect(Object.keys(repo)).not.toContain("updateEvent");
      expect(Object.keys(repo)).not.toContain("removeEvent");
    });
  });
});

describe("createEnrollmentService, contra o banco", () => {
  /**
   * O invariante que sustenta a projeção: matrícula confirmada implica aluno
   * na chamada da turma.
   *
   * `student.classroomId` e `student.status` continuam sendo o que a chamada
   * lê. Se a confirmação deixasse de escrever essa projeção, a matrícula
   * constaria ativa e o professor não veria o aluno.
   */
  it("confirmar coloca o aluno em listByClassroom da turma", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "6º B", ANO);
      const service = await serviceFor(tx, escola.id);

      const criada = await service.create({
        student: { name: "Rafael Moraes", birthDate: "2015-03-14", shift: "manha" },
        guardian: {
          name: "Sandra Moraes",
          relationship: "mae",
          phoneE164: "+5586998122039",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      const alunosRepo = createStudentRepository(tx, { schoolId: escola.id });
      expect(await alunosRepo.listByClassroom(turma.id)).toHaveLength(0);

      await service.confirm({ id: criada.id });

      const naSala = await alunosRepo.listByClassroom(turma.id);
      expect(naSala.map((aluno) => aluno.name)).toEqual(["Rafael Moraes"]);
    });
  });

  it("cancelar tira da chamada e preserva a turma no cadastro", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "7º A", ANO);
      const service = await serviceFor(tx, escola.id);

      const criada = await service.create({
        student: { name: "Bruno Carvalho", birthDate: "2014-05-02", shift: "tarde" },
        guardian: {
          name: "Paulo Carvalho",
          relationship: "pai",
          phoneE164: "+5586998127715",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });
      await service.confirm({ id: criada.id });

      await service.cancel({
        id: criada.id,
        reason: "mudanca_de_cidade",
        note: null,
        effectiveOn: "2026-09-30",
      });

      const alunosRepo = createStudentRepository(tx, { schoolId: escola.id });
      expect(await alunosRepo.listByClassroom(turma.id)).toHaveLength(0);

      // A turma fica no cadastro: os lançamentos antigos continuam casando.
      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });
      const matricula = await repo.findById(criada.id);
      const aluno = await repo.findStudentById(matricula?.studentId ?? "");
      expect(aluno?.classroomId).toBe(turma.id);
      expect(aluno?.status).toBe("inativo");
    });
  });

  it("RN-041, na medida do possível: turma de outro ano letivo é recusada", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turmaDeOutroAno = await createTestClassroom(tx, escola.id, "8º A", ANO - 1);
      const service = await serviceFor(tx, escola.id);

      await expect(
        service.create({
          student: { name: "Letícia Farias", birthDate: "2013-11-20", shift: "manha" },
          guardian: {
            name: "Márcia Farias",
            relationship: "mae",
            phoneE164: "+5586998128820",
            isLegal: true,
          },
          classroomId: turmaDeOutroAno.id,
          academicYear: ANO,
          expiryDays: 7,
        }),
      ).rejects.toThrow(/2025/);
    });
  });

  it("renovar herda o responsável e amarra a matrícula de origem", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "9º B", ANO);
      const service = await serviceFor(tx, escola.id);

      const criada = await service.create({
        student: { name: "Isabela Souto", birthDate: "2012-01-09", shift: "manha" },
        guardian: {
          name: "Fábio Souto",
          relationship: "pai",
          phoneE164: "+5586998125508",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });
      await service.confirm({ id: criada.id });

      const renovada = await service.renew({
        id: criada.id,
        academicYear: ANO + 1,
        classroomId: null,
        expiryDays: 7,
      });

      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });
      const nova = await repo.findById(renovada.id);
      expect(nova?.kind).toBe("rematricula");
      expect(nova?.previousEnrollmentId).toBe(criada.id);
      expect(nova?.academicYear).toBe(ANO + 1);

      const responsaveis = await repo.listGuardians(renovada.id);
      expect(responsaveis.map((r) => r.name)).toEqual(["Fábio Souto"]);
    });
  });

  it("renovar para o mesmo ano é recusado", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "6º A", ANO);
      const service = await serviceFor(tx, escola.id);

      const criada = await service.create({
        student: { name: "Thiago Nunes", birthDate: "2015-07-07", shift: "manha" },
        guardian: {
          name: "Eliane Nunes",
          relationship: "mae",
          phoneE164: "+5586998121192",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      await expect(
        service.renew({ id: criada.id, academicYear: ANO, classroomId: null, expiryDays: 7 }),
      ).rejects.toThrow(/posterior/);
    });
  });

  /** O link só existe na resposta da criação: nada o devolve depois. */
  it("a criação devolve o endereço uma única vez, e ele não volta na leitura", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "8º A", ANO);
      const service = await serviceFor(tx, escola.id);

      const criada = await service.create({
        student: { name: "Helena Lacerda", birthDate: "2013-02-18", shift: "manha" },
        guardian: {
          name: "Cristina Lacerda",
          relationship: "mae",
          phoneE164: "+5586998124471",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      expect(criada.url).toContain("/matricula/");
      const token = criada.url.split("/matricula/")[1] ?? "";
      expect(token.length).toBeGreaterThan(20);

      const detail = await service.get(criada.id);
      expect(JSON.stringify(detail)).not.toContain(token);
    });
  });
});

describe("numeração da matrícula", () => {
  it("continua a sequência do ano e ignora número fora do formato", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const service = await serviceFor(tx, escola.id);

      await createTestStudent(tx, { schoolId: escola.id, registration: `${ANO}-1113` });
      await createTestStudent(tx, { schoolId: escola.id, registration: `${ANO}-1257` });
      // Herdado de outro sistema: seis dígitos. Não pode empurrar a sequência
      // para 2026-259987, que foi exatamente o defeito visto na tela.
      await createTestStudent(tx, { schoolId: escola.id, registration: `${ANO}-259986` });

      expect(await service.nextRegistration(ANO)).toBe(`${ANO}-1258`);
    });
  });

  it("começa em 0001 quando o ano ainda não tem ninguém", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const service = await serviceFor(tx, escola.id);

      expect(await service.nextRegistration(ANO)).toBe(`${ANO}-0001`);
    });
  });

  it("a criação sem número informado usa a sequência", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "6º A", ANO);
      const service = await serviceFor(tx, escola.id);
      await createTestStudent(tx, { schoolId: escola.id, registration: `${ANO}-0041` });

      const criada = await service.create({
        student: { name: "Isadora Pires", birthDate: "2015-06-01", shift: "manha" },
        guardian: {
          name: "Célia Pires",
          relationship: "mae",
          phoneE164: "+5586998120000",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      const detail = await service.get(criada.id);
      expect(detail.registration).toBe(`${ANO}-0042`);
    });
  });

  it("a numeração não enxerga a sequência de outra escola", async () => {
    await withRollback(async (tx) => {
      const a = await createTestSchool(tx, "Escola A");
      const b = await createTestSchool(tx, "Escola B");
      await createTestStudent(tx, { schoolId: a.id, registration: `${ANO}-0500` });

      const daB = await serviceFor(tx, b.id);
      expect(await daB.nextRegistration(ANO)).toBe(`${ANO}-0001`);
    });
  });
});

/**
 * O buraco que esta PR fecha: o consentimento de biometria só era capturado
 * dentro da ficha, e a ficha só vive enquanto a matrícula está pendente.
 * Depois de confirmada não havia caminho nenhum para autorizar — e família
 * decide depois o tempo todo, ou a foto é tirada noutro dia.
 */
describe("autorização de biometria depois da matrícula confirmada", () => {
  const tokenDe = (url: string) => url.split("/").at(-1) as string;

  async function linkServiceFor(tx: Tx) {
    const { createInviteLookup, createEnrollmentLinkRepository } = await import(
      "../enrollment-link/repository"
    );
    const { createEnrollmentLinkService } = await import("../enrollment-link/service");
    return createEnrollmentLinkService({
      lookup: createInviteLookup(tx),
      repoFor: (tenant) => createEnrollmentRepository(tx, tenant),
      linkRepoFor: (tenant) => createEnrollmentLinkRepository(tx, tenant),
      now: () => new Date("2026-09-21T12:10:00Z"),
    });
  }

  async function cenarioConfirmado(tx: Tx) {
    const escola = await createTestSchool(tx);
    const turma = await createTestClassroom(tx, escola.id, "5º A", ANO);
    const service = await serviceFor(tx, escola.id);

    const criada = await service.create({
      student: { name: "Helena Prado", birthDate: "2016-07-09", shift: "manha" },
      guardian: {
        name: "Vera Prado",
        relationship: "mae",
        phoneE164: "+5586998122039",
        isLegal: true,
      },
      classroomId: turma.id,
      academicYear: ANO,
      expiryDays: 7,
    });
    await service.confirm({ id: criada.id });

    return { escola, service, enrollmentId: criada.id, recordLink: criada.url };
  }

  it("a secretaria pede, a família autoriza, e o consentimento passa a valer", async () => {
    await withRollback(async (tx) => {
      const c = await cenarioConfirmado(tx);
      const repo = createEnrollmentRepository(tx, { schoolId: c.escola.id });

      const pedido = await c.service.emitirAutorizacaoBiometria(c.enrollmentId);
      const link = await linkServiceFor(tx);
      const token = tokenDe(pedido.url);

      // A tela pública precisa saber que é o link curto antes de perguntar.
      const aberto = await link.open(token);
      expect(aberto.state).toBe("conferencia");
      expect("finalidade" in aberto && aberto.finalidade).toBe("biometria");

      await link.verify({ token, birthDate: "2016-07-09" });
      const saida = await link.autorizarBiometria(
        { token, autoriza: true, acceptedBy: "Vera Prado" },
        {},
      );

      expect(saida.autorizou).toBe(true);

      const { createGateRepository } = await import("../gate/repository");
      const portaria = createGateRepository(tx, { schoolId: c.escola.id });
      const detail = await repo.findDetail(c.enrollmentId);
      const studentId = detail?.enrollment.studentId as string;
      expect(studentId).toBeTruthy();
      expect(await portaria.hasBiometricConsent(studentId)).toBe(true);
    });
  });

  /**
   * "Nunca respondeu" e "disse não" são coisas diferentes para quem confere
   * depois. Só registrar o sim apagaria a segunda.
   */
  it("recusar também é resposta, e fica gravada", async () => {
    await withRollback(async (tx) => {
      const c = await cenarioConfirmado(tx);
      const pedido = await c.service.emitirAutorizacaoBiometria(c.enrollmentId);
      const link = await linkServiceFor(tx);
      const token = tokenDe(pedido.url);

      await link.verify({ token, birthDate: "2016-07-09" });
      await link.autorizarBiometria({ token, autoriza: false, acceptedBy: "Vera Prado" }, {});

      const repo = createEnrollmentRepository(tx, { schoolId: c.escola.id });
      const events = await repo.listEvents(c.enrollmentId);
      expect(events.some((e) => e.type === "consentimento_atualizado")).toBe(true);

      const { createGateRepository } = await import("../gate/repository");
      const portaria = createGateRepository(tx, { schoolId: c.escola.id });
      const detail = await repo.findDetail(c.enrollmentId);
      const studentId = detail?.enrollment.studentId as string;
      // Sem esta linha o teste passaria por acidente: um id indefinido também
      // não acha consentimento, e "false" diria nada.
      expect(studentId).toBeTruthy();
      expect(await portaria.hasBiometricConsent(studentId)).toBe(false);
    });
  });

  /**
   * Dois atos diferentes com a mesma prova de posse. Se um respondesse pelo
   * outro, quem tem o link da ficha gravaria consentimento sem ver os termos.
   */
  it("o link da ficha não responde à pergunta da biometria", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "4º B", ANO);
      const service = await serviceFor(tx, escola.id);
      const criada = await service.create({
        student: { name: "Tiago Lemos", birthDate: "2017-01-20", shift: "tarde" },
        guardian: {
          name: "Rita Lemos",
          relationship: "mae",
          phoneE164: "+5586998122039",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      const link = await linkServiceFor(tx);
      const token = tokenDe(criada.url);
      await link.verify({ token, birthDate: "2017-01-20" });

      await expect(
        link.autorizarBiometria({ token, autoriza: true, acceptedBy: "Rita Lemos" }, {}),
      ).rejects.toThrow(/não é o de autorização/i);
    });
  });

  /** Matrícula cancelada não pede biometria: o aluno saiu da escola. */
  it("matrícula cancelada não pede autorização", async () => {
    await withRollback(async (tx) => {
      const c = await cenarioConfirmado(tx);
      await c.service.cancel({
        id: c.enrollmentId,
        reason: "mudanca_de_cidade",
        effectiveOn: "2026-09-21",
      });

      await expect(c.service.emitirAutorizacaoBiometria(c.enrollmentId)).rejects.toThrow(
        /cancelada/i,
      );
    });
  });
});

/**
 * O caminho da secretaria, pedido explicitamente: nem toda família abre link,
 * e nem toda tem aparelho. O que o torna auditável é a linha dizer que foi
 * presencial, quem declarou e quem registrou.
 */
describe("autorização registrada presencialmente", () => {
  it("grava a origem, quem declarou e quem registrou", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "3º A", ANO);
      const service = await serviceFor(tx, escola.id);
      const criada = await service.create({
        student: { name: "Lívia Antunes", birthDate: "2018-02-11", shift: "manha" },
        guardian: {
          name: "Célia Antunes",
          relationship: "mae",
          phoneE164: "+5586998122039",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });
      await service.confirm({ id: criada.id });

      await service.registrarAutorizacaoPresencial({
        id: criada.id,
        purpose: "biometria",
        granted: true,
        declaredBy: "Célia Antunes",
      });

      const repo = createEnrollmentRepository(tx, { schoolId: escola.id });
      const consents = await repo.listConsents(criada.id);
      const biometria = consents.find((c) => c.purpose === "biometria" && c.granted);

      expect(biometria?.origin).toBe("presencial");
      expect(biometria?.actorName).toBe("Célia Antunes");
      // Sem o registrador, "a mãe declarou no balcão" e "a escola marcou
      // sozinha" ficam idênticos no banco.
      expect(biometria?.registeredByUserId).toBeTruthy();

      const detail = await repo.findDetail(criada.id);
      const { createGateRepository } = await import("../gate/repository");
      const portaria = createGateRepository(tx, { schoolId: escola.id });
      expect(await portaria.hasBiometricConsent(detail?.enrollment.studentId as string)).toBe(true);
    });
  });

  it("exige o nome de quem autorizou", async () => {
    await withRollback(async (tx) => {
      const escola = await createTestSchool(tx);
      const turma = await createTestClassroom(tx, escola.id, "3º B", ANO);
      const service = await serviceFor(tx, escola.id);
      const criada = await service.create({
        student: { name: "Otávio Reis", birthDate: "2018-06-01", shift: "tarde" },
        guardian: {
          name: "Ana Reis",
          relationship: "mae",
          phoneE164: "+5586998122039",
          isLegal: true,
        },
        classroomId: turma.id,
        academicYear: ANO,
        expiryDays: 7,
      });

      await expect(
        service.registrarAutorizacaoPresencial({
          id: criada.id,
          purpose: "biometria",
          granted: true,
          declaredBy: "   ",
        }),
      ).rejects.toThrow(/quem autorizou/i);
    });
  });
});
