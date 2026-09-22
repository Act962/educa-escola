import {
  communication,
  communicationReceipt,
  member,
  student,
  user,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, count, desc, eq, inArray, or, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";
import type { Audience, SaveDraftInput } from "./schema";

const NA_SALA = ["ativo", "documentacao_pendente"] as const;

/** Único lugar do módulo que monta query. Recebe `(db, tenant)`. */
export function createCommunicationRepository(db: DbHandle, tenant: TenantContext) {
  const naEscola = eq(communication.schoolId, tenant.schoolId);

  return {
    async list(academicYear: number) {
      return db
        .select()
        .from(communication)
        .where(and(naEscola, eq(communication.academicYear, academicYear)))
        .orderBy(desc(communication.createdAt));
    },

    async findById(id: string) {
      const [row] = await db
        .select()
        .from(communication)
        .where(and(naEscola, eq(communication.id, id)))
        .limit(1);
      return row ?? null;
    },

    async createDraft(data: SaveDraftInput & { createdByUserId: string; replacesId?: string }) {
      const [row] = await db
        .insert(communication)
        .values({
          ...data,
          classroomId: data.audience === "turma" ? (data.classroomId ?? null) : null,
          schoolId: tenant.schoolId,
          status: "rascunho",
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    async publish(id: string, now: Date) {
      const [row] = await db
        .update(communication)
        .set({ status: "publicado", publishedAt: now })
        .where(and(naEscola, eq(communication.id, id)))
        .returning();
      return row ?? null;
    },

    async markAsRectified(id: string) {
      const [row] = await db
        .update(communication)
        .set({ status: "retificado" })
        .where(and(naEscola, eq(communication.id, id)))
        .returning({ id: communication.id });
      return row ?? null;
    },

    async removeDraft(id: string) {
      const [row] = await db
        .delete(communication)
        .where(and(naEscola, eq(communication.id, id), eq(communication.status, "rascunho")))
        .returning({ id: communication.id });
      return row ?? null;
    },

    /**
     * Quantas pessoas o comunicado alcança.
     *
     * Conta o público **antes** do envio, que é o que o §8.2 pede e o que faz
     * a confirmação de envio em massa significar alguma coisa: "isto vai para
     * 303 pessoas" é aviso; "isto vai para todo mundo" não é.
     */
    async audienceSize(audience: Audience, classroomId: string | null) {
      if (audience === "professores") {
        const [row] = await db
          .select({ total: count(member.id) })
          .from(member)
          .where(and(eq(member.organizationId, tenant.schoolId), eq(member.role, "teacher")));
        return row?.total ?? 0;
      }

      if (audience === "alunos" || audience === "turma") {
        const filtros = [eq(student.schoolId, tenant.schoolId), inArray(student.status, NA_SALA)];
        if (audience === "turma" && classroomId) {
          filtros.push(eq(student.classroomId, classroomId));
        }
        const [row] = await db
          .select({ total: count(student.id) })
          .from(student)
          .where(and(...filtros));
        return row?.total ?? 0;
      }

      const [docentes] = await db
        .select({ total: count(member.id) })
        .from(member)
        .where(and(eq(member.organizationId, tenant.schoolId), eq(member.role, "teacher")));
      const [alunos] = await db
        .select({ total: count(student.id) })
        .from(student)
        .where(and(eq(student.schoolId, tenant.schoolId), inArray(student.status, NA_SALA)));

      return (docentes?.total ?? 0) + (alunos?.total ?? 0);
    },

    /** Quantos leram cada comunicado. Base da taxa de leitura. */
    async receiptCounts(ids: string[]) {
      if (ids.length === 0) return [];
      return db
        .select({
          communicationId: communicationReceipt.communicationId,
          leram: count(communicationReceipt.id),
          confirmaram:
            sql<number>`count(*) filter (where ${communicationReceipt.acknowledgedAt} is not null)`.mapWith(
              Number,
            ),
        })
        .from(communicationReceipt)
        .where(
          and(
            eq(communicationReceipt.schoolId, tenant.schoolId),
            inArray(communicationReceipt.communicationId, ids),
          ),
        )
        .groupBy(communicationReceipt.communicationId);
    },

    /**
     * Registra a leitura. Idempotente pelo índice único.
     *
     * Abrir duas vezes não cria dois recibos — sem isso a taxa de leitura
     * passaria de 100% e ninguém confiaria nela de novo.
     */
    async registerRead(input: { communicationId: string; userId: string; acknowledge: boolean }) {
      const [row] = await db
        .insert(communicationReceipt)
        .values({
          schoolId: tenant.schoolId,
          communicationId: input.communicationId,
          userId: input.userId,
          acknowledgedAt: input.acknowledge ? new Date() : null,
        })
        .onConflictDoUpdate({
          target: [communicationReceipt.communicationId, communicationReceipt.userId],
          // A ciência pode chegar depois da leitura; a leitura nunca se apaga.
          set: input.acknowledge ? { acknowledgedAt: new Date() } : {},
        })
        .returning();
      return row as NonNullable<typeof row>;
    },

    /** Os comunicados publicados que esta pessoa deve ver. */
    async inboxOf(input: {
      userId: string;
      academicYear: number;
      audiences: Audience[];
      classroomId: string | null;
    }) {
      const alcance = input.classroomId
        ? or(
            inArray(communication.audience, input.audiences),
            and(
              eq(communication.audience, "turma"),
              eq(communication.classroomId, input.classroomId),
            ),
          )
        : inArray(communication.audience, input.audiences);

      return db
        .select({
          id: communication.id,
          title: communication.title,
          body: communication.body,
          priority: communication.priority,
          requiresAck: communication.requiresAck,
          publishedAt: communication.publishedAt,
          readAt: communicationReceipt.readAt,
          acknowledgedAt: communicationReceipt.acknowledgedAt,
          autor: user.name,
        })
        .from(communication)
        .innerJoin(user, eq(user.id, communication.createdByUserId))
        .leftJoin(
          communicationReceipt,
          and(
            eq(communicationReceipt.communicationId, communication.id),
            eq(communicationReceipt.userId, input.userId),
          ),
        )
        .where(
          and(
            naEscola,
            eq(communication.academicYear, input.academicYear),
            eq(communication.status, "publicado"),
            alcance,
          ),
        )
        .orderBy(desc(communication.publishedAt));
    },

    /** Quantos não leram ainda — o número que a direção age em cima. */
    async unreadCountOf(input: {
      userId: string;
      academicYear: number;
      audiences: Audience[];
      classroomId: string | null;
    }) {
      const linhas = await this.inboxOf(input);
      return linhas.filter((linha) => linha.readAt === null).length;
    },
  };
}

export type CommunicationRepository = ReturnType<typeof createCommunicationRepository>;
