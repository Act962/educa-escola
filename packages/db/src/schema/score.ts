import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

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
 * Quem pontua.
 *
 * `escola` existe na coluna desde já porque o placar entre escolas é a PR
 * seguinte, e acrescentar valor a enum em produção é migration de tabela
 * inteira. O que ainda não apura é código, não é forma.
 */
export const scoreSubjectKind = pgEnum("score_subject_kind", ["aluno", "professor", "escola"]);

/**
 * Um ponto ganho, com a origem que o justifica.
 *
 * Fato imutável: a apuração nunca atualiza nem apaga linha, só acrescenta.
 * É o que permite responder "por que eu tenho 240 pontos?" com a lista dos
 * fatos, em vez de um número que alguém precisa acreditar.
 *
 * **O índice único é a apuração inteira.** `(schoolId, subjectKind, subjectId,
 * ruleKey, sourceId)` mais `onConflictDoNothing` fazem reexecutar a apuração
 * ser inofensivo — e ela vai ser reexecutada, porque não existe agendador e
 * alguém vai clicar duas vezes.
 */
export const scoreEvent = pgTable(
  "score_event",
  {
    id: id(),
    schoolId: schoolId(),
    subjectKind: scoreSubjectKind("subject_kind").notNull(),
    /**
     * Id de aluno, de usuário (professor) ou de escola, conforme `subjectKind`.
     *
     * Sem chave estrangeira de propósito: o alvo muda com o tipo, e uma FK só
     * seria possível com três colunas nulas — o que tornaria "para quem é este
     * ponto?" uma pergunta de três checagens em vez de uma leitura.
     */
    subjectId: text("subject_id").notNull(),
    /** A chave da regra em `modules/score/rules.ts`. */
    ruleKey: text("rule_key").notNull(),
    points: integer("points").notNull(),
    academicYear: integer("academic_year").notNull(),
    /** Bimestre, quando a regra é de período. Nulo quando é do ano. */
    term: integer("term"),
    /** Que tabela originou o ponto: `attendance`, `lesson`, `assessment`, `term`. */
    sourceKind: text("source_kind").notNull(),
    /** O id da linha de origem — ou a chave do período, para regra de bimestre. */
    sourceId: text("source_id").notNull(),
    occurredAt: timestamp("occurred_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("score_event_origem_uidx").on(
      table.schoolId,
      table.subjectKind,
      table.subjectId,
      table.ruleKey,
      table.sourceId,
    ),
    index("score_event_subject_idx").on(
      table.schoolId,
      table.subjectKind,
      table.subjectId,
      table.academicYear,
    ),
  ],
);

/**
 * O total por pessoa e ano. Projeção, não fonte.
 *
 * Existe para a tela não somar milhares de eventos a cada abertura. Pode ser
 * jogada fora e reconstruída a partir de `score_event` — e o teste faz
 * exatamente isso, porque projeção que diverge da fonte em silêncio é pior
 * que projeção nenhuma.
 */
export const scoreBalance = pgTable(
  "score_balance",
  {
    id: id(),
    schoolId: schoolId(),
    subjectKind: scoreSubjectKind("subject_kind").notNull(),
    subjectId: text("subject_id").notNull(),
    academicYear: integer("academic_year").notNull(),
    points: integer("points").default(0).notNull(),
    /** Quantos eventos somaram este total. Serve para conferir a projeção. */
    eventCount: integer("event_count").default(0).notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("score_balance_sujeito_uidx").on(
      table.schoolId,
      table.subjectKind,
      table.subjectId,
      table.academicYear,
    ),
    index("score_balance_placar_idx").on(table.schoolId, table.subjectKind, table.academicYear),
  ],
);
