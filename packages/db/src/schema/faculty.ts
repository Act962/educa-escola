import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { subject } from "./academic";
import { user } from "./auth";
import { school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/**
 * O que o professor **pode** lecionar.
 *
 * Não é o que ele leciona: isso já se sabe, e se sabe melhor — sai das aulas
 * que ele deu, sem ninguém precisar manter. Habilitação é outra coisa, e serve
 * para o contrário: montar a grade **antes** de existir aula, oferecendo à
 * coordenação só quem dá aquela disciplina.
 *
 * Por isso as duas convivem. A ficha do professor continua mostrando o que ele
 * leciona de fato; esta tabela responde "quem pode pegar Matemática do 8º?".
 */
export const teacherSubject = pgTable(
  "teacher_subject",
  {
    id: id(),
    schoolId: schoolId(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("teacher_subject_uidx").on(table.userId, table.subjectId),
    index("teacher_subject_school_idx").on(table.schoolId, table.subjectId),
  ],
);

/**
 * Convite de professor.
 *
 * Mesma máquina do convite de matrícula, e pelo mesmo motivo: **a escola nunca
 * conhece a senha de ninguém.** Quem cria a senha é o professor, abrindo o
 * link; o que a secretaria guarda é só o hash do token, então dump de banco
 * não produz convite que funcione.
 *
 * Não usa o convite do Better Auth de propósito: o dele pressupõe que a pessoa
 * já tem conta e está autenticada para aceitar, e aqui o professor ainda não
 * existe. Este fluxo cria a conta e o vínculo no mesmo gesto.
 */
export const teacherInvite = pgTable(
  "teacher_invite",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull(),
    /**
     * As disciplinas escolhidas na criação, guardadas até o aceite.
     *
     * Ficam aqui e não em `teacher_subject` porque o professor ainda não tem
     * `userId` — ele nasce no aceite. Virar linhas de habilitação é a última
     * coisa que o aceite faz.
     */
    subjectIds: text("subject_ids").array().notNull().default([]),
    expiresAt: timestamp("expires_at").notNull(),
    consumedAt: timestamp("consumed_at"),
    revokedAt: timestamp("revoked_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /**
     * Único **global**, como o convite de matrícula: é a chave de busca do
     * fluxo público, onde ainda não se sabe de que escola é a requisição.
     */
    uniqueIndex("teacher_invite_token_hash_uidx").on(table.tokenHash),
    index("teacher_invite_school_idx").on(table.schoolId),
  ],
);

export const teacherSubjectRelations = relations(teacherSubject, ({ one }) => ({
  subject: one(subject, { fields: [teacherSubject.subjectId], references: [subject.id] }),
  professor: one(user, { fields: [teacherSubject.userId], references: [user.id] }),
}));
