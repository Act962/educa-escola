import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { AcademicRepository } from "./repository";
import {
  type CreateSubjectInput,
  type CurriculumFilters,
  SERIES_POR_SEGMENTO,
  type SetCurriculumInput,
  type Stage,
  type UpdateSubjectInput,
} from "./schema";

/** "  Educação   Física " -> "Educação Física". Nome de disciplina é chave. */
export function normalizeSubjectName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export interface SerieNaGrade {
  stage: Stage;
  gradeLevel: number;
  classrooms: number;
  subjects: {
    id: string;
    subjectId: string;
    name: string;
    sigla: string | null;
    tipo: string;
    lessonsPerWeek: number;
    horasAnuais: number | null;
  }[];
  /** Soma das aulas semanais. É o que a grade horária terá de acomodar. */
  lessonsPerWeek: number;
}

export function createAcademicService(repo: AcademicRepository) {
  return {
    listSubjects: () => repo.listSubjects(),

    async createSubject(input: CreateSubjectInput) {
      const name = normalizeSubjectName(input.name);

      const duplicada = await repo.findSubjectByName(name);
      if (duplicada) throw new ConflictError(`Já existe a disciplina "${name}"`);

      return repo.createSubject({ ...input, name });
    },

    async updateSubject(input: UpdateSubjectInput) {
      const { id, ...resto } = input;
      const atual = await repo.findSubject(id);
      if (!atual) throw new NotFoundError("Disciplina não encontrada");

      const name = resto.name ? normalizeSubjectName(resto.name) : undefined;
      if (name && name !== atual.name) {
        const duplicada = await repo.findSubjectByName(name);
        if (duplicada) throw new ConflictError(`Já existe a disciplina "${name}"`);
      }

      const atualizada = await repo.updateSubject(id, { ...resto, ...(name ? { name } : {}) });
      if (!atualizada) throw new NotFoundError("Disciplina não encontrada");
      return atualizada;
    },

    /**
     * Apagar disciplina com aula dada é proibido.
     *
     * A exclusão cascatearia para `lesson`, e com ela iriam chamada e diário
     * — histórico de aula que aconteceu, que ninguém pode apagar por engano
     * ao limpar um catálogo. Quem quer tirar do caminho marca como eletiva ou
     * remove da grade, que é reversível.
     */
    async removeSubject(id: string) {
      const atual = await repo.findSubject(id);
      if (!atual) throw new NotFoundError("Disciplina não encontrada");

      const lessons = await repo.lessonCountBySubject(id);
      if (lessons > 0) {
        throw new ValidationError(
          `"${atual.name}" tem ${lessons} aula${lessons > 1 ? "s" : ""} registrada${lessons > 1 ? "s" : ""}. ` +
            "Remova-a da grade curricular em vez de excluir — apagar levaria junto chamada e diário.",
        );
      }

      const removida = await repo.removeSubject(id);
      if (!removida) throw new NotFoundError("Disciplina não encontrada");
      return removida;
    },

    /**
     * A grade curricular do ano, uma linha por série que tem turma.
     *
     * Série sem disciplina nenhuma continua aparecendo, com a lista vazia: é
     * exatamente a que a secretaria precisa ver para montar. Sumir com ela
     * esconderia o trabalho que falta.
     */
    async curriculum(filters: CurriculumFilters): Promise<SerieNaGrade[]> {
      const [series, linhas] = await Promise.all([
        repo.gradeLevelsInUse(filters.academicYear),
        repo.listCurriculum(filters.academicYear, filters.stage),
      ]);

      return series
        .filter((gradeLevel) => !filters.stage || gradeLevel.stage === filters.stage)
        .map((gradeLevel) => {
          const subjects = linhas
            .filter(
              (linha) =>
                linha.stage === gradeLevel.stage && linha.gradeLevel === gradeLevel.gradeLevel,
            )
            .map((linha) => ({
              id: linha.id,
              subjectId: linha.subjectId,
              name: linha.subjectName,
              sigla: linha.subjectCode,
              tipo: linha.subjectKind,
              lessonsPerWeek: linha.weeklyHours,
              horasAnuais: linha.annualHours,
            }));

          return {
            stage: gradeLevel.stage as Stage,
            gradeLevel: gradeLevel.gradeLevel as number,
            classrooms: gradeLevel.classrooms,
            subjects,
            lessonsPerWeek: subjects.reduce((soma, d) => soma + d.lessonsPerWeek, 0),
          };
        });
    },

    async setCurriculum(input: SetCurriculumInput) {
      if (!SERIES_POR_SEGMENTO[input.stage].includes(input.gradeLevel)) {
        throw new ValidationError("Esta série não existe neste segmento");
      }

      const disciplina = await repo.findSubject(input.subjectId);
      if (!disciplina) throw new NotFoundError("Disciplina não encontrada");

      return repo.setCurriculum(input);
    },

    async removeFromCurriculum(id: string) {
      const removida = await repo.removeFromCurriculum(id);
      if (!removida) throw new NotFoundError("Esta disciplina não está na grade");
      return removida;
    },
  };
}

export type AcademicService = ReturnType<typeof createAcademicService>;
