import { relations } from "drizzle-orm";
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

import { student } from "./academic";
import { user } from "./auth";
import { enrollment } from "./enrollment";
import { school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/** Percentual sobre a mensalidade, ou valor fixo em centavos. */
export const referralRewardKind = pgEnum("referral_reward_kind", ["percentual", "valor"]);

/**
 * Quem pode divulgar o link.
 *
 * Existe como coluna, e o padrão é `responsavel`, por causa do art. 2 do ECA
 * combinado com a Resolução 163/2014 do CONANDA, que considera abusiva a
 * publicidade dirigida a criança e adolescente. Um programa em que o aluno
 * capta clientes para a escola encosta nisso; com o responsável como
 * divulgador, quem faz a oferta é um adulto, e o benefício continua caindo na
 * mensalidade da mesma família.
 *
 * A escola pode mudar para `aluno` ou `ambos` na tela — é decisão dela, com a
 * consequência escrita ao lado do campo.
 */
export const referralRefererKind = pgEnum("referral_referer_kind", [
  "responsavel",
  "aluno",
  "ambos",
]);

/**
 * O programa de indicações da escola. Uma linha por escola.
 *
 * `enabled` nasce `false`: um programa de desconto que começa ligado sozinho
 * comprometeria receita sem ninguém ter decidido nada.
 */
export const referralProgram = pgTable("referral_program", {
  schoolId: text("school_id")
    .primaryKey()
    .references(() => school.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  /** Como aparece para quem divulga. Personalizável pela escola. */
  headline: text("headline").default("Indique e ganhe desconto").notNull(),
  description: text("description"),
  /** O texto que a família aceita. Guardado, não só exibido. */
  terms: text("terms"),
  rewardKind: referralRewardKind("reward_kind").default("percentual").notNull(),
  /**
   * Percentual de 1 a 100, ou centavos quando `rewardKind = 'valor'`.
   *
   * Centavos, e não decimal: dinheiro em ponto flutuante acumula erro de
   * arredondamento, e desconto errado numa mensalidade vira processo.
   */
  rewardValue: integer("reward_value").default(10).notNull(),
  /**
   * Teto de indicações premiadas por ano, por quem indica.
   *
   * Sem teto, um programa de 10% com dez indicações zera a mensalidade — e
   * cria o incentivo de caçar matrícula em vez de indicar quem tem perfil.
   */
  rewardCapPerYear: integer("reward_cap_per_year").default(3).notNull(),
  /** Dias de validade do link. Zero significa sem prazo. */
  linkExpiresInDays: integer("link_expires_in_days").default(90).notNull(),
  whoCanRefer: referralRefererKind("who_can_refer").default("responsavel").notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * O link de um aluno. Um por aluno, reaproveitado.
 *
 * O `code` é curto e legível de propósito: ele é ditado por telefone e escrito
 * no papel do portão da escola, não só clicado. Por isso o único é por escola,
 * e não global — duas escolas podem ter `ANA4K2` sem colidir.
 */
export const referralLink = pgTable(
  "referral_link",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    /** `null` quando o programa não põe prazo. */
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("referral_link_code_uidx").on(table.schoolId, table.code),
    uniqueIndex("referral_link_student_uidx").on(table.schoolId, table.studentId),
  ],
);

/**
 * A matrícula que veio de um link.
 *
 * **Não guarda situação.** Se "confirmada" fosse coluna, ela teria de ser
 * sincronizada toda vez que a matrícula mudasse de estado — e o dia em que a
 * secretaria cancelasse uma matrícula, o desconto continuaria de pé até
 * alguém lembrar. A situação é derivada da própria matrícula na leitura.
 *
 * O prêmio, esse sim, é congelado: `rewardKind` e `rewardValue` guardam o que
 * o programa valia no dia. Mudar a regra em março não pode alterar o desconto
 * de quem indicou em fevereiro.
 */
export const referralConversion = pgTable(
  "referral_conversion",
  {
    id: id(),
    schoolId: schoolId(),
    linkId: text("link_id")
      .notNull()
      .references(() => referralLink.id, { onDelete: "cascade" }),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    rewardKind: referralRewardKind("reward_kind").notNull(),
    rewardValue: integer("reward_value").notNull(),
    note: text("note"),
    registeredByUserId: text("registered_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    /** Uma matrícula premia uma indicação só. */
    uniqueIndex("referral_conversion_enrollment_uidx").on(table.schoolId, table.enrollmentId),
    index("referral_conversion_link_idx").on(table.linkId),
  ],
);

export const referralLinkRelations = relations(referralLink, ({ one, many }) => ({
  student: one(student, { fields: [referralLink.studentId], references: [student.id] }),
  conversions: many(referralConversion),
}));

export const referralConversionRelations = relations(referralConversion, ({ one }) => ({
  link: one(referralLink, { fields: [referralConversion.linkId], references: [referralLink.id] }),
  enrollment: one(enrollment, {
    fields: [referralConversion.enrollmentId],
    references: [enrollment.id],
  }),
}));
