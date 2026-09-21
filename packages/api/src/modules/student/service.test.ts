import { describe, expect, it } from "vitest";

import { ConflictError } from "../../errors";
import type { CreateStudentData, StudentFilters, StudentRepository } from "./repository";
import {
  attendanceRate,
  createStudentService,
  isBelowMinimumAttendance,
  MINIMUM_ATTENDANCE_RATE,
  normalizeRegistration,
} from "./service";

type Row = Awaited<ReturnType<StudentRepository["list"]>>[number];

const aluno = (over: Partial<Row> = {}): Row => ({
  id: crypto.randomUUID(),
  name: "Aluno Teste",
  registration: "2026-0001",
  shift: "manha",
  status: "ativo",
  guardianName: null,
  classroomId: null,
  classroomName: null,
  presentCount: 10,
  lateCount: 0,
  absentCount: 0,
  ...over,
});

/**
 * Repositório em memória, tipado como o real (sem cast): se a interface mudar,
 * este duplo para de compilar em vez de mentir.
 */
function fakeRepository(seed: Row[] = []): StudentRepository {
  const rows = [...seed];

  return {
    list: async (filters: StudentFilters) =>
      rows.slice(filters.offset, filters.offset + filters.limit),
    presenceByStudent: async () =>
      rows.map((row) => ({
        studentId: row.id,
        studentName: row.name,
        registration: row.registration,
        shift: row.shift,
        classroomId: row.classroomId ?? null,
        classroomName: row.classroomName ?? null,
        academicYear: 2026,
        presentCount: row.presentCount,
        lateCount: row.lateCount,
        absentCount: row.absentCount,
      })),
    countMatching: async () => rows.length,
    findById: async () => null,
    findByRegistration: async (value) => {
      const found = rows.find((row) => row.registration === value);
      return found ? ({ registration: found.registration } as never) : null;
    },
    findByUserId: async () => null,
    listByClassroom: async () =>
      rows.map(({ id, name, registration, ...counts }) => ({
        id,
        name,
        registration,
        presentCount: counts.presentCount,
        lateCount: counts.lateCount,
        absentCount: counts.absentCount,
      })),
    create: async (data: CreateStudentData) => ({ ...data, id: "novo" }) as never,
  };
}

describe("frequência do aluno", () => {
  it("conta atraso como presença", () => {
    expect(attendanceRate({ presentCount: 8, lateCount: 2, absentCount: 0 })).toBe(1);
  });

  /**
   * Sem aula registrada não existe frequência. Devolver 0 faria a tela acusar
   * de faltoso quem só ainda não teve aula — inclusive o aluno recém-matriculado.
   */
  it("devolve null quando não há aula registrada, não zero", () => {
    expect(attendanceRate({ presentCount: 0, lateCount: 0, absentCount: 0 })).toBeNull();
    expect(isBelowMinimumAttendance({ presentCount: 0, lateCount: 0, absentCount: 0 })).toBe(false);
  });

  it("marca alerta abaixo do mínimo legal e não exatamente nele", () => {
    // 75% em ponto está dentro da lei: o corte é estritamente menor.
    expect(isBelowMinimumAttendance({ presentCount: 3, lateCount: 0, absentCount: 1 })).toBe(false);
    expect(isBelowMinimumAttendance({ presentCount: 2, lateCount: 0, absentCount: 1 })).toBe(true);
    expect(MINIMUM_ATTENDANCE_RATE).toBe(0.75);
  });
});

describe("matrícula", () => {
  it("normaliza espaço e caixa", () => {
    expect(normalizeRegistration("  2026 - 0301 ")).toBe("2026-0301");
    expect(normalizeRegistration("a1b2")).toBe("A1B2");
  });

  it("recusa matrícula repetida na mesma escola", async () => {
    const service = createStudentService(fakeRepository([aluno({ registration: "2026-0301" })]));

    await expect(
      service.create({
        name: "Outro Aluno",
        registration: " 2026-0301 ",
        shift: "manha",
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("listagem", () => {
  it("decora cada linha com a frequência derivada", async () => {
    const service = createStudentService(
      fakeRepository([aluno({ presentCount: 6, lateCount: 1, absentCount: 3 })]),
    );

    const { items } = await service.list({ limit: 10, offset: 0 });

    expect(items[0]?.attendanceRate).toBeCloseTo(0.7);
    expect(items[0]?.belowMinimumAttendance).toBe(true);
  });

  /**
   * "Em risco" é regra de negócio, não coluna: o filtro acontece depois de
   * calcular, e o total continua sendo o do recorte que o banco conhece.
   */
  it("filtra em risco sobre o resultado já calculado", async () => {
    const service = createStudentService(
      fakeRepository([
        aluno({ name: "Regular", presentCount: 10, lateCount: 0, absentCount: 0 }),
        aluno({ name: "Em risco", presentCount: 5, lateCount: 0, absentCount: 5 }),
      ]),
    );

    const { items, total } = await service.list({ limit: 10, offset: 0, atRisk: true });

    expect(items.map((item) => item.name)).toEqual(["Em risco"]);
    expect(total).toBe(2);
  });
});

describe("attendanceOverview", () => {
  it("agrupa por turma e usa o mesmo limiar do resto do sistema", async () => {
    const service = createStudentService(
      fakeRepository([
        aluno({ id: "a", name: "Ana", classroomId: "t1", classroomName: "6º A", presentCount: 10 }),
        aluno({
          id: "b",
          name: "Beto",
          classroomId: "t1",
          classroomName: "6º A",
          presentCount: 9,
          absentCount: 1,
        }),
        // 6 de 10 = 60%, abaixo dos 75%.
        aluno({
          id: "c",
          name: "Caio",
          classroomId: "t2",
          classroomName: "7º C",
          presentCount: 6,
          absentCount: 4,
        }),
      ]),
    );

    const panorama = await service.attendanceOverview();

    expect(panorama.minimumRate).toBe(MINIMUM_ATTENDANCE_RATE);
    expect(panorama.students).toBe(3);
    expect(panorama.belowMinimum).toBe(1);
    expect(panorama.below.map((aluno) => aluno.studentName)).toEqual(["Caio"]);

    const seisA = panorama.classrooms.find((turma) => turma.classroomName === "6º A");
    expect(seisA?.rate).toBeCloseTo(19 / 20);
    expect(seisA?.belowMinimum).toBe(0);
  });

  /** Atraso conta como presença — a mesma regra da chamada, não outra. */
  it("atraso não derruba a turma", async () => {
    const service = createStudentService(
      fakeRepository([
        aluno({ id: "a", classroomId: "t1", classroomName: "6º A", presentCount: 5, lateCount: 5 }),
      ]),
    );

    const panorama = await service.attendanceOverview();
    expect(panorama.rate).toBe(1);
    expect(panorama.belowMinimum).toBe(0);
  });

  /**
   * Turma sem aula registrada tem taxa nula, não 0%. Acusar 0% de quem ainda
   * não teve aula é mentir com número.
   */
  it("sem aula registrada devolve taxa nula", async () => {
    const service = createStudentService(
      fakeRepository([
        aluno({ id: "a", classroomId: "t1", classroomName: "6º A", presentCount: 0 }),
      ]),
    );

    const panorama = await service.attendanceOverview();
    expect(panorama.rate).toBeNull();
    expect(panorama.classrooms[0]?.rate).toBeNull();
    expect(panorama.belowMinimum).toBe(0);
  });

  it("ordena as turmas da pior para a melhor", async () => {
    const service = createStudentService(
      fakeRepository([
        aluno({ id: "a", classroomId: "t1", classroomName: "6º A", presentCount: 10 }),
        aluno({
          id: "b",
          classroomId: "t2",
          classroomName: "7º C",
          presentCount: 5,
          absentCount: 5,
        }),
        aluno({
          id: "c",
          classroomId: "t3",
          classroomName: "8º B",
          presentCount: 8,
          absentCount: 2,
        }),
      ]),
    );

    const panorama = await service.attendanceOverview();
    expect(panorama.classrooms.map((turma) => turma.classroomName)).toEqual([
      "7º C",
      "8º B",
      "6º A",
    ]);
  });
});
