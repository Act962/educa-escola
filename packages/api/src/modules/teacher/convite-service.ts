import type { DbHandle } from "@educa-escola/db/types";

import { ExpiredError, NotFoundError, ValidationError } from "../../errors";
import type { TenantContext } from "../../trpc/tenant";
import { hashToken } from "./convite";
import type { TeacherInviteLookup, TeacherRepository } from "./repository";

/**
 * Mensagem única para token que não existe.
 *
 * Igual à do convite de matrícula, e pela mesma razão: distinguir "não existe"
 * de "venceu" deixaria enumerar tokens. Quem tem um link legítimo e vencido
 * precisa ler "peça um novo"; quem está adivinhando não pode aprender nada.
 */
const NAO_ENCONTRADO = "Este convite não existe ou já foi usado.";

export interface DepsDoConvite {
  now: () => Date;
  lookup: TeacherInviteLookup;
  repoFor: (tenant: TenantContext) => TeacherRepository;
  criarConta: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ userId: string }>;
}

/**
 * O lado público do convite de professor.
 *
 * Duas procedures anônimas: abrir e aceitar. A autorização é a posse do token
 * — não há conta ainda, e é exatamente isso que o fluxo resolve.
 */
export function createTeacherInviteService(deps: DepsDoConvite) {
  async function resolver(token: string) {
    const convite = await deps.lookup.byTokenHash(hashToken(token));
    if (!convite) throw new NotFoundError(NAO_ENCONTRADO);

    const agora = deps.now();
    // Consumido, revogado e vencido respondem a mesma coisa: o portador tem
    // este link e precisa saber que ele não vale mais, sem saber por quê.
    if (convite.consumedAt || convite.revokedAt || convite.expiresAt <= agora) {
      throw new ExpiredError("Este convite não vale mais. Peça um novo à secretaria.");
    }

    return { convite, agora };
  }

  return {
    /** O que a tela pública mostra antes de pedir a senha. */
    async abrir(token: string) {
      const { convite } = await resolver(token);
      return {
        nome: convite.name,
        email: convite.email,
        escola: await deps.lookup.schoolName(convite.schoolId),
        expiraEm: convite.expiresAt,
      };
    },

    /**
     * Cria a conta e o vínculo, no mesmo gesto.
     *
     * A conta nasce primeiro porque é ela que pode falhar por fora — e-mail já
     * usado noutra escola, senha recusada. Se a criação passa e o vínculo não,
     * o convite continua aberto: o professor tenta de novo e o `onConflict` do
     * `teacher_subject` e o `consumedAt is null` do convite impedem duplicata.
     */
    async aceitar(input: { token: string; password: string }) {
      const { convite, agora } = await resolver(input.token);
      const tenant: TenantContext = { schoolId: convite.schoolId };
      const repo = deps.repoFor(tenant);

      const jaEstá = await repo.memberByEmail(convite.email);
      if (jaEstá) {
        throw new ValidationError("Este e-mail já tem acesso a esta escola. Tente entrar.");
      }

      const conta = await deps.criarConta({
        name: convite.name,
        email: convite.email,
        password: input.password,
      });

      const aceito = await repo.aceitarConvite({
        inviteId: convite.id,
        userId: conta.userId,
        subjectIds: convite.subjectIds,
        quando: agora,
      });

      // Corrida: alguém aceitou entre o `resolver` e aqui.
      if (!aceito) throw new ExpiredError("Este convite acabou de ser usado.");

      return { email: convite.email };
    },
  };
}

export type TeacherInviteService = ReturnType<typeof createTeacherInviteService>;
export type { DbHandle };
