import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../errors";
import type { TeacherRepository } from "./repository";
import {
  createTeacherService,
  groupByClassroom,
  PENDING_FOR_OVERDUE,
  rate,
  situationOf,
} from "./service";

const AGORA = new Date("2026-09-22T12:00:00Z");

interface Estado {
  teachers?: { userId: string; name: string; email: string; desde: Date }[];
  carga?: {
    teacherId: string;
    classrooms: number;
    subjects: number;
    lessons: number;
    registradas: number;
  }[];
  chamadas?: { teacherId: string; pending: number }[];
  grades?: { teacherId: string; faltando: number }[];
  alocacoes?: {
    classroomId: string;
    classroomName: string;
    subjectId: string;
    subjectName: string;
  }[];
}

/** Dublê tipado como o repositório real: muda a interface, para de compilar. */
function fakeRepository(estado: Estado = {}): TeacherRepository {
  const teachers = estado.teachers ?? [];
  return {
    list: async (search) =>
      search
        ? teachers.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        : teachers,
    loadByTeacher: async () => estado.carga ?? [],
    pendingCallsByTeacher: async () => estado.chamadas ?? [],
    pendingGradesByTeacher: async () => estado.grades ?? [],
    assignmentsOf: async () => estado.alocacoes ?? [],
    reachOf: async () => 0,
    findMember: async (userId) => teachers.find((d) => d.userId === userId) ?? null,
    attendanceOf: async () => ({ registros: 0, comparecimentos: 0 }),
  };
}

const teacher = (userId: string, name: string) => ({
  userId,
  name,
  email: `${userId}@escola.br`,
  desde: AGORA,
});

describe("situacaoDe", () => {
  /**
   * Docente sem aula no ano não está atrasado — está sem alocação. Dizer "em
   * dia" para ele esconderia o problema real, que é a grade não ter sido
   * montada.
   */
  it("sem aula é sem turma, não em dia", () => {
    expect(situationOf({ lessons: 0, pendingAttendance: 0, pendingGrades: 0 })).toBe("sem_turma");
  });

  it("sem pendência é em dia", () => {
    expect(situationOf({ lessons: 10, pendingAttendance: 0, pendingGrades: 0 })).toBe("em_dia");
  });

  it("soma chamada e nota para decidir a gravidade", () => {
    const quase = PENDING_FOR_OVERDUE - 1;
    expect(situationOf({ lessons: 10, pendingAttendance: quase, pendingGrades: 0 })).toBe(
      "atencao",
    );
    expect(
      situationOf({ lessons: 10, pendingAttendance: 1, pendingGrades: PENDING_FOR_OVERDUE - 1 }),
    ).toBe("atrasado");
  });
});

describe("taxa", () => {
  /** Sem registro a frequência é indefinida, não 0% — como no boletim. */
  it("é nula sem registro, e não zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(9, 10)).toBe(0.9);
  });
});

describe("agruparPorTurma", () => {
  it("junta as disciplinas de cada turma, sem repetir", () => {
    const classrooms = groupByClassroom([
      { classroomId: "t1", classroomName: "8º A", subjectName: "Matemática" },
      { classroomId: "t1", classroomName: "8º A", subjectName: "Física" },
      { classroomId: "t1", classroomName: "8º A", subjectName: "Matemática" },
      { classroomId: "t2", classroomName: "9º B", subjectName: "Matemática" },
    ]);

    expect(classrooms).toEqual([
      { classroomId: "t1", name: "8º A", subjects: ["Matemática", "Física"] },
      { classroomId: "t2", name: "9º B", subjects: ["Matemática"] },
    ]);
  });
});

describe("list", () => {
  const estado: Estado = {
    teachers: [teacher("p1", "Ana Lima"), teacher("p2", "Bruno Sá"), teacher("p3", "Caio Reis")],
    carga: [
      { teacherId: "p1", classrooms: 2, subjects: 1, lessons: 40, registradas: 40 },
      { teacherId: "p2", classrooms: 1, subjects: 2, lessons: 20, registradas: 15 },
    ],
    chamadas: [{ teacherId: "p2", pending: 5 }],
    grades: [{ teacherId: "p2", faltando: 3 }],
  };

  it("mostra quem não tem aula como sem turma, e não some com ele", async () => {
    const { items } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026 },
      AGORA,
    );

    expect(items.map((i) => [i.name, i.situation])).toEqual([
      ["Ana Lima", "em_dia"],
      ["Bruno Sá", "atrasado"],
      ["Caio Reis", "sem_turma"],
    ]);
  });

  /**
   * Ordem alfabética, não por pendência: é cadastro de pessoas. Uma lista que
   * se reordena conforme alguém atrasa vira ranking de docentes por acidente,
   * que é o que a §10.6 do requisito não quer.
   */
  it("ordena por nome, nunca por pendência", async () => {
    const { items } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026 },
      AGORA,
    );
    expect(items.map((i) => i.name)).toEqual(["Ana Lima", "Bruno Sá", "Caio Reis"]);
  });

  it("filtra só quem tem pendência, sem mexer no total", async () => {
    const { items, total, summary } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026, withPending: true },
      AGORA,
    );

    expect(items.map((i) => i.name)).toEqual(["Bruno Sá"]);
    // O total continua sendo o corpo docente inteiro: dizer "1 professor"
    // depois de filtrar faria a direção achar que perdeu gente do cadastro.
    expect(total).toBe(3);
    expect(summary).toEqual({
      total: 3,
      withoutClassroom: 1,
      withPending: 1,
      pendingAttendance: 5,
    });
  });

  it("busca por nome", async () => {
    const { items } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026, search: "bruno" },
      AGORA,
    );
    expect(items.map((i) => i.name)).toEqual(["Bruno Sá"]);
  });

  it("escola sem docente não quebra", async () => {
    const { items, summary } = await createTeacherService(fakeRepository()).list(
      { academicYear: 2026 },
      AGORA,
    );
    expect(items).toEqual([]);
    expect(summary.total).toBe(0);
  });
});

describe("byId", () => {
  it("recusa quem não é docente desta escola", async () => {
    await expect(
      createTeacherService(fakeRepository()).byId("de-outra-escola", 2026, AGORA),
    ).rejects.toThrow(NotFoundError);
  });

  it("monta a ficha com turmas agrupadas e pendências", async () => {
    const servico = createTeacherService(
      fakeRepository({
        teachers: [teacher("p1", "Ana Lima")],
        carga: [{ teacherId: "p1", classrooms: 1, subjects: 2, lessons: 30, registradas: 28 }],
        chamadas: [{ teacherId: "p1", pending: 2 }],
        alocacoes: [
          { classroomId: "t1", classroomName: "8º A", subjectId: "s1", subjectName: "Matemática" },
          { classroomId: "t1", classroomName: "8º A", subjectId: "s2", subjectName: "Física" },
        ],
      }),
    );

    const ficha = await servico.byId("p1", 2026, AGORA);

    expect(ficha.name).toBe("Ana Lima");
    expect(ficha.pendingAttendance).toBe(2);
    expect(ficha.situation).toBe("atencao");
    expect(ficha.classrooms).toEqual([
      { classroomId: "t1", name: "8º A", subjects: ["Matemática", "Física"] },
    ]);
    expect(ficha.classroomAttendance).toBeNull();
  });
});
