import { randomBytes } from "node:crypto";

import { studentPhoto } from "@educa-escola/db/schema";
import { closeTestDb, withRollback } from "@educa-escola/db/testing";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createManualMessenger } from "../../messaging/messenger";
import { createTestClassroom, createTestSchool, createTestUser } from "../../testing/fixtures";
import { createEnrollmentRepository } from "../enrollment/repository";
import { createEnrollmentService } from "../enrollment/service";
import { createGateRepository } from "../gate/repository";
import { createPhotoRepository } from "./repository";
import { createPhotoService } from "./service";

afterAll(async () => {
  await closeTestDb();
});

const ANO = 2026;
const CHAVE = randomBytes(32).toString("base64");
const JPEG = `data:image/jpeg;base64,${Buffer.from("bytes de uma foto").toString("base64")}`;

type Tx = Parameters<Parameters<typeof withRollback>[0]>[0];

/** Cria escola, turma, matrícula ativa e devolve os dois services prontos. */
async function cenario(tx: Tx, opcoes: { withoutKey?: boolean } = {}) {
  const escola = await createTestSchool(tx);
  const turma = await createTestClassroom(tx, escola.id, "6º A", ANO);
  const operador = await createTestUser(tx);
  const tenant = { schoolId: escola.id };

  const enrollments = createEnrollmentRepository(tx, tenant);
  const matriculas = createEnrollmentService(enrollments, {
    now: () => new Date("2026-09-21T12:00:00Z"),
    messenger: createManualMessenger(),
    linkBaseUrl: "http://localhost:3001",
    schoolName: "Escola Teste",
    actor: { userId: operador.id },
  });

  const criada = await matriculas.create({
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
  await matriculas.confirm({ id: criada.id });

  const detail = await matriculas.get(criada.id);
  // Portaria de verdade, e não dublê: revogar precisa apagar o molde no mesmo
  // gesto, e é esse acoplamento que o teste existe para provar.
  const faces = createGateRepository(tx, tenant);
  const photos = createPhotoService(createPhotoRepository(tx, tenant), enrollments, {
    now: () => new Date("2026-09-21T12:00:00Z"),
    encryptionKey: opcoes.withoutKey ? undefined : CHAVE,
    actor: { userId: operador.id },
    deleteFaceTemplate: (studentId) => faces.deleteTemplate(studentId),
  });

  return {
    escola,
    photos,
    faces,
    enrollments,
    enrollmentId: criada.id,
    studentId: detail.enrollment.studentId,
    tenant,
  };
}

/** Grava o aceite de biometria como se tivesse vindo do link do responsável. */
async function autorizar(tx: Tx, schoolId: string, enrollmentId: string) {
  const { createEnrollmentLinkRepository } = await import("../enrollment-link/repository");
  await createEnrollmentLinkRepository(tx, { schoolId }).recordConsents([
    {
      enrollmentId,
      purpose: "biometria",
      termVersion: "2026.1",
      granted: true,
      grantedAt: new Date("2026-09-21T12:00:00Z"),
      actorName: "Sandra Moraes",
    },
  ]);
}

describe("createPhotoService", () => {
  /**
   * A regra que sustenta tudo: autorizar foto no mural não é autorizar
   * reconhecimento facial na entrada.
   */
  it("recusa gravar foto sem consentimento de biometria", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId } = await cenario(tx);

      await expect(photos.save({ studentId, dataUrl: JPEG })).rejects.toThrow(/autorização/i);

      const status = await photos.status(studentId);
      expect(status.authorized).toBe(false);
      expect(status.photo).toBeNull();
    });
  });

  it("grava e devolve a mesma foto depois de autorizada", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId, enrollmentId, escola } = await cenario(tx);
      await autorizar(tx, escola.id, enrollmentId);

      await photos.save({ studentId, dataUrl: JPEG });

      const status = await photos.status(studentId);
      expect(status.authorized).toBe(true);
      expect(status.photo).not.toBeNull();

      const lida = await photos.read(studentId);
      expect(lida.dataUrl).toBe(JPEG);
    });
  });

  /** Um dump do banco sem a chave tem de devolver ruído, não a foto. */
  it("o que fica no banco é texto cifrado, não a imagem", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId, enrollmentId, escola } = await cenario(tx);
      await autorizar(tx, escola.id, enrollmentId);
      await photos.save({ studentId, dataUrl: JPEG });

      const [linha] = await tx
        .select()
        .from(studentPhoto)
        .where(eq(studentPhoto.studentId, studentId));

      expect(linha?.cipher).toBeTruthy();
      expect(linha?.cipher).not.toContain("bytes de uma foto");
      expect(Buffer.from(linha?.cipher ?? "", "base64").toString("utf8")).not.toContain("foto");
      expect(linha?.iv).toBeTruthy();
      expect(linha?.authTag).toBeTruthy();
    });
  });

  it("sem a chave, falha antes de escrever qualquer coisa", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId, enrollmentId, escola } = await cenario(tx, { withoutKey: true });
      await autorizar(tx, escola.id, enrollmentId);

      await expect(photos.save({ studentId, dataUrl: JPEG })).rejects.toThrow(
        /MEDIA_ENCRYPTION_KEY/,
      );

      const status = await photos.status(studentId);
      expect(status.photo).toBeNull();
    });
  });

  /** Revogação que deixa cópia não é revogação. */
  it("revogar apaga a foto e marca o consentimento", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId, enrollmentId, escola } = await cenario(tx);
      await autorizar(tx, escola.id, enrollmentId);
      await photos.save({ studentId, dataUrl: JPEG });

      const resultado = await photos.revoke({ studentId, reason: "pedido_do_responsavel" });
      expect(resultado.removed).toBe(true);

      const linhas = await tx
        .select()
        .from(studentPhoto)
        .where(eq(studentPhoto.studentId, studentId));
      expect(linhas).toHaveLength(0);

      const status = await photos.status(studentId);
      expect(status.photo).toBeNull();
      expect(status.authorized).toBe(false);
      // O registro de que houve consentimento permanece: é o que prova que a
      // escola agiu certo.
      expect(status.consent?.granted).toBe(true);
      expect(status.consent?.revokedAt).not.toBeNull();
    });
  });

  it("recapturar substitui em vez de acumular", async () => {
    await withRollback(async (tx) => {
      const { photos, studentId, enrollmentId, escola } = await cenario(tx);
      await autorizar(tx, escola.id, enrollmentId);

      await photos.save({ studentId, dataUrl: JPEG });
      const outra = `data:image/png;base64,${Buffer.from("outra foto").toString("base64")}`;
      await photos.save({ studentId, dataUrl: outra });

      const linhas = await tx
        .select()
        .from(studentPhoto)
        .where(eq(studentPhoto.studentId, studentId));
      expect(linhas).toHaveLength(1);
      expect((await photos.read(studentId)).dataUrl).toBe(outra);
    });
  });

  /** §13.3: documento sensível tem registro de leitura. */
  it("cada abertura da foto vira evento na trilha", async () => {
    await withRollback(async (tx) => {
      const { photos, enrollments, studentId, enrollmentId, escola } = await cenario(tx);
      await autorizar(tx, escola.id, enrollmentId);
      await photos.save({ studentId, dataUrl: JPEG });

      await photos.read(studentId);
      await photos.read(studentId);

      const events = await enrollments.listEvents(enrollmentId);
      expect(events.filter((evento) => evento.type === "foto_aberta")).toHaveLength(2);
      expect(events.some((evento) => evento.type === "foto_cadastrada")).toBe(true);
    });
  });

  it("a foto de uma escola não é visível pela outra", async () => {
    await withRollback(async (tx) => {
      const a = await cenario(tx);
      await autorizar(tx, a.escola.id, a.enrollmentId);
      await a.photos.save({ studentId: a.studentId, dataUrl: JPEG });

      const outra = await createTestSchool(tx, "Escola B");
      const operador = await createTestUser(tx);
      const daOutra = createPhotoService(
        createPhotoRepository(tx, { schoolId: outra.id }),
        createEnrollmentRepository(tx, { schoolId: outra.id }),
        {
          now: () => new Date(),
          encryptionKey: CHAVE,
          actor: { userId: operador.id },
          deleteFaceTemplate: (studentId) =>
            createGateRepository(tx, { schoolId: outra.id }).deleteTemplate(studentId),
        },
      );

      await expect(daOutra.status(a.studentId)).rejects.toThrow(/não encontrado/i);
    });
  });
});
