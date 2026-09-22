import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";
import { classroom, school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/**
 * Rascunho é o que só quem escreveu enxerga — a mesma ideia da nota em
 * rascunho. `retificado` existe porque comunicado lido **não se apaga**
 * (§8.3): ele ganha uma versão nova e a antiga fica no histórico.
 */
export const communicationStatus = pgEnum("communication_status", [
  "rascunho",
  "publicado",
  "retificado",
]);

export const communicationPriority = pgEnum("communication_priority", [
  "normal",
  "importante",
  "urgente",
]);

/** A quem o comunicado se dirige (§8.2). */
export const communicationAudience = pgEnum("communication_audience", [
  "toda_a_escola",
  "professores",
  "alunos",
  "turma",
]);

export const communication = pgTable(
  "communication",
  {
    id: id(),
    schoolId: schoolId(),
    academicYear: integer("academic_year").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    priority: communicationPriority("priority").default("normal").notNull(),
    audience: communicationAudience("audience").default("toda_a_escola").notNull(),
    /** Preenchido quando `audience = 'turma'`. */
    classroomId: text("classroom_id").references(() => classroom.id, { onDelete: "cascade" }),
    status: communicationStatus("status").default("rascunho").notNull(),
    /**
     * Confirmação de leitura obrigatória.
     *
     * Muda o que a tela do destinatário faz: com ela, ele precisa clicar em
     * "li e estou ciente"; sem ela, abrir já conta. O painel de quem leu
     * existe nos dois casos.
     */
    requiresAck: boolean("requires_ack").default(false).notNull(),
    publishedAt: timestamp("published_at"),
    /** Depois disto o comunicado sai do mural, mas fica no histórico. */
    expiresOn: timestamp("expires_on"),
    /** Quando é retificação, aponta para o comunicado que substituiu. */
    replacesId: text("replaces_id"),
    createdByUserId: text("created_by_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("communication_escola_ano_idx").on(table.schoolId, table.academicYear, table.status),
    index("communication_turma_idx").on(table.classroomId),
  ],
);

/**
 * Quem leu o quê.
 *
 * Linha por leitura, criada na primeira vez que a pessoa abre. O índice único
 * é o que torna "marcar como lido" idempotente: abrir duas vezes não cria dois
 * recibos, e a taxa de leitura não passa de 100%.
 */
export const communicationReceipt = pgTable(
  "communication_receipt",
  {
    id: id(),
    schoolId: schoolId(),
    communicationId: text("communication_id")
      .notNull()
      .references(() => communication.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at").defaultNow().notNull(),
    /** Só quando o comunicado exigia ciência explícita. */
    acknowledgedAt: timestamp("acknowledged_at"),
  },
  (table) => [
    uniqueIndex("communication_receipt_uidx").on(table.communicationId, table.userId),
    index("communication_receipt_usuario_idx").on(table.userId),
  ],
);
