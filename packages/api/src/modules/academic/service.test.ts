import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { AcademicRepository } from "./repository";
import { createAcademicService, normalizeSubjectName } from "./service";

type Disciplina = Awaited<ReturnType<AcademicRepository["listSubjects"]>>[number];
type NaGrade = Awaited<ReturnType<AcademicRepository["listCurriculum"]>>[number];

interface Estado {
  disciplinas?: Partial<Disciplina>[];
  grade?: Partial<NaGrade>[];
  series?: { stage: string | null; gradeLevel: number | null; turmas: number }[];
  aulasPorDisciplina?: Record<string, number>;
}

/** Dublê tipado como o repositório real, sem cast. */
function fakeRepository(estado: Estado = {}): AcademicRepository {
  const disciplinas = (estado.disciplinas ?? []) as Disciplina[];

  return {
    listSubjects: async () => disciplinas,
    findSubjectByName: async (name) => disciplinas.find((d) => d.name === name) ?? null,
    findSubject: async (id) => disciplinas.find((d) => d.id === id) ?? null,
    createSubject: async (data) => ({ ...data, id: "nova", schoolId: "e1" }) as Disciplina,
    updateSubject: async (id, data) => {
      const atual = disciplinas.find((d) => d.id === id);
      return atual ? ({ ...atual, ...data } as Disciplina) : null;
    },
    removeSubject: async (id) => (disciplinas.some((d) => d.id === id) ? { id } : null),
    lessonCountBySubject: async (id) => estado.aulasPorDisciplina?.[id] ?? 0,
    listCurriculum: async () => (estado.grade ?? []) as NaGrade[],
    setCurriculum: async (data) => ({ ...data, id: "linha" }) as never,
    removeFromCurriculum: async (id) =>
      (estado.grade ?? []).some((l) => l.id === id) ? { id } : null,
    seriesEmUso: async () => (estado.series ?? []) as never,
  };
}

describe("normalizeSubjectName", () => {
  it("colapsa espaço, para não criar duas vezes a mesma disciplina", () => {
    expect(normalizeSubjectName("  Educação   Física ")).toBe("Educação Física");
  });
});

describe("createSubject", () => {
  const entrada = {
    name: "Matemática",
    kind: "obrigatoria" as const,
    composesAverage: true,
    tracksAttendance: true,
  };

  it("recusa nome repetido", async () => {
    const servico = createAcademicService(
      fakeRepository({ disciplinas: [{ id: "s1", name: "Matemática" }] }),
    );
    await expect(servico.createSubject(entrada)).rejects.toThrow(ConflictError);
  });

  it("compara o nome já normalizado", async () => {
    const servico = createAcademicService(
      fakeRepository({ disciplinas: [{ id: "s1", name: "Educação Física" }] }),
    );
    await expect(
      servico.createSubject({ ...entrada, name: "  Educação   Física  " }),
    ).rejects.toThrow(ConflictError);
  });
});

describe("removeSubject", () => {
  /**
   * A exclusão cascateia para `lesson`, e com ela vão chamada e diário. É
   * histórico de aula que aconteceu — ninguém pode apagar isso limpando um
   * catálogo.
   */
  it("recusa apagar disciplina com aula dada, e diz o que fazer", async () => {
    const servico = createAcademicService(
      fakeRepository({
        disciplinas: [{ id: "s1", name: "Matemática" }],
        aulasPorDisciplina: { s1: 42 },
      }),
    );

    await expect(servico.removeSubject("s1")).rejects.toThrow(ValidationError);
    await expect(servico.removeSubject("s1")).rejects.toThrow(/42 aulas registradas/);
    await expect(servico.removeSubject("s1")).rejects.toThrow(/grade curricular/);
  });

  it("apaga disciplina que nunca teve aula", async () => {
    const servico = createAcademicService(
      fakeRepository({ disciplinas: [{ id: "s1", name: "Xadrez" }] }),
    );
    await expect(servico.removeSubject("s1")).resolves.toEqual({ id: "s1" });
  });

  it("recusa disciplina de outra escola", async () => {
    await expect(createAcademicService(fakeRepository()).removeSubject("s9")).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe("curriculum", () => {
  const estado: Estado = {
    series: [
      { stage: "fundamental_ii", gradeLevel: 6, turmas: 3 },
      { stage: "fundamental_ii", gradeLevel: 7, turmas: 2 },
    ],
    grade: [
      {
        id: "c1",
        stage: "fundamental_ii",
        gradeLevel: 6,
        subjectId: "s1",
        subjectName: "Matemática",
        subjectCode: "MAT",
        subjectKind: "obrigatoria",
        weeklyHours: 5,
        annualHours: 200,
      },
      {
        id: "c2",
        stage: "fundamental_ii",
        gradeLevel: 6,
        subjectId: "s2",
        subjectName: "História",
        subjectCode: null,
        subjectKind: "obrigatoria",
        weeklyHours: 3,
        annualHours: null,
      },
    ],
  };

  it("soma as aulas semanais da série", async () => {
    const [sexto] = await createAcademicService(fakeRepository(estado)).curriculum({
      academicYear: 2026,
    });

    expect(sexto?.gradeLevel).toBe(6);
    expect(sexto?.disciplinas).toHaveLength(2);
    expect(sexto?.aulasPorSemana).toBe(8);
  });

  /**
   * Série sem disciplina é justamente a que a secretaria precisa ver para
   * montar. Sumir com ela esconderia o trabalho que falta.
   */
  it("mantém a série vazia na lista, com zero aulas", async () => {
    const grade = await createAcademicService(fakeRepository(estado)).curriculum({
      academicYear: 2026,
    });

    const setimo = grade.find((s) => s.gradeLevel === 7);
    expect(setimo).toBeDefined();
    expect(setimo?.disciplinas).toEqual([]);
    expect(setimo?.aulasPorSemana).toBe(0);
  });

  it("não mistura a grade de séries diferentes", async () => {
    const grade = await createAcademicService(fakeRepository(estado)).curriculum({
      academicYear: 2026,
    });
    expect(grade.find((s) => s.gradeLevel === 7)?.disciplinas).toHaveLength(0);
  });

  it("filtra por segmento", async () => {
    const grade = await createAcademicService(
      fakeRepository({
        ...estado,
        series: [...(estado.series ?? []), { stage: "medio", gradeLevel: 1, turmas: 1 }],
      }),
    ).curriculum({ academicYear: 2026, stage: "medio" });

    expect(grade.map((s) => s.gradeLevel)).toEqual([1]);
  });
});

describe("setCurriculum", () => {
  const base = { academicYear: 2026, subjectId: "s1", weeklyHours: 4 };

  /** "9º ano do médio" não existe: a série sozinha é ambígua. */
  it("recusa série que não existe no segmento", async () => {
    const servico = createAcademicService(
      fakeRepository({ disciplinas: [{ id: "s1", name: "Matemática" }] }),
    );

    await expect(servico.setCurriculum({ ...base, stage: "medio", gradeLevel: 9 })).rejects.toThrow(
      ValidationError,
    );

    await expect(
      servico.setCurriculum({ ...base, stage: "fundamental_ii", gradeLevel: 9 }),
    ).resolves.toBeDefined();
  });

  it("recusa disciplina que não existe nesta escola", async () => {
    await expect(
      createAcademicService(fakeRepository()).setCurriculum({
        ...base,
        stage: "fundamental_ii",
        gradeLevel: 6,
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
