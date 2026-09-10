import { NotFoundError, ValidationError } from "../../errors";
import type { StudentRepository } from "../student/repository";
import type { AssessmentRepository, CreateAssessmentData, GradeEntry } from "./repository";

/** Média para aprovação direta. */
export const PASSING_AVERAGE = 6;
/** Abaixo disso não há recuperação: é reprovação por nota. */
export const RECOVERY_FLOOR = 4;

export type Situation = "aprovado" | "recuperacao" | "reprovado" | "sem_nota";

export interface WeightedScore {
  score: number;
  weight: number;
}

/**
 * Arredonda para uma casa, que é como a nota é publicada e impressa.
 *
 * O `EPSILON` cobre o caso em que a divisão cai logo abaixo do meio por erro
 * binário (7.25 virando 7.249999…), que arredondaria para baixo sem motivo.
 */
export function roundGrade(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Média ponderada do período.
 *
 * Só entra na conta o que tem nota: avaliação sem lançamento não vale zero,
 * senão o aluno "reprovaria" enquanto o professor ainda está digitando. Quem
 * cobra o lançamento pendente é a Gestão, não a média.
 */
export function weightedAverage(entries: WeightedScore[]): number | null {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (entries.length === 0 || totalWeight === 0) return null;

  const weighted = entries.reduce((sum, entry) => sum + entry.score * entry.weight, 0);
  return roundGrade(weighted / totalWeight);
}

export function situationOf(average: number | null): Situation {
  if (average === null) return "sem_nota";
  if (average >= PASSING_AVERAGE) return "aprovado";
  if (average >= RECOVERY_FLOOR) return "recuperacao";
  return "reprovado";
}

export interface SaveGradesInput {
  assessmentId: string;
  entries: GradeEntry[];
}

export function createAssessmentService(repo: AssessmentRepository, students: StudentRepository) {
  async function getOrThrow(id: string) {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError("Avaliação não encontrada");
    return found;
  }

  function assertValidScore(entry: GradeEntry) {
    if (entry.score === null) return;
    if (Number.isNaN(entry.score) || entry.score < 0 || entry.score > 10) {
      throw new ValidationError("Nota fora do intervalo permitido (0 a 10)");
    }
  }

  return {
    /**
     * A grade de lançamento: alunos nas linhas, avaliações nas colunas.
     *
     * A média parcial e a situação saem daqui já calculadas — a tela não
     * recalcula nota, senão a regra passa a ter duas implementações.
     */
    async grid(classroomId: string, subjectId: string, term: number) {
      const [assessments, roster] = await Promise.all([
        repo.listByClassroom(classroomId, subjectId, term),
        students.listByClassroom(classroomId),
      ]);

      const grades = await repo.listGrades(assessments.map((item) => item.id));
      const byStudent = new Map<string, Map<string, number>>();
      for (const row of grades) {
        const scores = byStudent.get(row.studentId) ?? new Map<string, number>();
        scores.set(row.assessmentId, row.score);
        byStudent.set(row.studentId, scores);
      }

      const rows = roster.map((student) => {
        const scores = byStudent.get(student.id) ?? new Map<string, number>();
        const graded = assessments
          .map((item) => {
            const score = scores.get(item.id);
            return score === undefined ? null : { score, weight: item.weight };
          })
          .filter((entry): entry is WeightedScore => entry !== null);

        const average = weightedAverage(graded);

        const missing = assessments.length - graded.length;

        return {
          studentId: student.id,
          name: student.name,
          registration: student.registration,
          scores: assessments.map((item) => scores.get(item.id) ?? null),
          missing,
          average,
          // Com lançamento faltando não há veredito: "Recuperação" sobre nota
          // parcial é uma afirmação que os dados ainda não sustentam. A média
          // continua visível — o que fica pendente é a conclusão.
          situation: missing > 0 ? ("sem_nota" as Situation) : situationOf(average),
        };
      });

      const withAverage = rows.filter((row) => row.average !== null);

      return {
        assessments,
        rows,
        pendingCount: rows.reduce((sum, row) => sum + row.missing, 0),
        classAverage:
          withAverage.length === 0
            ? null
            : roundGrade(
                withAverage.reduce((sum, row) => sum + (row.average ?? 0), 0) / withAverage.length,
              ),
      };
    },

    /** Boletim do aluno, agrupado por disciplina. Só o publicado chega aqui. */
    async reportCard(studentId: string, term: number) {
      const rows = await repo.listPublishedForStudent(studentId, term);

      const bySubject = new Map<string, { subjectName: string; entries: typeof rows }>();
      for (const row of rows) {
        const bucket = bySubject.get(row.subjectId) ?? {
          subjectName: row.subjectName,
          entries: [],
        };
        bucket.entries.push(row);
        bySubject.set(row.subjectId, bucket);
      }

      const subjects = [...bySubject.entries()].map(([subjectId, bucket]) => {
        const average = weightedAverage(bucket.entries);
        return {
          subjectId,
          subjectName: bucket.subjectName,
          average,
          situation: situationOf(average),
          // A conta aberta, avaliação por avaliação: "como sua média foi
          // calculada" é requisito do aluno, não enfeite da tela.
          entries: bucket.entries.map((entry) => ({
            assessmentId: entry.assessmentId,
            name: entry.assessmentName,
            weight: entry.weight,
            appliedOn: entry.appliedOn,
            score: entry.score,
          })),
        };
      });

      const overall = weightedAverage(
        subjects
          .filter((item) => item.average !== null)
          .map((item) => ({ score: item.average as number, weight: 1 })),
      );

      return { subjects, overall, latest: rows.slice(0, 3) };
    },

    async saveGrades(input: SaveGradesInput) {
      const assessment = await getOrThrow(input.assessmentId);

      for (const entry of input.entries) assertValidScore(entry);

      const roster = await students.listByClassroom(assessment.classroomId);
      const rosterIds = new Set(roster.map((student) => student.id));
      if (input.entries.some((entry) => !rosterIds.has(entry.studentId))) {
        throw new ValidationError("O lançamento inclui aluno que não está nesta turma");
      }

      await repo.saveGrades(input.assessmentId, input.entries);
      return { assessmentId: input.assessmentId, saved: input.entries.length };
    },

    /**
     * Publicar é o ato que torna a nota visível ao aluno — e irreversível na
     * prática. Não publicamos com aluno sem nota: o boletim ficaria com um
     * buraco que ninguém consegue explicar depois.
     */
    async publish(id: string, at: Date) {
      const assessment = await getOrThrow(id);

      const missing = await repo.countMissingGradesFor(id, assessment.classroomId);
      if (missing > 0) {
        throw new ValidationError(
          `${missing} aluno(s) ainda sem nota em ${assessment.name}. Lance todas antes de publicar.`,
        );
      }

      const published = await repo.publish(id, at);
      if (!published) throw new NotFoundError("Avaliação não encontrada");
      return published;
    },

    async create(input: CreateAssessmentData) {
      if (input.weight < 1) throw new ValidationError("O peso da avaliação começa em 1");
      return repo.create(input);
    },

    listOf: (classroomId: string, subjectId: string, term: number) =>
      repo.listByClassroom(classroomId, subjectId, term),
  };
}

export type AssessmentService = ReturnType<typeof createAssessmentService>;
