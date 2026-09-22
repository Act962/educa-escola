import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { CommunicationRepository } from "./repository";
import type { Audience, PublishInput, SaveDraftInput } from "./schema";

/**
 * A partir de quantos destinatários o envio exige confirmação explícita.
 *
 * §8.3, regra 5. O número não é mágico: é o ponto em que o comunicado deixa
 * de ser "aviso para a turma" e vira "mensagem para a escola inteira", onde um
 * erro de destinatário não se conserta pedindo desculpa a três pessoas.
 */
export const PUBLICO_QUE_EXIGE_CONFIRMACAO = 50;

/** Papéis e o que cada um recebe. O responsável ainda não tem conta (§2.5). */
export function audiencesDoPapel(role: string): Audience[] {
  if (role === "teacher") return ["toda_a_escola", "professores"];
  if (role === "student") return ["toda_a_escola", "alunos"];
  return ["toda_a_escola", "professores", "alunos"];
}

export interface ComunicadoNaLista {
  id: string;
  title: string;
  status: string;
  priority: string;
  audience: string;
  requiresAck: boolean;
  publishedAt: Date | null;
  publico: number | null;
  leram: number;
  confirmaram: number;
  /** Taxa de leitura de 0 a 1. `null` em rascunho — ninguém podia ler. */
  taxaDeLeitura: number | null;
}

export function createCommunicationService(repo: CommunicationRepository) {
  return {
    /** O painel da gestão: rascunhos, publicados e quem leu. */
    async list(academicYear: number): Promise<ComunicadoNaLista[]> {
      const comunicados = await repo.list(academicYear);
      const publicados = comunicados.filter((c) => c.status !== "rascunho");
      const recibos = await repo.receiptCounts(publicados.map((c) => c.id));
      const porId = new Map(recibos.map((r) => [r.communicationId, r]));

      return Promise.all(
        comunicados.map(async (comunicado) => {
          const recibo = porId.get(comunicado.id);
          const leram = recibo?.leram ?? 0;

          // Rascunho não tem público calculado: ninguém podia ler, e uma taxa
          // de 0% ali faria parecer que o comunicado fracassou.
          const publico =
            comunicado.status === "rascunho"
              ? null
              : await repo.audienceSize(comunicado.audience, comunicado.classroomId);

          return {
            id: comunicado.id,
            title: comunicado.title,
            status: comunicado.status,
            priority: comunicado.priority,
            audience: comunicado.audience,
            requiresAck: comunicado.requiresAck,
            publishedAt: comunicado.publishedAt,
            publico,
            leram,
            confirmaram: recibo?.confirmaram ?? 0,
            taxaDeLeitura: publico && publico > 0 ? leram / publico : null,
          };
        }),
      );
    },

    /** Quantas pessoas isto alcança — mostrado antes de publicar (§8.2). */
    previewAudience: (audience: Audience, classroomId: string | null) =>
      repo.audienceSize(audience, classroomId),

    createDraft: (input: SaveDraftInput, userId: string) =>
      repo.createDraft({ ...input, createdByUserId: userId }),

    /**
     * Publica o comunicado.
     *
     * Exige confirmação explícita quando o público é grande (§8.3). E a
     * confirmação é **do número que a pessoa viu**: se o público mudou entre o
     * aviso e o clique — uma turma nova, trinta matrículas —, a publicação é
     * recusada em vez de alcançar mais gente do que foi aprovado.
     */
    async publish(input: PublishInput, now: Date) {
      const comunicado = await repo.findById(input.id);
      if (!comunicado) throw new NotFoundError("Comunicado não encontrado");
      if (comunicado.status !== "rascunho") {
        throw new ConflictError("Este comunicado já foi publicado.");
      }

      const publico = await repo.audienceSize(comunicado.audience, comunicado.classroomId);

      if (publico >= PUBLICO_QUE_EXIGE_CONFIRMACAO) {
        if (input.publicoConfirmado === undefined) {
          throw new ValidationError(
            `Este comunicado vai para ${publico} pessoas. Confirme o envio antes de publicar.`,
          );
        }
        if (input.publicoConfirmado !== publico) {
          throw new ConflictError(
            `O público mudou de ${input.publicoConfirmado} para ${publico} pessoas desde a confirmação. Confira e confirme de novo.`,
          );
        }
      }

      const publicado = await repo.publish(input.id, now);
      if (!publicado) throw new NotFoundError("Comunicado não encontrado");
      return publicado;
    },

    /**
     * Apagar só vale para rascunho.
     *
     * §8.3, regra 2: comunicado publicado não se exclui — ele se **retifica**,
     * com versão nova e a antiga no histórico. Apagar o que a escola já leu
     * reescreveria o passado.
     */
    async remove(id: string) {
      const comunicado = await repo.findById(id);
      if (!comunicado) throw new NotFoundError("Comunicado não encontrado");

      if (comunicado.status !== "rascunho") {
        throw new ValidationError(
          "Comunicado publicado não pode ser excluído. Publique uma retificação — a versão anterior fica no histórico.",
        );
      }

      const removido = await repo.removeDraft(id);
      if (!removido) throw new NotFoundError("Comunicado não encontrado");
      return removido;
    },

    /** Retificar: nasce rascunho e só marca o antigo ao ser publicado. */
    async rectify(input: SaveDraftInput & { replacesId: string }, userId: string) {
      const anterior = await repo.findById(input.replacesId);
      if (!anterior) throw new NotFoundError("Comunicado a retificar não encontrado");
      if (anterior.status === "rascunho") {
        throw new ValidationError("Rascunho se edita, não se retifica.");
      }

      const novo = await repo.createDraft({ ...input, createdByUserId: userId });
      await repo.markAsRectified(input.replacesId);
      return novo;
    },

    /** O mural de quem recebe. */
    inbox: (input: {
      userId: string;
      role: string;
      academicYear: number;
      classroomId: string | null;
    }) =>
      repo.inboxOf({
        userId: input.userId,
        academicYear: input.academicYear,
        audiences: audiencesDoPapel(input.role),
        classroomId: input.classroomId,
      }),

    marcarComoLido: (communicationId: string, userId: string, acknowledge: boolean) =>
      repo.registerRead({ communicationId, userId, acknowledge }),
  };
}

export type CommunicationService = ReturnType<typeof createCommunicationService>;
