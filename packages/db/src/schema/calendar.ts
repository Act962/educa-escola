import {
  boolean,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { classroom, school, stage } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/** Tipos de evento do §9.2, no recorte que o MVP sustenta. */
export const calendarEventType = pgEnum("calendar_event_type", [
  "feriado",
  "recesso",
  "ferias",
  "evento",
  "reuniao",
  "conselho",
  "avaliacao",
  "reposicao",
  "prazo",
]);

/**
 * O que o evento faz com a contagem de dias letivos.
 *
 * Coluna própria em vez de derivar do tipo: "evento escolar" pode ser em dia
 * letivo (feira de ciências na sexta) ou tomar o dia inteiro, e feriado
 * municipal em sábado não tira dia letivo nenhum. Amarrar ao tipo obrigaria a
 * criar um tipo novo a cada exceção.
 */
export const dayEffect = pgEnum("day_effect", ["nenhum", "nao_letivo", "letivo_extra"]);

/** A qual camada do §9.1 o evento pertence. */
export const calendarScope = pgEnum("calendar_scope", ["institucional", "segmento", "turma"]);

/**
 * O ano letivo da escola: quando começa, quando termina, e o mínimo legal.
 *
 * Uma linha por escola e ano. Sem ela não há contagem de dias letivos — e a
 * tela diz isso em vez de contar a partir de 1º de janeiro, que daria um
 * número plausível e errado.
 */
export const academicCalendar = pgTable(
  "academic_calendar",
  {
    id: id(),
    schoolId: schoolId(),
    academicYear: integer("academic_year").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    /**
     * Mínimo de dias letivos (LDB, art. 24, I: 200 dias).
     *
     * Coluna e não constante porque a lei fixa o piso, e rede estadual pode
     * exigir mais. Padrão 200; quem precisar de 210 muda na tela em vez de
     * pedir deploy.
     */
    minimumSchoolDays: integer("minimum_school_days").default(200).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("academic_calendar_ano_uidx").on(table.schoolId, table.academicYear)],
);

export const calendarEvent = pgTable(
  "calendar_event",
  {
    id: id(),
    schoolId: schoolId(),
    academicYear: integer("academic_year").notNull(),
    scope: calendarScope("scope").default("institucional").notNull(),
    /** Preenchido quando `scope = 'segmento'`. */
    stage: stage("stage"),
    /** Preenchido quando `scope = 'turma'`. */
    classroomId: text("classroom_id").references(() => classroom.id, { onDelete: "cascade" }),
    type: calendarEventType("type").notNull(),
    dayEffect: dayEffect("day_effect").default("nenhum").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    /** Fim inclusivo. Igual a `startsOn` num evento de um dia só. */
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    allDay: boolean("all_day").default(true).notNull(),
    createdByUserId: text("created_by_user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("calendar_event_ano_idx").on(table.schoolId, table.academicYear, table.startsOn),
    index("calendar_event_turma_idx").on(table.classroomId),
  ],
);
