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
