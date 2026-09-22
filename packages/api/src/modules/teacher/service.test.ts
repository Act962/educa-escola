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
  docentes?: { userId: string; name: string; email: string; desde: Date }[];
  carga?: {
    teacherId: string;
    turmas: number;
    disciplinas: number;
    aulas: number;
    registradas: number;
  }[];
  chamadas?: { teacherId: string; pendentes: number }[];
  notas?: { teacherId: string; faltando: number }[];
  alocacoes?: {
    classroomId: string;
    classroomName: string;
    subjectId: string;
    subjectName: string;
  }[];
}

/** Dublê tipado como o repositório real: muda a interface, para de compilar. */
function fakeRepository(estado: Estado = {}): TeacherRepository {
  const docentes = estado.docentes ?? [];
  return {
    list: async (search) =>
      search
        ? docentes.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
        : docentes,
    loadByTeacher: async () => estado.carga ?? [],
    pendingCallsByTeacher: async () => estado.chamadas ?? [],
    pendingGradesByTeacher: async () => estado.notas ?? [],
    assignmentsOf: async () => estado.alocacoes ?? [],
    reachOf: async () => 0,
    findMember: async (userId) => docentes.find((d) => d.userId === userId) ?? null,
    attendanceOf: async () => ({ registros: 0, comparecimentos: 0 }),
  };
}

const docente = (userId: string, name: string) => ({
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
    expect(situationOf({ aulas: 0, chamadasPendentes: 0, notasPendentes: 0 })).toBe("sem_turma");
  });

  it("sem pendência é em dia", () => {
    expect(situationOf({ aulas: 10, chamadasPendentes: 0, notasPendentes: 0 })).toBe("em_dia");
  });

  it("soma chamada e nota para decidir a gravidade", () => {
    const quase = PENDING_FOR_OVERDUE - 1;
    expect(situationOf({ aulas: 10, chamadasPendentes: quase, notasPendentes: 0 })).toBe("atencao");
    expect(
      situationOf({ aulas: 10, chamadasPendentes: 1, notasPendentes: PENDING_FOR_OVERDUE - 1 }),
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
    const turmas = groupByClassroom([
      { classroomId: "t1", classroomName: "8º A", subjectName: "Matemática" },
      { classroomId: "t1", classroomName: "8º A", subjectName: "Física" },
      { classroomId: "t1", classroomName: "8º A", subjectName: "Matemática" },
      { classroomId: "t2", classroomName: "9º B", subjectName: "Matemática" },
    ]);

    expect(turmas).toEqual([
      { classroomId: "t1", nome: "8º A", disciplinas: ["Matemática", "Física"] },
      { classroomId: "t2", nome: "9º B", disciplinas: ["Matemática"] },
    ]);
  });
});

describe("list", () => {
  const estado: Estado = {
    docentes: [docente("p1", "Ana Lima"), docente("p2", "Bruno Sá"), docente("p3", "Caio Reis")],
    carga: [
      { teacherId: "p1", turmas: 2, disciplinas: 1, aulas: 40, registradas: 40 },
      { teacherId: "p2", turmas: 1, disciplinas: 2, aulas: 20, registradas: 15 },
    ],
    chamadas: [{ teacherId: "p2", pendentes: 5 }],
    notas: [{ teacherId: "p2", faltando: 3 }],
  };

  it("mostra quem não tem aula como sem turma, e não some com ele", async () => {
    const { items } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026 },
      AGORA,
    );

    expect(items.map((i) => [i.name, i.situacao])).toEqual([
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
    const { items, total, resumo } = await createTeacherService(fakeRepository(estado)).list(
      { academicYear: 2026, comPendencia: true },
      AGORA,
    );

    expect(items.map((i) => i.name)).toEqual(["Bruno Sá"]);
    // O total continua sendo o corpo docente inteiro: dizer "1 professor"
    // depois de filtrar faria a direção achar que perdeu gente do cadastro.
    expect(total).toBe(3);
    expect(resumo).toEqual({
      total: 3,
      semTurma: 1,
      comPendencia: 1,
      chamadasPendentes: 5,
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
    const { items, resumo } = await createTeacherService(fakeRepository()).list(
      { academicYear: 2026 },
      AGORA,
    );
    expect(items).toEqual([]);
    expect(resumo.total).toBe(0);
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
        docentes: [docente("p1", "Ana Lima")],
        carga: [{ teacherId: "p1", turmas: 1, disciplinas: 2, aulas: 30, registradas: 28 }],
        chamadas: [{ teacherId: "p1", pendentes: 2 }],
        alocacoes: [
          { classroomId: "t1", classroomName: "8º A", subjectId: "s1", subjectName: "Matemática" },
          { classroomId: "t1", classroomName: "8º A", subjectId: "s2", subjectName: "Física" },
        ],
      }),
    );

    const ficha = await servico.byId("p1", 2026, AGORA);

    expect(ficha.name).toBe("Ana Lima");
    expect(ficha.chamadasPendentes).toBe(2);
    expect(ficha.situacao).toBe("atencao");
    expect(ficha.turmas).toEqual([
      { classroomId: "t1", nome: "8º A", disciplinas: ["Matemática", "Física"] },
    ]);
    expect(ficha.frequenciaDasTurmas).toBeNull();
  });
});
