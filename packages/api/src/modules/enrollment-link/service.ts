import { createHash } from "node:crypto";

import { ExpiredError, NotFoundError, TooManyAttemptsError, ValidationError } from "../../errors";
import type { TenantContext } from "../../trpc/tenant";
import type { EnrollmentRepository } from "../enrollment/repository";
import { type ConsentPurpose, CURRENT_TERM_VERSION } from "../enrollment/schema";
import {
  birthDateMatches,
  hashToken,
  inviteVerdict,
  MAX_VERIFICATION_ATTEMPTS,
  protocolFor,
  verificationIsFresh,
} from "../enrollment/token";
import type { EnrollmentLinkRepository, InviteLookup } from "./repository";
import type { AutorizarBiometriaInput, SubmitLinkInput, VerifyLinkInput } from "./schema";

export interface EnrollmentLinkDeps {
  lookup: InviteLookup;
  repoFor: (tenant: TenantContext) => EnrollmentRepository;
  linkRepoFor: (tenant: TenantContext) => EnrollmentLinkRepository;
  now: () => Date;
}

/** Mensagem única para link que não serve mais, qualquer que seja o motivo. */
const EXPIRED_MESSAGE = "Este link não vale mais. Peça um novo à secretaria da escola.";

/**
 * Fluxo público da confirmação de matrícula.
 *
 * Quem chama não tem sessão e não tem papel: a autorização dele é a posse do
 * token, mais a conferência da data de nascimento. É a única exceção ao RBAC
 * no sistema, e por isso nada aqui escreve em `student` — confirmar continua
 * sendo ação da gestão.
 */
export function createEnrollmentLinkService(deps: EnrollmentLinkDeps) {
  /**
   * Resolve o token e devolve o escopo.
   *
   * Token desconhecido responde 404 uniforme, para não deixar enumerar. Token
   * conhecido porém inútil responde o motivo: quem chega aqui já possui aquele
   * token específico, e precisa saber que deve pedir outro.
   */
  async function resolve(token: string) {
    const found = await deps.lookup.byTokenHash(hashToken(token));
    if (!found) throw new NotFoundError("Link inválido");

    const now = deps.now();
    const verdict = inviteVerdict(found.invite, now);

    if (verdict === "bloqueado") {
      throw new TooManyAttemptsError(
        "Houve tentativas demais de abrir esta matrícula. Por segurança, o link foi desativado.",
      );
    }
    if (verdict !== "valido" && verdict !== "consumido") throw new ExpiredError(EXPIRED_MESSAGE);

    const tenant: TenantContext = { schoolId: found.invite.schoolId };
    return { ...found, verdict, tenant, now };
  }

  return {
    /**
     * Primeira tela: nada do aluno aparece ainda.
     *
     * Só o nome da escola e o pedido de conferência. Um link encaminhado por
     * engano não expõe ficha de criança.
     */
    async open(token: string) {
      const resolved = await resolve(token);

      if (resolved.verdict === "consumido") {
        return {
          schoolName: resolved.schoolName,
          academicYear: resolved.enrollment.academicYear,
          state: "consumido" as const,
          protocol: protocolFor(resolved.enrollment.id, resolved.enrollment.academicYear),
          submittedAt: resolved.invite.consumedAt,
        };
      }

      return {
        schoolName: resolved.schoolName,
        academicYear: resolved.enrollment.academicYear,
        state: "conferencia" as const,
        expiresAt: resolved.invite.expiresAt,
        /**
         * Para que serve este link.
         *
         * A tela pública precisa saber antes da conferência: o link curto
         * mostra uma pergunta só, e carregar o formulário inteiro para depois
         * escondê-lo assustaria quem só ia marcar uma caixa.
         */
        finalidade: resolved.invite.purpose,
      };
    },

    /**
     * A resposta ao link curto: a família autoriza a identificação facial?
     *
     * Separado de `submit` e recusando o convite de ficha de propósito. São
     * dois atos diferentes com a mesma prova de posse, e deixar um responder
     * pelo outro significaria que quem tem o link da ficha grava consentimento
     * sem ver os termos — ou que o link curto atualiza telefone e endereço
     * sem ninguém pedir.
     */
    async autorizarBiometria(
      input: AutorizarBiometriaInput,
      context: { ip?: string; userAgent?: string },
    ) {
      const resolved = await resolve(input.token);
      if (resolved.verdict === "consumido") throw new ExpiredError(EXPIRED_MESSAGE);

      if (resolved.invite.purpose !== "biometria") {
        throw new ValidationError("Este link não é o de autorização da identificação facial.");
      }

      if (!verificationIsFresh(resolved.invite.verifiedAt, resolved.now)) {
        throw new ValidationError(
          "Sua confirmação expirou. Informe a data de nascimento do aluno novamente.",
        );
      }

      const ipHash = context.ip ? createHash("sha256").update(context.ip).digest("hex") : null;
      const linkRepo = deps.linkRepoFor(resolved.tenant);
      const repo = deps.repoFor(resolved.tenant);

      await linkRepo.transaction(async (tx) => {
        const consumed = await tx.markConsumed(resolved.invite.id, resolved.now);
        if (!consumed) throw new ExpiredError(EXPIRED_MESSAGE);

        await tx.recordConsents([
          {
            enrollmentId: resolved.enrollment.id,
            purpose: "biometria",
            termVersion: CURRENT_TERM_VERSION,
            granted: input.autoriza,
            grantedAt: resolved.now,
            actorName: input.acceptedBy,
            inviteId: resolved.invite.id,
            ipHash,
            userAgent: context.userAgent ?? null,
          },
        ]);
      });

      /*
       * Recusar também vira evento. "A família nunca respondeu" e "a família
       * disse não" são coisas diferentes para quem vai conferir depois, e só
       * registrar o sim apagaria a segunda.
       */
      await repo.appendEvent({
        enrollmentId: resolved.enrollment.id,
        type: "consentimento_atualizado",
        actor: "responsavel",
        payload: {
          finalidade: "biometria",
          autorizou: input.autoriza,
          respondidoPor: input.acceptedBy,
        },
      });

      return { autorizou: input.autoriza, respondidoEm: resolved.now };
    },

    /** Conferência da data de nascimento. Erro não diz se o link existe. */
    async verify(input: VerifyLinkInput) {
      const resolved = await resolve(input.token);
      if (resolved.verdict === "consumido") throw new ExpiredError(EXPIRED_MESSAGE);

      const linkRepo = deps.linkRepoFor(resolved.tenant);
      const repo = deps.repoFor(resolved.tenant);

      if (!birthDateMatches(resolved.studentBirthDate, input.birthDate)) {
        const attempts = resolved.invite.attempts + 1;
        const lock = attempts >= MAX_VERIFICATION_ATTEMPTS;

        await linkRepo.registerFailedAttempt(resolved.invite.id, resolved.now, lock);
        // O contador entra no histórico; a data digitada, nunca.
        await repo.appendEvent({
          enrollmentId: resolved.enrollment.id,
          type: "conferencia_falha",
          actor: "responsavel",
          payload: { tentativa: attempts },
        });

        if (lock) {
          throw new TooManyAttemptsError(
            "Houve tentativas demais de abrir esta matrícula. Por segurança, o link foi desativado.",
          );
        }

        throw new ValidationError(
          `Os dados não conferem. ${MAX_VERIFICATION_ATTEMPTS - attempts} tentativas restantes.`,
        );
      }

      await linkRepo.markVerified(resolved.invite.id, resolved.now);
      await repo.appendEvent({
        enrollmentId: resolved.enrollment.id,
        type: "conferencia_ok",
        actor: "responsavel",
      });

      const guardians = await repo.listGuardians(resolved.enrollment.id);
      const guardian = guardians[0] ?? null;

      return {
        schoolName: resolved.schoolName,
        academicYear: resolved.enrollment.academicYear,
        termVersion: CURRENT_TERM_VERSION,
        student: { name: resolved.studentName, shift: resolved.enrollment.shift },
        guardian: guardian
          ? {
              name: guardian.name,
              relationship: guardian.relationship,
              phoneE164: guardian.phoneE164,
              email: guardian.email,
            }
          : null,
      };
    },

    /**
     * A família envia a ficha. **Não** confirma a matrícula.
     *
     * A submissão vira evento e consentimento, o convite é consumido, e a
     * matrícula segue pendente até a secretaria confirmar. Nenhum endpoint
     * anônimo coloca aluno em sala.
     */
    async submit(input: SubmitLinkInput, context: { ip?: string; userAgent?: string }) {
      const resolved = await resolve(input.token);
      if (resolved.verdict === "consumido") throw new ExpiredError(EXPIRED_MESSAGE);

      if (!verificationIsFresh(resolved.invite.verifiedAt, resolved.now)) {
        throw new ValidationError(
          "Sua confirmação expirou. Informe a data de nascimento do aluno novamente.",
        );
      }

      const repo = deps.repoFor(resolved.tenant);
      const linkRepo = deps.linkRepoFor(resolved.tenant);

      const guardians = await repo.listGuardians(resolved.enrollment.id);
      const guardian = guardians[0] ?? null;

      const changes: Record<string, { de: string | null; para: string }> = {};
      if (input.student.name !== resolved.studentName) {
        changes.studentName = { de: resolved.studentName, para: input.student.name };
      }
      if (guardian) {
        if (guardian.name !== input.guardian.name) {
          changes.guardianName = { de: guardian.name, para: input.guardian.name };
        }
        if (guardian.phoneE164 !== input.guardian.phoneE164) {
          changes.responsavelCelular = { de: guardian.phoneE164, para: input.guardian.phoneE164 };
        }
        if ((guardian.email ?? null) !== (input.guardian.email ?? null)) {
          changes.responsavelEmail = {
            de: guardian.email ?? null,
            para: input.guardian.email ?? "",
          };
        }
      }

      // Endereço de rede não é guardado: o hash prova "mesmo aparelho" sem
      // reter identificador de rede, que é o que a §24.4 pede.
      const ipHash = context.ip ? createHash("sha256").update(context.ip).digest("hex") : null;

      await linkRepo.transaction(async (tx) => {
        const consumed = await tx.markConsumed(resolved.invite.id, resolved.now);
        if (!consumed) throw new ExpiredError(EXPIRED_MESSAGE);

        await tx.recordConsents(
          (Object.keys(input.consents) as ConsentPurpose[]).map((purpose) => ({
            enrollmentId: resolved.enrollment.id,
            purpose,
            termVersion: CURRENT_TERM_VERSION,
            granted: input.consents[purpose] === true,
            grantedAt: resolved.now,
            actorName: input.acceptedBy,
            ipHash,
            userAgent: context.userAgent ?? null,
          })),
        );
      });

      if (guardian) {
        await repo.updateGuardian(guardian.id, {
          name: input.guardian.name,
          relationship: input.guardian.relationship,
          phoneE164: input.guardian.phoneE164,
          email: input.guardian.email ?? null,
        });
      }

      await repo.appendEvent({
        enrollmentId: resolved.enrollment.id,
        type: "ficha_enviada",
        actor: "responsavel",
        payload: { alteracoes: changes, aceitoPor: input.acceptedBy },
      });

      return {
        protocol: protocolFor(resolved.enrollment.id, resolved.enrollment.academicYear),
        submittedAt: resolved.now,
        studentName: input.student.name,
      };
    },
  };
}

export type EnrollmentLinkService = ReturnType<typeof createEnrollmentLinkService>;
