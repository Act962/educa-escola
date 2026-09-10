import { describe, expect, it } from "vitest";

import { ValidationError } from "../../errors";
import type { StudentRepository } from "../student/repository";
import type { AssessmentRepository, GradeEntry } from "./repository";
import {
  createAssessmentService,
  PASSING_AVERAGE,
  roundGrade,
  situationOf,
  weightedAverage,
} from "./service";

type Assessment = Awaited<ReturnType<AssessmentRepository["listByClassroom"]>>[number];

const AVALIACOES: Assessment[] = [
  {
    id: "prova-1",
    name: "Prova 1",
    weight: 4,
    term: 3,
    appliedOn: "2026-08-13",
    status: "publicada",
    publishedAt: new Date(),
    classroomId: "turma-1",
    classroomName: "8º A",
    subjectId: "disc-1",
    subjectName: "Matemática",
    teacherId: "prof-1",
  },
  {
    id: "prova-2",
    name: "Prova 2",
    weight: 3,
    term: 3,
    appliedOn: "2026-09-06",
    status: "rascunho",
    publishedAt: null,
    classroomId: "turma-1",
    classroomName: "8º A",
    subjectId: "disc-1",
    subjectName: "Matemática",
    teacherId: "prof-1",
  },
];

function repositories(options: { grades: GradeEntry[]; missing?: number }) {
  const guardado: GradeEntry[] = [...options.grades];
  const publicadas: string[] = [];

  const assessments = {
    listByClassroom: async () => AVALIACOES,
    findById: async () => AVALIACOES[1] as Assessment,
    listGrades: async () =>
      guardado
        .filter((entry) => entry.score !== null)
        .map((entry) => ({
          assessmentId: "prova-1",
          studentId: entry.studentId,
          score: entry.score as number,
        })),
    listPublishedForStudent: async () => [],
    publishedAveragesByClassroom: async () => [],
    countMissingGradesByTeacher: async () => [],
    countMissingGradesFor: async () => options.missing ?? 0,
    saveGrades: async (_id: string, entries: GradeEntry[]) => {
      guardado.push(...entries);
    },
    publish: async (id: string) => {
      publicadas.push(id);
      return { id, status: "publicada" as const };
    },
    create: async () => ({}) as never,
  } satisfies AssessmentRepository;

  const students = {
    list: async () => [],
    countMatching: async () => 0,
    findById: async () => null,
    findByRegistration: async () => null,
    findByUserId: async () => null,
    listByClassroom: async () => [
      {
        id: "a1",
        name: "Ana Clara",
        registration: "0301",
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
      },
      {
        id: "a2",
        name: "Caio",
        registration: "0309",
        presentCount: 0,
        lateCount: 0,
        absentCount: 0,
      },
    ],
    create: async () => ({}) as never,
  } satisfies StudentRepository;

  return { assessments, students, publicadas };
}

describe("média do bimestre", () => {
  it("pondera pelo peso da avaliação", () => {
    expect(
      weightedAverage([
        { score: 8.5, weight: 4 },
        { score: 9, weight: 3 },
        { score: 7.5, weight: 3 },
      ]),
    ).toBe(8.4);
  });

  /**
   * Avaliação sem lançamento **não vale zero**: o aluno reprovaria enquanto o
   * professor ainda está digitando. Quem cobra o lançamento é a Gestão.
   */
  it("ignora avaliação sem nota em vez de contar zero", () => {
    expect(weightedAverage([{ score: 8, weight: 4 }])).toBe(8);
    expect(weightedAverage([])).toBeNull();
  });

  it("arredonda para uma casa, do lado certo do meio", () => {
    expect(roundGrade(7.25)).toBe(7.3);
    expect(roundGrade(4.649)).toBe(4.6);
  });

  it("classifica pela média, com faixa de recuperação", () => {
    expect(situationOf(7)).toBe("aprovado");
    expect(situationOf(PASSING_AVERAGE)).toBe("aprovado");
    expect(situationOf(4.6)).toBe("recuperacao");
    expect(situationOf(3.9)).toBe("reprovado");
    expect(situationOf(null)).toBe("sem_nota");
  });
});

describe("grade de lançamento", () => {
  /**
   * Com nota faltando não há veredito. Dizer "Recuperação" sobre média parcial
   * é uma afirmação que os dados ainda não sustentam — e que o aluno leria
   * como definitiva.
   */
  it("segura a situação enquanto houver lançamento pendente", async () => {
    const { assessments, students } = repositories({
      grades: [{ studentId: "a1", score: 5 }],
    });
    const service = createAssessmentService(assessments, students);

    const grade = await service.grid("turma-1", "disc-1", 3);

    const [ana, caio] = grade.rows;
    expect(ana?.average).toBe(5);
    expect(ana?.situation).toBe("sem_nota");
    expect(caio?.average).toBeNull();
    expect(grade.pendingCount).toBe(3);
  });

  it("recusa nota fora do intervalo de 0 a 10", async () => {
    const { assessments, students } = repositories({ grades: [] });
    const service = createAssessmentService(assessments, students);

    await expect(
      service.saveGrades({ assessmentId: "prova-2", entries: [{ studentId: "a1", score: 11 }] }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("recusa lançamento para aluno de outra turma", async () => {
    const { assessments, students } = repositories({ grades: [] });
    const service = createAssessmentService(assessments, students);

    await expect(
      service.saveGrades({
        assessmentId: "prova-2",
        entries: [{ studentId: "de-outra-turma", score: 8 }],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("publicação", () => {
  /**
   * Publicar é o que torna a nota visível ao aluno. Com aluno sem lançamento,
   * o boletim nasceria com um buraco que ninguém consegue explicar depois.
   */
  it("não publica com aluno sem nota", async () => {
    const { assessments, students, publicadas } = repositories({ grades: [], missing: 2 });
    const service = createAssessmentService(assessments, students);

    await expect(service.publish("prova-2", new Date())).rejects.toBeInstanceOf(ValidationError);
    expect(publicadas).toEqual([]);
  });

  it("publica quando a turma inteira está lançada", async () => {
    const { assessments, students, publicadas } = repositories({ grades: [], missing: 0 });
    const service = createAssessmentService(assessments, students);

    await expect(service.publish("prova-2", new Date())).resolves.toMatchObject({
      status: "publicada",
    });
    expect(publicadas).toEqual(["prova-2"]);
  });
});
