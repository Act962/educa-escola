import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { school } from "./school";

/**
 * Adesão ao placar entre escolas.
 *
 * Tabela de **consentimento**, não de configuração. Escola que não tem linha
 * aqui não aparece no placar e — o que importa mais — **não é lida**: a
 * consulta do placar é um `innerJoin` nesta tabela, então a ausência de linha
 * não é um filtro que alguém pode esquecer, é uma linha que não existe para
 * juntar.
 */
export const leaderboardStatus = pgEnum("leaderboard_status", ["ativa", "suspensa"]);

export const schoolLeaderboardOptIn = pgTable(
  "school_leaderboard_opt_in",
  {
    /** Compartilha a chave com `school`: uma adesão por escola, no máximo. */
    schoolId: text("school_id")
      .primaryKey()
      .references(() => school.id, { onDelete: "cascade" }),
    /**
     * Como a escola quer ser chamada no placar.
     *
     * Separado do nome da `organization` de propósito: aparecer num placar
     * público é decisão de comunicação, e a direção pode querer "Dom Pedro II"
     * onde o cadastro diz "Colégio Estadual Dom Pedro II - Unidade Centro".
     */
    displayName: text("display_name").notNull(),
    status: leaderboardStatus("status").default("ativa").notNull(),
    academicYear: integer("academic_year").notNull(),
    optedInAt: timestamp("opted_in_at").defaultNow().notNull(),
    optedInByUserId: text("opted_in_by_user_id").notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("leaderboard_opt_in_school_uidx").on(table.schoolId),
    index("leaderboard_opt_in_ano_idx").on(table.academicYear, table.status),
  ],
);

/**
 * O placar publicado: um número por escola, e nada mais.
 *
 * **Não tem coluna para pessoa, e isso é a proteção.** Um `innerJoin` mal
 * escrito na consulta do placar não consegue vazar aluno nem professor, porque
 * não há onde colocá-los. A tabela é reconstruída inteira a cada apuração, a
 * partir de agregados que cada escola calcula sobre os próprios dados.
 */
export const schoolLeaderboardEntry = pgTable(
  "school_leaderboard_entry",
  {
    schoolId: text("school_id")
      .primaryKey()
      .references(() => school.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    academicYear: integer("academic_year").notNull(),
    /** 0 a 300: cem por cada um dos três indicadores. */
    points: integer("points").notNull(),
    /** Os três indicadores, de 0 a 100, para a escola saber onde melhorar. */
    attendanceOnTime: integer("chamada_no_prazo").notNull(),
    gradesWithoutPending: integer("notas_sem_pendencia").notNull(),
    averageAttendance: integer("frequencia_media").notNull(),
    computedAt: timestamp("computed_at").defaultNow().notNull(),
  },
  (table) => [index("leaderboard_entry_ano_idx").on(table.academicYear, table.points)],
);
