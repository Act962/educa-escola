import { ConflictError, NotFoundError } from "../../errors";
import type { ClassroomRepository, CreateClassroomData } from "./repository";

/** "3º  ano   B " -> "3º ano B". Evita turmas duplicadas por espaçamento. */
export function normalizeClassroomName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/**
 * Regra de negócio de turmas. Não conhece HTTP nem Drizzle: recebe o
 * repositório pronto, o que permite testá-la isoladamente e reaproveitá-la
 * fora do tRPC (importação de planilha, job, seed).
 */
export function createClassroomService(repo: ClassroomRepository) {
  async function getOrThrow(id: string) {
    const found = await repo.findById(id);
    if (!found) throw new NotFoundError("Turma não encontrada");
    return found;
  }

  return {
    list: () => repo.list(),

    get: getOrThrow,

    async create(input: CreateClassroomData) {
      const name = normalizeClassroomName(input.name);

      const duplicate = await repo.findByNameAndYear(name, input.academicYear);
      if (duplicate) {
        throw new ConflictError(`Já existe a turma "${name}" em ${input.academicYear}`);
      }

      return repo.create({ name, academicYear: input.academicYear });
    },

    async rename(id: string, rawName: string) {
      const current = await getOrThrow(id);
      const name = normalizeClassroomName(rawName);

      if (name === current.name) return current;

      const duplicate = await repo.findByNameAndYear(name, current.academicYear);
      if (duplicate) {
        throw new ConflictError(`Já existe a turma "${name}" em ${current.academicYear}`);
      }

      const updated = await repo.rename(id, name);
      if (!updated) throw new NotFoundError("Turma não encontrada");
      return updated;
    },

    async remove(id: string) {
      const removed = await repo.remove(id);
      if (!removed) throw new NotFoundError("Turma não encontrada");
      return removed;
    },
  };
}

export type ClassroomService = ReturnType<typeof createClassroomService>;
