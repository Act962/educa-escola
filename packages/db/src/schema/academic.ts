import { relations } from "drizzle-orm";
import {
  date,
  index,
  integer,
  numeric,
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

/** Turno em que a pessoa estuda. Aparece na listagem de alunos da Gestão. */
export const shift = pgEnum("shift", ["manha", "tarde", "noite"]);

/**
 * Situação de matrícula. "Alerta de frequência" **não** está aqui de propósito:
 * é derivada do percentual de presença, não um estado que alguém digita.
 */
export const studentStatus = pgEnum("student_status", [
  "ativo",
  "documentacao_pendente",
  "transferido",
  "inativo",
]);

/** Atraso conta como presença na frequência, mas fica registrado à parte. */
export const attendanceStatus = pgEnum("attendance_status", ["presente", "falta", "atraso"]);

/**
 * Rascunho é o lançamento que só o professor enxerga. O aluno vê exclusivamente
 * o que foi publicado — é requisito, e é o motivo desta coluna existir.
 */
export const assessmentStatus = pgEnum("assessment_status", ["rascunho", "publicada"]);

export const subject = pgTable(
  "subject",
  {
    id: id(),
    schoolId: schoolId(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("subject_school_name_uidx").on(table.schoolId, table.name)],
);

export const student = pgTable(
  "student",
  {
    id: id(),
    schoolId: schoolId(),
    /** Nulo enquanto a matrícula não foi alocada em turma. */
    classroomId: text("classroom_id").references(() => classroom.id, { onDelete: "set null" }),
    /**
     * Conta de acesso do aluno, quando existe. Nem todo aluno tem login — o
     * cadastro escolar vem antes do acesso, e a ficha não depende dele.
     */
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    registration: text("registration").notNull(),
    shift: shift("shift").default("manha").notNull(),
    guardianName: text("guardian_name"),
    status: studentStatus("status").default("ativo").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("student_school_id_idx").on(table.schoolId),
    index("student_classroom_id_idx").on(table.classroomId),
    uniqueIndex("student_school_registration_uidx").on(table.schoolId, table.registration),
  ],
);

/**
 * Uma aula concreta na agenda: turma, disciplina, professor, dia e horário.
 *
 * `attendanceRecordedAt` é o que separa "chamada pendente" de "registrada" —
 * a ausência de linha em `attendance` não serviria, porque uma turma pode
 * legitimamente ter todo mundo presente.
 */
export const lesson = pgTable(
  "lesson",
  {
    id: id(),
    schoolId: schoolId(),
    classroomId: text("classroom_id")
      .notNull()
      .references(() => classroom.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Data civil da aula, sem fuso: o dia letivo é local à escola. */
    date: date("date", { mode: "string" }).notNull(),
    startsAt: text("starts_at").notNull(),
    endsAt: text("ends_at").notNull(),
    room: text("room"),
    content: text("content"),
    homework: text("homework"),
    attendanceRecordedAt: timestamp("attendance_recorded_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("lesson_school_date_idx").on(table.schoolId, table.date),
    index("lesson_teacher_date_idx").on(table.teacherId, table.date),
    index("lesson_classroom_idx").on(table.classroomId),
  ],
);

export const attendance = pgTable(
  "attendance",
  {
    id: id(),
    schoolId: schoolId(),
    lessonId: text("lesson_id")
      .notNull()
      .references(() => lesson.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("attendance_lesson_student_uidx").on(table.lessonId, table.studentId),
    index("attendance_student_idx").on(table.studentId),
  ],
);

export const assessment = pgTable(
  "assessment",
  {
    id: id(),
    schoolId: schoolId(),
    classroomId: text("classroom_id")
      .notNull()
      .references(() => classroom.id, { onDelete: "cascade" }),
    subjectId: text("subject_id")
      .notNull()
      .references(() => subject.id, { onDelete: "cascade" }),
    /** Quem lançou. É por aqui que a Gestão cobra a pendência de nota. */
    teacherId: text("teacher_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Peso na média do período. Inteiro para a conta não depender de float. */
    weight: integer("weight").default(1).notNull(),
    /** Bimestre (1 a 4) a que a avaliação pertence. */
    term: integer("term").notNull(),
    appliedOn: date("applied_on", { mode: "string" }),
    status: assessmentStatus("status").default("rascunho").notNull(),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("assessment_school_idx").on(table.schoolId),
    index("assessment_classroom_term_idx").on(table.classroomId, table.term),
  ],
);

export const grade = pgTable(
  "grade",
  {
    id: id(),
    schoolId: schoolId(),
    assessmentId: text("assessment_id")
      .notNull()
      .references(() => assessment.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    /**
     * `numeric` e não ponto flutuante: nota é dado com valor legal, e 0,1 não
     * tem representação exata em binário.
     */
    score: numeric("score", { precision: 4, scale: 2, mode: "number" }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("grade_assessment_student_uidx").on(table.assessmentId, table.studentId),
    index("grade_student_idx").on(table.studentId),
  ],
);

export const subjectRelations = relations(subject, ({ many }) => ({
  lessons: many(lesson),
  assessments: many(assessment),
}));

export const studentRelations = relations(student, ({ one, many }) => ({
  classroom: one(classroom, {
    fields: [student.classroomId],
    references: [classroom.id],
  }),
  attendances: many(attendance),
  grades: many(grade),
}));

export const lessonRelations = relations(lesson, ({ one, many }) => ({
  classroom: one(classroom, { fields: [lesson.classroomId], references: [classroom.id] }),
  subject: one(subject, { fields: [lesson.subjectId], references: [subject.id] }),
  teacher: one(user, { fields: [lesson.teacherId], references: [user.id] }),
  attendances: many(attendance),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  lesson: one(lesson, { fields: [attendance.lessonId], references: [lesson.id] }),
  student: one(student, { fields: [attendance.studentId], references: [student.id] }),
}));

export const assessmentRelations = relations(assessment, ({ one, many }) => ({
  classroom: one(classroom, { fields: [assessment.classroomId], references: [classroom.id] }),
  subject: one(subject, { fields: [assessment.subjectId], references: [subject.id] }),
  grades: many(grade),
}));

export const gradeRelations = relations(grade, ({ one }) => ({
  assessment: one(assessment, { fields: [grade.assessmentId], references: [assessment.id] }),
  student: one(student, { fields: [grade.studentId], references: [student.id] }),
}));
