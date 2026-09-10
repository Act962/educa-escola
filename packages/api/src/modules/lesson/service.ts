import { toSchoolDate, toSchoolTime } from "../../dates";
import { NotFoundError, ValidationError } from "../../errors";
import type { StudentRepository } from "../student/repository";
import type { AttendanceEntry, AttendanceStatus, LessonRepository } from "./repository";

/** Como a aula aparece na agenda. Deriva de horário e chamada, não é coluna. */
export type LessonState = "registrada" | "pendente" | "em_andamento" | "a_seguir";

export interface AttendanceSummary {
  presentes: number;
  faltas: number;
  atrasos: number;
  /** Frequência da própria aula, de 0 a 1. `null` sem ninguém na turma. */
  rate: number | null;
}

/**
 * Situação da aula no dia.
 *
 * Chamada registrada vence tudo. Depois disso é só relógio: aula que já
 * terminou e não tem chamada está pendente — é o que o professor precisa ver
 * primeiro no dashboard.
 */
export function lessonState(
  lesson: { startsAt: string; endsAt: string; date: string; attendanceRecordedAt: Date | null },
  now: Date,
): LessonState {
  if (lesson.attendanceRecordedAt) return "registrada";

  const today = toSchoolDate(now);
  if (lesson.date < today) return "pendente";
  if (lesson.date > today) return "a_seguir";

  const time = toSchoolTime(now);
  if (time >= lesson.endsAt) return "pendente";
  if (time >= lesson.startsAt) return "em_andamento";
  return "a_seguir";
}

/**
 * Atraso conta como presença: quem chegou assistiu à aula. O número de atrasos
 * continua visível à parte porque é o que a coordenação acompanha.
 */
export function summarizeAttendance(entries: AttendanceEntry[]): AttendanceSummary {
  const presentes = entries.filter((entry) => entry.status === "presente").length;
  const faltas = entries.filter((entry) => entry.status === "falta").length;
  const atrasos = entries.filter((entry) => entry.status === "atraso").length;

  return {
    presentes,
    faltas,
    atrasos,
    rate: entries.length === 0 ? null : (presentes + atrasos) / entries.length,
  };
}

/**
 * Até quando a chamada pode ser alterada sem justificativa: o fim do dia da
 * aula. Depois disso o registro vira correção de histórico, e correção de
 * histórico precisa de motivo.
 */
export function attendanceDeadline(lessonDate: string): string {
  return `${lessonDate} 23:59`;
}

export function requiresJustification(lessonDate: string, now: Date): boolean {
  return lessonDate < toSchoolDate(now);
}

export interface SaveAttendanceInput {
  lessonId: string;
  entries: AttendanceEntry[];
  content?: string | null;
  homework?: string | null;
  justification?: string | null;
}

export function createLessonService(repo: LessonRepository, students: StudentRepository) {
  async function getOrThrow(id: string) {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError("Aula não encontrada");
    return found;
  }

  function decorate<T extends Parameters<typeof lessonState>[0]>(lesson: T, now: Date) {
    return { ...lesson, state: lessonState(lesson, now) };
  }

  return {
    async agendaOfTeacher(teacherId: string, now: Date) {
      const today = toSchoolDate(now);
      const [lessons, pending] = await Promise.all([
        repo.listByTeacherAndDate(teacherId, today),
        repo.listPendingForTeacher(teacherId, today),
      ]);

      return {
        date: today,
        lessons: lessons.map((lesson) => decorate(lesson, now)),
        overdue: pending.map((lesson) => decorate(lesson, now)),
      };
    },

    async agendaOfClassroom(classroomId: string, now: Date) {
      const today = toSchoolDate(now);
      const lessons = await repo.listByClassroomAndDate(classroomId, today);
      return { date: today, lessons: lessons.map((lesson) => decorate(lesson, now)) };
    },

    /**
     * A folha de chamada: turma inteira, já cruzada com o que foi registrado.
     *
     * Quem ainda não tem registro entra como **presente** — é a regra da tela
     * ("marque apenas as exceções") e é o que faz a chamada caber em 60s.
     */
    async attendanceSheet(lessonId: string, now: Date) {
      const lesson = await getOrThrow(lessonId);
      const [roster, recorded] = await Promise.all([
        students.listByClassroom(lesson.classroomId),
        repo.listAttendance(lessonId),
      ]);

      const byStudent = new Map(recorded.map((row) => [row.studentId, row.status]));

      const entries = roster.map((student) => ({
        studentId: student.id,
        name: student.name,
        registration: student.registration,
        absencesInTerm: student.absentCount,
        status: byStudent.get(student.id) ?? ("presente" as AttendanceStatus),
      }));

      return {
        lesson: decorate(lesson, now),
        entries,
        summary: summarizeAttendance(entries),
        deadline: attendanceDeadline(lesson.date),
        requiresJustification: requiresJustification(lesson.date, now),
      };
    },

    async saveAttendance(input: SaveAttendanceInput, now: Date) {
      const lesson = await getOrThrow(input.lessonId);

      if (requiresJustification(lesson.date, now) && !input.justification?.trim()) {
        throw new ValidationError(
          "Esta aula já passou do prazo de registro. Descreva a justificativa da alteração.",
        );
      }

      const roster = await students.listByClassroom(lesson.classroomId);
      const rosterIds = new Set(roster.map((student) => student.id));

      const foreign = input.entries.filter((entry) => !rosterIds.has(entry.studentId));
      if (foreign.length > 0) {
        throw new ValidationError("A chamada inclui aluno que não está nesta turma");
      }

      const marked = new Map(input.entries.map((entry) => [entry.studentId, entry.status]));
      const entries: AttendanceEntry[] = roster.map((student) => ({
        studentId: student.id,
        status: marked.get(student.id) ?? "presente",
      }));

      await repo.replaceAttendance(input.lessonId, entries, now);

      if (input.content !== undefined || input.homework !== undefined) {
        await repo.saveDiary(input.lessonId, {
          content: input.content,
          homework: input.homework,
        });
      }

      return { lessonId: input.lessonId, summary: summarizeAttendance(entries) };
    },

    get: getOrThrow,

    classroomsOf: (teacherId: string) => repo.listTeacherClassrooms(teacherId),
  };
}

export type LessonService = ReturnType<typeof createLessonService>;
