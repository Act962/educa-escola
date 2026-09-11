import { toSchoolDate } from "../../dates";
import type { AssessmentRepository } from "../assessment/repository";
import { PASSING_AVERAGE, roundGrade } from "../assessment/service";
import type { LessonRepository } from "../lesson/repository";
import {
  attendanceRate,
  isBelowMinimumAttendance,
  MINIMUM_ATTENDANCE_RATE,
  type PresenceCounts,
} from "../student/service";
import type { OverviewRepository } from "./repository";

export interface DashboardDeps {
  overview: OverviewRepository;
  lessons: LessonRepository;
  assessments: AssessmentRepository;
}

/** Por que este aluno apareceu na lista de atenção. Nunca só "está mal". */
export type RiskReason = "frequencia" | "media";

export interface StudentAtRisk {
  studentId: string;
  name: string;
  classroomName: string | null;
  reason: RiskReason;
  detail: string;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Dashboards dos três perfis.
 *
 * Cada número da tela sai de uma regra que também existe em outro lugar
 * (frequência mínima, média de aprovação): importamos a regra em vez de
 * repetir o limiar aqui, senão o dashboard e o boletim discordariam.
 */
export function createOverviewService(deps: DashboardDeps) {
  const { overview, lessons, assessments } = deps;

  function riskFromAttendance<
    T extends PresenceCounts & {
      studentId: string;
      studentName: string;
      classroomName: string | null;
    },
  >(rows: T[]): StudentAtRisk[] {
    return rows.filter(isBelowMinimumAttendance).map((row) => ({
      studentId: row.studentId,
      name: row.studentName,
      classroomName: row.classroomName,
      reason: "frequencia" as const,
      detail: `Frequência ${percent(attendanceRate(row) ?? 0)} · abaixo do mínimo`,
    }));
  }

  return {
    /** Painel da direção: números da escola e quem está devendo lançamento. */
    async gestao(term: number, now: Date) {
      // Ano letivo pelo calendário da escola, não pelo relógio do processo.
      const today = toSchoolDate(now);
      const from = `${today.slice(0, 4)}-01-01`;
      // Pendência só existe para aula que já aconteceu: contar a grade futura
      // como "não registrada" transformaria o planejamento em cobrança.
      const to = today;

      const [statuses, classrooms, teachers, presence, byStudent, averages, pendingCalls, missing] =
        await Promise.all([
          overview.studentCounts(),
          overview.classroomCount(),
          overview.teacherCount(),
          lessons.presenceTotals(),
          overview.attendanceByStudent(),
          overview.publishedAveragesByStudent(term),
          lessons.countPendingByTeacher(from, to),
          assessments.countMissingGradesByTeacher(),
        ]);

      const totalOf = (status: string) => statuses.find((row) => row.status === status)?.total ?? 0;

      const missingByTeacher = new Map(missing.map((row) => [row.teacherId, row.missing]));

      const pendingByTeacher = [
        ...pendingCalls.map((row) => ({
          teacherId: row.teacherId,
          teacherName: row.teacherName,
          pendingCalls: row.pending,
          pendingGrades: missingByTeacher.get(row.teacherId) ?? 0,
        })),
        // Professor em dia com a chamada mas devendo nota também é cobrança.
        ...missing
          .filter((row) => !pendingCalls.some((call) => call.teacherId === row.teacherId))
          .map((row) => ({
            teacherId: row.teacherId,
            teacherName: row.teacherName,
            pendingCalls: 0,
            pendingGrades: row.missing,
          })),
      ].sort(
        (a, b) =>
          b.pendingCalls + b.pendingGrades - (a.pendingCalls + a.pendingGrades) ||
          a.teacherName.localeCompare(b.teacherName, "pt-BR"),
      );

      const belowAttendance = byStudent.filter(isBelowMinimumAttendance).length;
      const belowAverage = averages.filter((row) => row.average < PASSING_AVERAGE).length;

      return {
        students: {
          active: totalOf("ativo"),
          pendingDocuments: totalOf("documentacao_pendente"),
          transferred: totalOf("transferido"),
        },
        classrooms,
        teachers,
        attendanceRate: presence.total === 0 ? null : presence.present / presence.total,
        minimumAttendanceRate: MINIMUM_ATTENDANCE_RATE,
        risk: {
          belowAttendance,
          belowAverage,
          total: belowAttendance + belowAverage,
        },
        // Uma fila só, de quem deve alguma coisa. Chamada em aberto e nota em
        // aberto são duas dívidas com a mesma pessoa: separá-las em duas
        // listas fazia a tela mostrar uma e esquecer a outra.
        pending: pendingByTeacher,
      };
    },

    /** Painel do professor: as turmas do vínculo e quem precisa de atenção. */
    async professor(teacherId: string, term: number) {
      const [classroomIds, averages, missing] = await Promise.all([
        overview.classroomIdsOfTeacher(teacherId),
        assessments.publishedAveragesByClassroom(teacherId, term),
        assessments.countMissingGradesByTeacher(),
      ]);

      const attendanceRows = await overview.attendanceByStudentInClassrooms(classroomIds);

      const byClassroom = new Map<
        string,
        { name: string; current: number | null; previous: number | null }
      >();
      for (const row of averages) {
        const bucket = byClassroom.get(row.classroomId) ?? {
          name: row.classroomName,
          current: null,
          previous: null,
        };
        if (row.term === term) bucket.current = roundGrade(row.average);
        else bucket.previous = roundGrade(row.average);
        byClassroom.set(row.classroomId, bucket);
      }

      return {
        classroomAverages: [...byClassroom.entries()].map(([classroomId, bucket]) => ({
          classroomId,
          classroomName: bucket.name,
          average: bucket.current,
          previousAverage: bucket.previous,
          belowPassing: bucket.current !== null && bucket.current < PASSING_AVERAGE,
        })),
        pendingGrades: missing.find((row) => row.teacherId === teacherId)?.missing ?? 0,
        needsAttention: riskFromAttendance(attendanceRows),
      };
    },

    /** Painel do aluno: desempenho contra a turma, sem nome de colega. */
    async aluno(input: { studentId: string; classroomId: string | null; term: number }) {
      if (!input.classroomId) {
        return { subjects: [], attendance: null };
      }

      const [classAverages, attendanceRows] = await Promise.all([
        overview.classroomSubjectAverages(input.classroomId, input.term),
        overview.attendanceByStudentInClassrooms([input.classroomId]),
      ]);

      const mine = attendanceRows.find((row) => row.studentId === input.studentId);

      return {
        subjects: classAverages.map((row) => ({
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          classAverage: roundGrade(row.average),
        })),
        attendance: mine
          ? {
              rate: attendanceRate(mine),
              belowMinimum: isBelowMinimumAttendance(mine),
              absences: mine.absentCount,
            }
          : null,
      };
    },
  };
}

export type OverviewService = ReturnType<typeof createOverviewService>;
