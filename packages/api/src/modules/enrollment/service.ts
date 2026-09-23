import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { EnrollmentMessenger } from "../../messaging/messenger";
import { classCodeOf } from "./codes";
import type {
  EnrollmentRepository,
  EnrollmentRow,
  InviteRow,
  ListEnrollmentsFilters,
} from "./repository";
import type {
  CancelEnrollmentInput,
  ConfirmEnrollmentInput,
  CreateEnrollmentInput,
  RenewEnrollmentInput,
  UpdateEnrollmentInput,
} from "./schema";
import { CURRENT_TERM_VERSION } from "./schema";
import { enrollmentLinkFor, expiryFrom, generateToken, hashToken, inviteVerdict } from "./token";

/**
 * Situação do link na fila da gestão.
 *
 * Derivada do convite, nunca digitada. É a coluna que a secretaria lê para
 * saber de quem está esperando o quê.
 */
export type LinkStatus =
  | "nao_enviado"
  | "aguardando"
  | "ficha_entregue"
  | "vencido"
  | "bloqueado"
  | "revogado";

export interface EnrollmentServiceDeps {
  now: () => Date;
  messenger: EnrollmentMessenger;
  linkBaseUrl: string;
  schoolName: string;
  actor: { userId: string };
}

function linkStatusOf(invite: InviteRow | null, now: Date, delivered: boolean): LinkStatus {
  if (!invite) return "nao_enviado";

  const verdict = inviteVerdict(invite, now);
  if (verdict === "consumido") return "ficha_entregue";
  if (verdict === "bloqueado") return "bloqueado";
  if (verdict === "revogado") return "revogado";
  if (verdict === "vencido") return "vencido";
  return delivered ? "aguardando" : "nao_enviado";
}

/**
 * Regra de negócio da matrícula. Não conhece HTTP nem Drizzle.
 *
 * Recebe o repositório e as dependências de borda (relógio, mensageiro, base
 * do link) por parâmetro: assim os testes rodam sem banco, sem rede e sem
 * depender da hora do relógio da máquina.
 */
export function createEnrollmentService(repo: EnrollmentRepository, deps: EnrollmentServiceDeps) {
  async function getOrThrow(id: string): Promise<EnrollmentRow> {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError("Matrícula não encontrada");
    return found;
  }

  /** Emite convite novo e tenta entregar. Revoga o anterior, se houver. */
  async function issueInvite(row: EnrollmentRow, expiryDays: number, studentName: string) {
    const now = deps.now();
    await repo.revokeInvitesOf(row.id, now);

    const guardians = await repo.listGuardians(row.id);
    const guardian = guardians[0];
    if (!guardian) {
      throw new ValidationError("A matrícula precisa de um responsável antes de emitir o link");
    }

    const token = generateToken();
    const expiresAt = expiryFrom(now, expiryDays);

    const invite = await repo.createInvite({
      enrollmentId: row.id,
      tokenHash: hashToken(token),
      expiresAt,
      recipientPhone: guardian.phoneE164,
      createdByUserId: deps.actor.userId,
    });

    await repo.update(row.id, { expiresAt, updatedByUserId: deps.actor.userId });
    await repo.appendEvent({
      enrollmentId: row.id,
      type: "link_gerado",
      actor: "gestao",
      actorUserId: deps.actor.userId,
      payload: { expiraEm: expiresAt.toISOString() },
    });

    const url = enrollmentLinkFor(deps.linkBaseUrl, token);
    const envio = await deps.messenger.sendEnrollmentLink({
      to: guardian.phoneE164,
      studentName,
      schoolName: deps.schoolName,
      url,
      expiresAt,
    });

    if (envio.delivered) {
      await repo.appendEvent({
        enrollmentId: row.id,
        type: "link_enviado",
        actor: "sistema",
        payload: { para: guardian.phoneE164 },
      });
    }

    // O endereço só existe aqui e na resposta desta chamada. Nunca é
    // guardado nem devolvido de novo: quem precisar de outro, reemite.
    return { invite, url, envio };
  }

  /**
   * Próximo número de matrícula do ano, em sequência.
   *
   * `2026-0042` e não um carimbo de relógio: matrícula é identificador que a
   * família lê em voz alta ao telefone e que aparece impresso em declaração.
   * Zero-preenchido em largura fixa para que ordem alfabética e numérica
   * coincidam no banco.
   */
  async function nextRegistration(academicYear: number): Promise<string> {
    const prefix = `${academicYear}-`;
    const ultima = await repo.lastRegistrationOfYear(prefix);
    const sequencial = ultima ? Number.parseInt(ultima.slice(prefix.length), 10) : 0;
    const proximo = Number.isNaN(sequencial) ? 1 : sequencial + 1;
    return `${prefix}${String(proximo).padStart(4, "0")}`;
  }

  return {
    nextRegistration,

    async list(filters: ListEnrollmentsFilters & { academicYear?: number }) {
      // RN-043 sem agendador: quem abre a fila paga a varredura, que é barata
      // e mantém o prazo honesto sem introduzir um job no projeto.
      const expired = await repo.expireOverdue(deps.now());
      for (const row of expired) {
        await repo.appendEvent({ enrollmentId: row.id, type: "expirada", actor: "sistema" });
      }

      const [items, total] = await Promise.all([repo.list(filters), repo.countMatching(filters)]);

      const ids = items.map((item) => item.id);
      const [guardians, invites, delivered] = await Promise.all([
        repo.listGuardiansFor(ids),
        repo.latestInvitesFor(ids),
        repo.enrollmentIdsWithEvent(ids, "link_enviado"),
      ]);

      const now = deps.now();
      const deliveredSet = new Set(delivered);
      const guardianOf = new Map<string, (typeof guardians)[number]>();
      for (const guardian of guardians) {
        if (!guardianOf.has(guardian.enrollmentId)) guardianOf.set(guardian.enrollmentId, guardian);
      }
      const inviteOf = new Map<string, InviteRow>();
      for (const invite of invites) {
        if (!inviteOf.has(invite.enrollmentId)) inviteOf.set(invite.enrollmentId, invite);
      }

      return {
        items: items.map((item) => {
          const guardian = guardianOf.get(item.id) ?? null;
          const turma = classCodeOf(item.classroomName, item.shift);
          return {
            ...item,
            classCode: turma.code,
            classLabel: turma.label,
            guardianName: guardian?.name ?? null,
            guardianRelationship: guardian?.relationship ?? null,
            guardianPhone: guardian?.phoneE164 ?? null,
            linkStatus: linkStatusOf(inviteOf.get(item.id) ?? null, now, deliveredSet.has(item.id)),
          };
        }),
        total,
      };
    },

    async counts(academicYear: number) {
      const rows = await repo.countsByStatus(academicYear);
      return Object.fromEntries(rows.map((row) => [row.status, row.total]));
    },

    async get(id: string) {
      const detail = await repo.findDetail(id);
      if (!detail) throw new NotFoundError("Matrícula não encontrada");

      const [guardians, consents, events, invite] = await Promise.all([
        repo.listGuardians(id),
        repo.listConsents(id),
        repo.listEvents(id),
        repo.latestInvite(id),
      ]);

      const delivered = await repo.enrollmentIdsWithEvent([id], "link_enviado");

      const turma = classCodeOf(detail.classroomName, detail.enrollment.shift);

      return {
        ...detail,
        classCode: turma.code,
        classLabel: turma.label,
        guardians,
        consents,
        events,
        invite: invite
          ? {
              expiresAt: invite.expiresAt,
              createdAt: invite.createdAt,
              verifiedAt: invite.verifiedAt,
              consumedAt: invite.consumedAt,
              attempts: invite.attempts,
              status: linkStatusOf(invite, deps.now(), delivered.length > 0),
            }
          : null,
      };
    },

    /**
     * Cria a matrícula e já emite o link.
     *
     * O aluno pode ser um cadastro existente ou nascer aqui. A data de
     * nascimento é obrigatória porque é ela que o responsável vai digitar para
     * abrir o link — sem ela, a matrícula existiria sem porta de entrada.
     */
    async create(input: CreateEnrollmentInput) {
      const now = deps.now();

      let studentRow = input.student.id ? await repo.findStudentById(input.student.id) : null;
      if (input.student.id && !studentRow) throw new NotFoundError("Aluno não encontrado");

      if (!studentRow) {
        // Informada à mão, respeita; senão, sai em sequência. O número só é
        // resolvido aqui, no servidor: a tela mostra uma prévia, e duas
        // secretarias criando ao mesmo tempo não podem receber o mesmo.
        const registration =
          input.student.registration ?? (await nextRegistration(input.academicYear));

        const duplicate = await repo.findStudentByRegistration(registration);
        if (duplicate) throw new ConflictError(`Já existe aluno com a matrícula ${registration}`);

        studentRow = await repo.createStudent({
          name: input.student.name,
          registration,
          birthDate: input.student.birthDate,
          shift: input.student.shift,
          guardianName: input.guardian.name,
          // Sem turma e sem status de sala: quem coloca o aluno na chamada é a
          // confirmação da matrícula, não a criação dela.
          status: "documentacao_pendente",
        });
      } else if (!studentRow.birthDate) {
        await repo.projectOntoStudent(studentRow.id, { birthDate: input.student.birthDate });
      }

      if (input.classroomId)
        await assertClassroomMatchesYear(input.classroomId, input.academicYear);

      const active = await repo.findActiveFor(studentRow.id, input.academicYear);
      if (active) {
        throw new ConflictError(
          `${studentRow.name} já tem matrícula ativa em ${input.academicYear}`,
        );
      }

      const created = await repo.create({
        studentId: studentRow.id,
        academicYear: input.academicYear,
        classroomId: input.classroomId,
        shift: input.student.shift,
        status: "pendente",
        kind: "matricula",
        expiresAt: expiryFrom(now, input.expiryDays),
        createdByUserId: deps.actor.userId,
        updatedByUserId: deps.actor.userId,
      });

      await repo.addGuardian({ enrollmentId: created.id, ...input.guardian });
      await repo.appendEvent({
        enrollmentId: created.id,
        type: "criada",
        actor: "gestao",
        actorUserId: deps.actor.userId,
      });

      const { url, envio } = await issueInvite(created, input.expiryDays, studentRow.name);
      return { id: created.id, url, envio };
    },

    /**
     * Emite o link curto que pede **só** a autorização da identificação facial.
     *
     * Existe porque o consentimento de biometria só era capturado dentro da
     * ficha, e a ficha só vive enquanto a matrícula está pendente: depois de
     * confirmada não havia caminho nenhum para autorizar — e família decide
     * depois o tempo todo, ou a foto é tirada noutro dia.
     *
     * Vale em matrícula confirmada de propósito, que é justamente o caso que
     * não tinha saída. Só não vale em cancelada: pedir biometria de quem saiu
     * da escola não tem sentido.
     *
     * Não mexe em `expiresAt` da matrícula nem revoga o link da ficha — são
     * dois pedidos independentes, e a família pode estar com os dois na mão.
     */
    async emitirAutorizacaoBiometria(id: string, expiryDays = 7) {
      const row = await getOrThrow(id);
      if (row.status === "cancelada") {
        throw new ValidationError("Matrícula cancelada não pede autorização de biometria.");
      }

      const guardians = await repo.listGuardians(id);
      const guardian = guardians[0];
      if (!guardian) {
        throw new ValidationError(
          "A matrícula precisa de um responsável antes de pedir a autorização",
        );
      }

      const now = deps.now();
      await repo.revokeInvitesOf(id, now, "biometria");

      const token = generateToken();
      const invite = await repo.createInvite({
        enrollmentId: id,
        tokenHash: hashToken(token),
        purpose: "biometria",
        expiresAt: expiryFrom(now, expiryDays),
        recipientPhone: guardian.phoneE164,
        createdByUserId: deps.actor.userId,
      });

      await repo.appendEvent({
        enrollmentId: id,
        type: "autorizacao_solicitada",
        actor: "gestao",
        actorUserId: deps.actor.userId,
        payload: { inviteId: invite.id, finalidade: "biometria" },
      });

      const expiresAt = expiryFrom(now, expiryDays);
      const url = enrollmentLinkFor(deps.linkBaseUrl, token);
      const envio = await deps.messenger.sendEnrollmentLink({
        to: guardian.phoneE164,
        studentName: (await repo.findDetail(id))?.studentName ?? "",
        schoolName: deps.schoolName,
        url,
        expiresAt,
      });

      return { url, envio };
    },

    /**
     * Registra a autorização declarada presencialmente pelo responsável.
     *
     * É o caminho da secretaria, pedido explicitamente: nem toda família abre
     * link, e nem toda tem aparelho. Ele **não** finge que a família usou o
     * link — a linha nasce com `origin: "presencial"`, com o nome de quem
     * declarou e o id de quem na escola registrou. Sem essas duas coisas,
     * "a escola marcou sozinha" e "a mãe declarou no balcão" ficam idênticos
     * no banco, e uma conferência não consegue separar os dois.
     *
     * A responsabilidade muda de lugar, e isso é deliberado: aqui quem
     * responde pelo registro é a escola, não a posse de um token. O caminho
     * do link continua existindo e continua sendo o preferível — este é para
     * quando ele não serve.
     */
    async registrarAutorizacaoPresencial(input: {
      id: string;
      purpose: "biometria";
      granted: boolean;
      declaredBy: string;
    }) {
      const row = await getOrThrow(input.id);
      if (row.status === "cancelada") {
        throw new ValidationError("Matrícula cancelada não registra autorização.");
      }

      const declarante = input.declaredBy.trim();
      if (!declarante) {
        throw new ValidationError("Informe o nome de quem autorizou.");
      }

      const now = deps.now();
      await repo.recordConsent({
        enrollmentId: input.id,
        purpose: input.purpose,
        termVersion: CURRENT_TERM_VERSION,
        granted: input.granted,
        grantedAt: now,
        actorName: declarante,
        origin: "presencial",
        registeredByUserId: deps.actor.userId,
      });

      await repo.appendEvent({
        enrollmentId: input.id,
        type: "consentimento_atualizado",
        actor: "gestao",
        actorUserId: deps.actor.userId,
        payload: {
          finalidade: input.purpose,
          autorizou: input.granted,
          declaradoPor: declarante,
          origem: "presencial",
        },
      });

      return { autorizou: input.granted, registradoEm: now };
    },

    async resendLink(id: string, expiryDays = 7) {
      const row = await getOrThrow(id);
      if (row.status !== "pendente") {
        throw new ValidationError("Só matrícula pendente tem link de confirmação");
      }

      const detail = await repo.findDetail(id);
      const { url, envio } = await issueInvite(row, expiryDays, detail?.studentName ?? "");
      return { url, envio };
    },

    /**
     * Edita a matrícula e registra o que mudou.
     *
     * A trilha guarda campo, valor anterior e valor novo — é o que responde
     * "quem mudou o telefone dessa mãe, e quando?" seis meses depois. Editar
     * sem diferença nenhuma não gera evento: ruído na linha do tempo custa
     * mais caro que a informação que ele traz.
     */
    async edit(input: UpdateEnrollmentInput) {
      const row = await getOrThrow(input.id);
      const detail = await repo.findDetail(input.id);
      if (!detail) throw new NotFoundError("Matrícula não encontrada");

      if (input.classroomId) {
        await assertClassroomMatchesYear(input.classroomId, row.academicYear);
      }

      const guardians = await repo.listGuardians(row.id);
      const guardian = input.guardian
        ? guardians.find((item) => item.id === input.guardian?.id)
        : undefined;
      if (input.guardian && !guardian) throw new NotFoundError("Responsável não encontrado");

      const mudancas: Record<string, { de: string | null; para: string | null }> = {};
      const anotar = (field: string, de: string | null, para: string | null | undefined) => {
        if (para === undefined || para === de) return;
        mudancas[field] = { de, para: para ?? null };
      };

      anotar("alunoNome", detail.studentName, input.student?.name);
      anotar("nascimento", detail.birthDate, input.student?.birthDate);
      anotar("turno", row.shift, input.shift);
      if (guardian && input.guardian) {
        anotar("responsavelNome", guardian.name, input.guardian.name);
        anotar("parentesco", guardian.relationship, input.guardian.relationship);
        anotar("celular", guardian.phoneE164, input.guardian.phoneE164);
        anotar("email", guardian.email, input.guardian.email);
      }

      // A turma entra pelo nome, não pelo id: a trilha é lida por gente.
      if (input.classroomId && input.classroomId !== row.classroomId) {
        const nova = await repo.findClassroomById(input.classroomId);
        mudancas.turma = { de: detail.classroomName, para: nova?.name ?? null };
      }

      if (Object.keys(mudancas).length === 0) return repo.findDetail(input.id);

      const now = deps.now();

      await repo.transaction(async (tx) => {
        await tx.update(row.id, {
          classroomId: input.classroomId ?? row.classroomId,
          shift: input.shift ?? row.shift,
          updatedByUserId: deps.actor.userId,
        });

        if (input.student?.name || input.student?.birthDate || input.shift) {
          await tx.projectOntoStudent(row.studentId, {
            ...(input.student?.name ? { name: input.student.name } : {}),
            ...(input.student?.birthDate ? { birthDate: input.student.birthDate } : {}),
            ...(input.shift ? { shift: input.shift } : {}),
          });
        }

        // Só matrícula ativa projeta a turma no aluno: pendente ainda não
        // colocou ninguém em sala, e escrever ali a faria aparecer na chamada.
        if (row.status === "ativa" && input.classroomId && input.classroomId !== row.classroomId) {
          await tx.projectOntoStudent(row.studentId, { classroomId: input.classroomId });
        }

        if (guardian && input.guardian) {
          await tx.updateGuardian(guardian.id, {
            ...(input.guardian.name ? { name: input.guardian.name } : {}),
            ...(input.guardian.relationship ? { relationship: input.guardian.relationship } : {}),
            ...(input.guardian.phoneE164 ? { phoneE164: input.guardian.phoneE164 } : {}),
            ...(input.guardian.email !== undefined ? { email: input.guardian.email ?? null } : {}),
          });

          if (input.guardian.name && guardian.isLegal && row.status === "ativa") {
            await tx.projectOntoStudent(row.studentId, { guardianName: input.guardian.name });
          }
        }

        await tx.appendEvent({
          enrollmentId: row.id,
          type: "editada",
          actor: "gestao",
          actorUserId: deps.actor.userId,
          payload: { alteracoes: mudancas, em: now.toISOString() },
        });
      });

      return repo.findDetail(input.id);
    },

    /**
     * Confirma: a matrícula vira ativa e o aluno entra na turma.
     *
     * As duas escritas vão na mesma transação. Sem isso existiria o estado em
     * que a matrícula consta ativa e o aluno não aparece na chamada — e é
     * exatamente esse buraco que o invariante do teste proíbe.
     */
    async confirm(input: ConfirmEnrollmentInput) {
      const row = await getOrThrow(input.id);
      if (row.status === "ativa") return row;
      if (row.status !== "pendente") {
        throw new ValidationError("Só matrícula pendente pode ser confirmada");
      }

      const classroomId = input.classroomId ?? row.classroomId;
      if (!classroomId) throw new ValidationError("Escolha a turma antes de confirmar");
      await assertClassroomMatchesYear(classroomId, row.academicYear);

      const active = await repo.findActiveFor(row.studentId, row.academicYear);
      if (active && active.id !== row.id) {
        throw new ConflictError(`O aluno já tem matrícula ativa em ${row.academicYear}`);
      }

      const guardians = await repo.listGuardians(row.id);
      const legal = guardians.find((guardian) => guardian.isLegal) ?? guardians[0];
      if (!legal) throw new ValidationError("A matrícula precisa de um responsável legal");

      const now = deps.now();

      return repo.transaction(async (tx) => {
        const updated = await tx.update(row.id, {
          status: "ativa",
          classroomId,
          confirmedAt: now,
          updatedByUserId: deps.actor.userId,
        });
        if (!updated) throw new NotFoundError("Matrícula não encontrada");

        await tx.projectOntoStudent(row.studentId, {
          classroomId,
          status: "ativo",
          shift: row.shift as "manha" | "tarde" | "noite",
          guardianName: legal.name,
        });

        await tx.appendEvent({
          enrollmentId: row.id,
          type: "confirmada",
          actor: "gestao",
          actorUserId: deps.actor.userId,
        });

        return updated;
      });
    },

    /**
     * Cancela com motivo e data de efeito (RN-044).
     *
     * `classroomId` do aluno é preservado de propósito: a chamada já filtra por
     * status, então ele some da sala sozinho, e os lançamentos anteriores
     * continuam casando com a turma.
     */
    async cancel(input: CancelEnrollmentInput) {
      const row = await getOrThrow(input.id);
      if (row.status === "cancelada") return row;
      if (row.status === "concluida" || row.status === "transferida") {
        throw new ValidationError("Matrícula encerrada não pode ser cancelada");
      }

      return repo.transaction(async (tx) => {
        const updated = await tx.update(row.id, {
          status: "cancelada",
          cancelReason: input.reason,
          cancelledOn: input.effectiveOn,
          effectiveOn: input.effectiveOn,
          updatedByUserId: deps.actor.userId,
        });
        if (!updated) throw new NotFoundError("Matrícula não encontrada");

        if (row.status === "ativa") {
          await tx.projectOntoStudent(row.studentId, { status: "inativo" });
        }

        await tx.appendEvent({
          enrollmentId: row.id,
          type: "cancelada",
          actor: "gestao",
          actorUserId: deps.actor.userId,
          payload: { motivo: input.reason, observacao: input.note ?? null },
        });

        return updated;
      });
    },

    /**
     * Renova para o ano seguinte, herdando a ficha.
     *
     * A turma não é sugerida pelo resultado do ano: o fechamento de período não
     * existe e a turma não guarda série, então a progressão automática da
     * RN-048 fica de fora. A escolha é da secretaria, e o vínculo com a
     * matrícula de origem fica registrado.
     */
    async renew(input: RenewEnrollmentInput) {
      const row = await getOrThrow(input.id);
      if (input.academicYear <= row.academicYear) {
        throw new ValidationError("A renovação precisa ser para um ano letivo posterior");
      }

      const active = await repo.findActiveFor(row.studentId, input.academicYear);
      if (active) throw new ConflictError(`O aluno já tem matrícula em ${input.academicYear}`);

      if (input.classroomId)
        await assertClassroomMatchesYear(input.classroomId, input.academicYear);

      const detail = await repo.findDetail(row.id);
      const guardians = await repo.listGuardians(row.id);
      const now = deps.now();

      const created = await repo.create({
        studentId: row.studentId,
        academicYear: input.academicYear,
        classroomId: input.classroomId ?? null,
        shift: row.shift,
        status: "pendente",
        kind: "rematricula",
        previousEnrollmentId: row.id,
        expiresAt: expiryFrom(now, input.expiryDays),
        createdByUserId: deps.actor.userId,
        updatedByUserId: deps.actor.userId,
      });

      for (const guardian of guardians) {
        await repo.addGuardian({
          enrollmentId: created.id,
          name: guardian.name,
          relationship: guardian.relationship,
          phoneE164: guardian.phoneE164,
          email: guardian.email,
          isLegal: guardian.isLegal,
        });
      }

      await repo.appendEvent({
        enrollmentId: created.id,
        type: "criada",
        actor: "gestao",
        actorUserId: deps.actor.userId,
        payload: { renovadaDe: row.id },
      });
      await repo.appendEvent({
        enrollmentId: row.id,
        type: "renovada",
        actor: "gestao",
        actorUserId: deps.actor.userId,
        payload: { novaMatricula: created.id, anoLetivo: input.academicYear },
      });

      const { url, envio } = await issueInvite(
        created,
        input.expiryDays,
        detail?.studentName ?? "",
      );
      return { id: created.id, url, envio };
    },
  };

  /**
   * RN-041, na medida do que a turma sabe hoje.
   *
   * Só o ano letivo é verificável: `classroom` não guarda série, unidade nem
   * vaga, então série (RN-041), unidade e turma cheia (RN-042) ficam sem
   * validação até a turma ser aprofundada.
   */
  async function assertClassroomMatchesYear(classroomId: string, academicYear: number) {
    const found = await repo.findClassroomById(classroomId);
    if (!found) throw new NotFoundError("Turma não encontrada");
    if (found.academicYear !== academicYear) {
      throw new ValidationError(
        `A turma ${found.name} é de ${found.academicYear}, não de ${academicYear}`,
      );
    }
    return found;
  }
}

export type EnrollmentService = ReturnType<typeof createEnrollmentService>;
