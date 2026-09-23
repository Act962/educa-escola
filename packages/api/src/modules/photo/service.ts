import { NotFoundError, ValidationError } from "../../errors";
import { decrypt, encrypt, parseDataUrl, parseKey, toDataUrl } from "../../media/crypto";
import type { EnrollmentRepository } from "../enrollment/repository";
import type { PhotoRepository } from "./repository";
import type { RevokePhotoInput, SavePhotoInput } from "./schema";

export interface PhotoServiceDeps {
  now: () => Date;
  /** Base64 da chave. Ausente = cadastro de foto recusado, nunca em claro. */
  encryptionKey: string | undefined;
  actor: { userId: string };
  /**
   * Apaga o molde facial junto com a foto.
   *
   * Obrigatório, e não opcional, porque meia revogação é pior que nenhuma: se
   * a imagem sumisse e o molde ficasse, a portaria continuaria reconhecendo a
   * criança cuja família pediu para parar. Exigir aqui faz o compilador
   * reclamar de quem montar o serviço sem ligar as duas coisas.
   */
  deleteFaceTemplate: (studentId: string) => Promise<void>;
}

/**
 * Foto do aluno para a identificação na catraca.
 *
 * Três regras sustentam esta tela, e nenhuma é detalhe:
 *
 * 1. **Sem consentimento de biometria, não grava.** Não é a mesma autorização
 *    de uso de imagem — autorizar foto no mural não é autorizar reconhecimento
 *    facial na entrada.
 * 2. **Cada leitura da foto vira evento.** A §13.3 pede registro de leitura em
 *    documento sensível, e foto de criança é isso.
 * 3. **Revogar apaga.** Some a foto **e o molde facial**; permanece o registro
 *    de que houve consentimento e de que ele foi revogado — é o que prova que
 *    a escola agiu certo. Apagar só a imagem deixaria a portaria reconhecendo
 *    quem pediu para não ser mais reconhecido.
 */
export function createPhotoService(
  photos: PhotoRepository,
  enrollments: EnrollmentRepository,
  deps: PhotoServiceDeps,
) {
  async function contexto(studentId: string) {
    const aluno = await photos.findStudent(studentId);
    if (!aluno) throw new NotFoundError("Aluno não encontrado");

    const matricula = await photos.currentEnrollment(studentId);
    const consent = matricula ? await photos.biometricConsent(matricula.id) : null;
    const responsavel = matricula
      ? ((await enrollments.listGuardians(matricula.id))[0] ?? null)
      : null;
    const autorizado = Boolean(consent?.granted && !consent.revokedAt);

    return { aluno, matricula, consent, autorizado, responsavel };
  }

  return {
    /** O que a tela precisa saber sem baixar a foto. */
    async status(studentId: string) {
      const { aluno, consent, autorizado, matricula, responsavel } = await contexto(studentId);
      const photo = await photos.findByStudent(studentId);

      return {
        studentId: aluno.id,
        studentName: aluno.name,
        registration: aluno.registration,
        /**
         * A matrícula corrente e o responsável, para a tela pedir ou registrar
         * a autorização sem uma segunda consulta.
         *
         * O nome do responsável vem daqui porque é ele que vai preencher o
         * campo "quem autorizou" no registro presencial: digitar à mão o nome
         * que o sistema já sabe é onde nascem os erros de grafia que depois
         * ninguém consegue conferir.
         */
        enrollmentId: matricula?.id ?? null,
        guardianName: responsavel?.name ?? null,
        authorized: autorizado,
        consent: consent
          ? {
              granted: consent.granted,
              termVersion: consent.termVersion,
              grantedAt: consent.grantedAt,
              revokedAt: consent.revokedAt,
              actorName: consent.actorName,
            }
          : null,
        photo: photo ? { capturedAt: photo.capturedAt, syncedAt: photo.syncedAt } : null,
      };
    },

    /**
     * Devolve a foto e registra a leitura.
     *
     * O registro acontece mesmo quando quem abre é a direção: "quem viu a foto
     * dessa criança?" precisa ter resposta.
     */
    async read(studentId: string) {
      const { matricula } = await contexto(studentId);
      const photo = await photos.findByStudent(studentId);
      if (!photo) throw new NotFoundError("Este aluno não tem foto cadastrada");

      const bytes = decrypt(photo, parseKey(deps.encryptionKey));

      if (matricula) {
        await enrollments.appendEvent({
          enrollmentId: matricula.id,
          type: "foto_aberta",
          actor: "gestao",
          actorUserId: deps.actor.userId,
        });
      }

      return { dataUrl: toDataUrl(bytes, photo.contentType), capturedAt: photo.capturedAt };
    },

    async save(input: SavePhotoInput) {
      const { matricula, autorizado } = await contexto(input.studentId);

      if (!autorizado) {
        throw new ValidationError(
          "Falta a autorização do responsável para a identificação facial.",
        );
      }

      // A chave é lida antes de qualquer escrita: sem ela, falha aqui e nada
      // chega ao banco. Gravar em claro "só desta vez" é como isso vaza.
      const key = parseKey(deps.encryptionKey);
      const { bytes, contentType } = parseDataUrl(input.dataUrl);
      const encrypted = encrypt(bytes, key);
      const now = deps.now();

      await photos.upsert({
        studentId: input.studentId,
        ...encrypted,
        contentType,
        capturedAt: now,
        capturedByUserId: deps.actor.userId,
      });

      if (matricula) {
        await enrollments.appendEvent({
          enrollmentId: matricula.id,
          type: "foto_cadastrada",
          actor: "gestao",
          actorUserId: deps.actor.userId,
        });
      }

      return { capturedAt: now };
    },

    /**
     * Apaga a foto e revoga o consentimento.
     *
     * Não é reversível, e é para ser assim: revogação que deixa cópia não é
     * revogação.
     */
    async revoke(input: RevokePhotoInput) {
      const { matricula, consent } = await contexto(input.studentId);
      const now = deps.now();

      const removida = await photos.remove(input.studentId);
      // A biometria some inteira ou não some: imagem e molde no mesmo gesto.
      await deps.deleteFaceTemplate(input.studentId);
      if (consent && !consent.revokedAt) await photos.revokeConsent(consent.id, now);

      if (matricula) {
        await enrollments.appendEvent({
          enrollmentId: matricula.id,
          type: "foto_revogada",
          actor: "gestao",
          actorUserId: deps.actor.userId,
          payload: { motivo: input.reason, tinhaFoto: Boolean(removida) },
        });
      }

      return { removed: Boolean(removida) };
    },
  };
}

export type PhotoService = ReturnType<typeof createPhotoService>;
