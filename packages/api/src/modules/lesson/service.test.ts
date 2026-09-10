import { describe, expect, it } from "vitest";

import { ValidationError } from "../../errors";
import type { StudentRepository } from "../student/repository";
import type { AttendanceEntry, LessonRepository } from "./repository";
import {
  createLessonService,
  lessonState,
  requiresJustification,
  summarizeAttendance,
} from "./service";

const AULA = {
  id: "aula-1",
  date: "2026-09-09",
  startsAt: "08:20",
  endsAt: "09:10",
  room: "Sala 12",
  content: null,
  homework: null,
  attendanceRecordedAt: null as Date | null,
  classroomId: "turma-1",
  classroomName: "9º B",
  subjectId: "disc-1",
  subjectName: "Matemática",
  teacherId: "prof-1",
  teacherName: "Ricardo Alves",
};

/** 09/09/2026 às 08:40 em São Paulo — no meio da aula das 08:20. */
const DURANTE_A_AULA = new Date("2026-09-09T11:40:00Z");
const DEPOIS_DA_AULA = new Date("2026-09-09T13:00:00Z");
const DIA_SEGUINTE = new Date("2026-09-10T13:00:00Z");

function repositories(roster: { id: string; name: string }[]) {
  const gravado: { entries: AttendanceEntry[]; recordedAt: Date | null } = {
    entries: [],
    recordedAt: null,
  };

  const lessons = {
    listByTeacherAndDate: async () => [AULA],
    listByClassroomAndDate: async () => [AULA],
    listPendingForTeacher: async () => [],
    findById: async () => AULA,
    listAttendance: async () => gravado.entries,
    replaceAttendance: async (_id: string, entries: AttendanceEntry[], recordedAt: Date) => {
      gravado.entries = entries;
      gravado.recordedAt = recordedAt;
    },
    saveDiary: async () => ({ id: AULA.id }),
    countPendingByTeacher: async () => [],
    listTeacherClassrooms: async () => [],
    presenceTotals: async () => ({ present: 0, total: 0 }),
  } satisfies LessonRepository;

  const students = {
    list: async () => [],
    countMatching: async () => 0,
    findById: async () => null,
    findByRegistration: async () => null,
    findByUserId: async () => null,
    listByClassroom: async () =>
      roster.map((aluno) => ({
        id: aluno.id,
        name: aluno.name,
        registration: aluno.id,
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
      })),
    create: async () => ({}) as never,
  } satisfies StudentRepository;

  return { lessons, students, gravado };
}

describe("situação da aula", () => {
  it("chamada registrada vence o relógio", () => {
    expect(lessonState({ ...AULA, attendanceRecordedAt: new Date() }, DIA_SEGUINTE)).toBe(
      "registrada",
    );
  });

  it("aula que já terminou e não tem chamada está pendente", () => {
    expect(lessonState(AULA, DEPOIS_DA_AULA)).toBe("pendente");
    expect(lessonState(AULA, DIA_SEGUINTE)).toBe("pendente");
  });

  it("distingue a aula em curso da que ainda vem", () => {
    expect(lessonState(AULA, DURANTE_A_AULA)).toBe("em_andamento");
    expect(lessonState(AULA, new Date("2026-09-09T09:00:00Z"))).toBe("a_seguir");
  });
});

describe("resumo da chamada", () => {
  it("atraso entra na frequência mas é contado à parte", () => {
    const resumo = summarizeAttendance([
      { studentId: "a", status: "presente" },
      { studentId: "b", status: "atraso" },
      { studentId: "c", status: "falta" },
      { studentId: "d", status: "falta" },
    ]);

    expect(resumo).toEqual({ presentes: 1, faltas: 2, atrasos: 1, rate: 0.5 });
  });

  it("turma vazia não vira frequência zero", () => {
    expect(summarizeAttendance([]).rate).toBeNull();
  });
});

describe("registro da chamada", () => {
  const turma = [
    { id: "a1", name: "Alice" },
    { id: "a2", name: "Bruno" },
    { id: "a3", name: "Júlia" },
  ];

  /**
   * A regra que faz a chamada caber em 60 segundos: só as exceções sobem, e o
   * service completa a turma. Se isso quebrar, um aluno não marcado deixaria
   * de ter registro — e ausência de linha não é o mesmo que presença.
   */
  it("completa com presente quem não foi marcado", async () => {
    const { lessons, students, gravado } = repositories(turma);
    const service = createLessonService(lessons, students);

    await service.saveAttendance(
      { lessonId: "aula-1", entries: [{ studentId: "a3", status: "falta" }] },
      DURANTE_A_AULA,
    );

    expect(gravado.entries).toEqual([
      { studentId: "a1", status: "presente" },
      { studentId: "a2", status: "presente" },
      { studentId: "a3", status: "falta" },
    ]);
  });

  it("recusa aluno que não está na turma", async () => {
    const { lessons, students } = repositories(turma);
    const service = createLessonService(lessons, students);

    await expect(
      service.saveAttendance(
        { lessonId: "aula-1", entries: [{ studentId: "de-outra-turma", status: "falta" }] },
        DURANTE_A_AULA,
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * Depois do dia da aula, mexer na chamada é corrigir histórico — e correção
   * de histórico precisa de motivo registrado.
   */
  it("exige justificativa depois do prazo", async () => {
    const { lessons, students } = repositories(turma);
    const service = createLessonService(lessons, students);

    expect(requiresJustification(AULA.date, DIA_SEGUINTE)).toBe(true);

    await expect(
      service.saveAttendance({ lessonId: "aula-1", entries: [] }, DIA_SEGUINTE),
    ).rejects.toBeInstanceOf(ValidationError);

    await expect(
      service.saveAttendance(
        { lessonId: "aula-1", entries: [], justification: "Sistema fora do ar na sexta." },
        DIA_SEGUINTE,
      ),
    ).resolves.toMatchObject({ lessonId: "aula-1" });
  });

  it("no dia da aula não pede justificativa", async () => {
    const { lessons, students } = repositories(turma);
    const service = createLessonService(lessons, students);

    await expect(
      service.saveAttendance({ lessonId: "aula-1", entries: [] }, DEPOIS_DA_AULA),
    ).resolves.toMatchObject({ summary: { presentes: 3 } });
  });

  it("a folha abre com todo mundo presente", async () => {
    const { lessons, students } = repositories(turma);
    const service = createLessonService(lessons, students);

    const folha = await service.attendanceSheet("aula-1", DURANTE_A_AULA);

    expect(folha.entries.map((linha) => linha.status)).toEqual([
      "presente",
      "presente",
      "presente",
    ]);
    expect(folha.deadline).toBe("2026-09-09 23:59");
    expect(folha.requiresJustification).toBe(false);
  });
});
