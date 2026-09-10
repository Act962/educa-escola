import { attendance, classroom, lesson, subject, user } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, asc, count, desc, eq, gte, inArray, lt, sql } from "drizzle-orm";

import type { TenantContext } from "../../trpc/tenant";

export type AttendanceStatus = (typeof attendance.$inferSelect)["status"];

export interface AttendanceEntry {
  studentId: string;
  status: AttendanceStatus;
}

const lessonColumns = {
  id: lesson.id,
  date: lesson.date,
  startsAt: lesson.startsAt,
  endsAt: lesson.endsAt,
  room: lesson.room,
  content: lesson.content,
  homework: lesson.homework,
  attendanceRecordedAt: lesson.attendanceRecordedAt,
  classroomId: lesson.classroomId,
  classroomName: classroom.name,
  subjectId: lesson.subjectId,
  subjectName: subject.name,
  teacherId: lesson.teacherId,
  teacherName: user.name,
};

/** Único lugar do módulo que monta query. Ver `classroom/repository.ts`. */
export function createLessonRepository(db: DbHandle, tenant: TenantContext) {
  const withinSchool = eq(lesson.schoolId, tenant.schoolId);

  const joined = () =>
    db
      .select(lessonColumns)
      .from(lesson)
      .innerJoin(classroom, eq(classroom.id, lesson.classroomId))
      .innerJoin(subject, eq(subject.id, lesson.subjectId))
      .innerJoin(user, eq(user.id, lesson.teacherId));

  return {
    async listByTeacherAndDate(teacherId: string, date: string) {
      return joined()
        .where(and(withinSchool, eq(lesson.teacherId, teacherId), eq(lesson.date, date)))
        .orderBy(asc(lesson.startsAt));
    },

    async listByClassroomAndDate(classroomId: string, date: string) {
      return joined()
        .where(and(withinSchool, eq(lesson.classroomId, classroomId), eq(lesson.date, date)))
        .orderBy(asc(lesson.startsAt));
    },

    /** Aulas passadas do professor ainda sem chamada — o "em atraso" do topo. */
    async listPendingForTeacher(teacherId: string, before: string) {
      return joined()
        .where(
          and(
            withinSchool,
            eq(lesson.teacherId, teacherId),
            lt(lesson.date, before),
            sql`${lesson.attendanceRecordedAt} is null`,
          ),
        )
        .orderBy(desc(lesson.date), asc(lesson.startsAt));
    },

    async findById(id: string) {
      const [row] = await joined()
        .where(and(withinSchool, eq(lesson.id, id)))
        .limit(1);
      return row ?? null;
    },

    async listAttendance(lessonId: string) {
      return db
        .select({ studentId: attendance.studentId, status: attendance.status })
        .from(attendance)
        .where(and(eq(attendance.schoolId, tenant.schoolId), eq(attendance.lessonId, lessonId)));
    },

    /**
     * Substitui a chamada inteira e carimba `attendanceRecordedAt`.
     *
     * Apagar e reinserir, em vez de fazer upsert linha a linha, é o que garante
     * que um aluno removido da turma não fique com presença fantasma. Roda em
     * transação para a tela nunca ver meia chamada.
     */
    async replaceAttendance(lessonId: string, entries: AttendanceEntry[], recordedAt: Date) {
      const write = async (tx: DbHandle) => {
        await tx
          .delete(attendance)
          .where(and(eq(attendance.schoolId, tenant.schoolId), eq(attendance.lessonId, lessonId)));

        if (entries.length > 0) {
          await tx.insert(attendance).values(
            entries.map((entry) => ({
              schoolId: tenant.schoolId,
              lessonId,
              studentId: entry.studentId,
              status: entry.status,
            })),
          );
        }

        await tx
          .update(lesson)
          .set({ attendanceRecordedAt: recordedAt })
          .where(and(withinSchool, eq(lesson.id, lessonId)));
      };

      // `db` já pode ser a transação do teste; aninhar transação no Postgres
      // exigiria savepoint, e aqui não precisamos disso.
      if ("transaction" in db && typeof db.transaction === "function") {
        await db.transaction(write);
      } else {
        await write(db);
      }
    },

    async saveDiary(lessonId: string, data: { content?: string | null; homework?: string | null }) {
      const [row] = await db
        .update(lesson)
        .set(data)
        .where(and(withinSchool, eq(lesson.id, lessonId)))
        .returning({ id: lesson.id });
      return row ?? null;
    },

    /** Quantas aulas de cada professor estão sem chamada — painel da Gestão. */
    async countPendingByTeacher(from: string, to: string) {
      return db
        .select({
          teacherId: lesson.teacherId,
          teacherName: user.name,
          pending: count(),
        })
        .from(lesson)
        .innerJoin(user, eq(user.id, lesson.teacherId))
        .where(
          and(
            withinSchool,
            gte(lesson.date, from),
            lt(lesson.date, to),
            sql`${lesson.attendanceRecordedAt} is null`,
          ),
        )
        .groupBy(lesson.teacherId, user.name)
        .orderBy(desc(count()));
    },

    /** Turmas em que o professor tem aula — base do dashboard e das notas. */
    async listTeacherClassrooms(teacherId: string) {
      return db
        .selectDistinct({
          classroomId: lesson.classroomId,
          classroomName: classroom.name,
          subjectId: lesson.subjectId,
          subjectName: subject.name,
        })
        .from(lesson)
        .innerJoin(classroom, eq(classroom.id, lesson.classroomId))
        .innerJoin(subject, eq(subject.id, lesson.subjectId))
        .where(and(withinSchool, eq(lesson.teacherId, teacherId)))
        .orderBy(asc(classroom.name));
    },

    /** Presenças agregadas da escola, para a frequência média do dashboard. */
    async presenceTotals(classroomIds?: string[]) {
      const clauses = [eq(attendance.schoolId, tenant.schoolId)];
      if (classroomIds) clauses.push(inArray(lesson.classroomId, classroomIds));

      const [row] = await db
        .select({
          present: sql<number>`count(*) filter (where ${attendance.status} <> 'falta')`.mapWith(
            Number,
          ),
          total: count(),
        })
        .from(attendance)
        .innerJoin(lesson, eq(lesson.id, attendance.lessonId))
        .where(and(...clauses));

      return row ?? { present: 0, total: 0 };
    },
  };
}

export type LessonRepository = ReturnType<typeof createLessonRepository>;
