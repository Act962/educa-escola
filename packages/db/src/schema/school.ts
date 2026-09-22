import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { organization } from "./auth";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * Atributos escolares da `organization`.
 *
 * Compartilha a chave primária com `organization` (1:1) de propósito: assim
 * `schoolId === organizationId` e não existe mapeamento entre "id da org" e
 * "id da escola" em toda requisição. A auth é dona de `organization`/`member`;
 * o domínio é dono desta tabela e de tudo que pende dela.
 */
export const school = pgTable("school", {
  id: text("id")
    .primaryKey()
    .references(() => organization.id, { onDelete: "cascade" }),
  /** Código INEP da escola (Censo Escolar). Nem toda escola tem no cadastro. */
  inepCode: text("inep_code"),
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Segmento de ensino.
 *
 * Mora aqui, e não em `academic.ts`, porque a turma precisa dele e
 * `academic.ts` já importa deste arquivo — declarar lá fecharia um ciclo de
 * import, e o ciclo só aparece em tempo de execução ("Cannot access 'stage'
 * before initialization"), não na compilação.
 *
 * O segmento acompanha a série porque "1º ano" existe no fundamental e no
 * médio: a série sozinha é ambígua, o par série+segmento não é.
 */
export const stage = pgEnum("stage", ["infantil", "fundamental_i", "fundamental_ii", "medio"]);

/** Turma. Primeira entidade sob o tenant — toda query passa por `schoolId`. */
export const classroom = pgTable(
  "classroom",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    academicYear: integer("academic_year").notNull(),
    /**
     * Série e segmento da turma. **Nuláveis de propósito.**
     *
     * A turma existia só como nome e ano letivo, e escola em operação tem
     * turma que não encaixa em série numérica — "Berçário II", "EJA Módulo
     * III". Exigir o campo obrigaria a secretaria a inventar um número, e
     * número inventado vira relatório errado. Nulo significa "esta turma não
     * tem série", que é uma resposta legítima.
     *
     * Enquanto for nulo, `classCodeOf` continua lendo a série do nome da
     * turma, como sempre fez. A coluna é a fonte preferida; o nome é o
     * fallback que ela veio aposentar.
     */
    stage: stage("stage"),
    gradeLevel: integer("grade_level"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("classroom_school_id_idx").on(table.schoolId),
    uniqueIndex("classroom_school_year_name_uidx").on(
      table.schoolId,
      table.academicYear,
      table.name,
    ),
  ],
);

export const schoolRelations = relations(school, ({ one, many }) => ({
  organization: one(organization, {
    fields: [school.id],
    references: [organization.id],
  }),
  classrooms: many(classroom),
}));

export const classroomRelations = relations(classroom, ({ one }) => ({
  school: one(school, {
    fields: [classroom.schoolId],
    references: [school.id],
  }),
}));
