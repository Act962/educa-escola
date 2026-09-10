import { ConflictError, NotFoundError } from "../../errors";
import type { CreateStudentData, StudentFilters, StudentRepository } from "./repository";

/**
 * Frequência mínima para aprovação (LDB, art. 24, VI): 75% das aulas dadas.
 * É daqui que sai o "alerta de frequência" da listagem da Gestão.
 */
export const MINIMUM_ATTENDANCE_RATE = 0.75;

export interface PresenceCounts {
  presentCount: number;
  lateCount: number;
  absentCount: number;
}

/**
 * Atraso conta como presença — quem chegou assistiu à aula. Sem aula
 * registrada não existe frequência: devolve `null`, e não 0%, para a tela não
 * acusar falta de quem ainda não teve aula nenhuma.
 */
export function attendanceRate(counts: PresenceCounts): number | null {
  const total = counts.presentCount + counts.lateCount + counts.absentCount;
  if (total === 0) return null;
  return (counts.presentCount + counts.lateCount) / total;
}

export function isBelowMinimumAttendance(counts: PresenceCounts): boolean {
  const rate = attendanceRate(counts);
  return rate !== null && rate < MINIMUM_ATTENDANCE_RATE;
}

/** "  2026 - 0301 " -> "2026-0301". A matrícula é chave, não texto livre. */
export function normalizeRegistration(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function createStudentService(repo: StudentRepository) {
  function decorate<T extends PresenceCounts>(row: T) {
    const rate = attendanceRate(row);
    return {
      ...row,
      attendanceRate: rate,
      belowMinimumAttendance: isBelowMinimumAttendance(row),
    };
  }

  return {
    async list(filters: StudentFilters & { atRisk?: boolean }) {
      const rows = (await repo.list(filters)).map(decorate);
      // O recorte "em risco" é derivado, então não dá para filtrar no SQL sem
      // duplicar a regra. Filtramos a página já carregada e dizemos quantos
      // vieram, em vez de mentir um total que a regra não conhece.
      const visible = filters.atRisk ? rows.filter((row) => row.belowMinimumAttendance) : rows;

      return {
        items: visible,
        total: await repo.countMatching(filters),
      };
    },

    async get(id: string) {
      const found = await repo.findById(id);
      if (!found) throw new NotFoundError("Aluno não encontrado");
      return found;
    },

    async byUserId(userId: string) {
      const found = await repo.findByUserId(userId);
      if (!found) {
        throw new NotFoundError("Nenhuma matrícula vinculada a este acesso nesta escola");
      }
      return found;
    },

    async rosterOf(classroomId: string) {
      return (await repo.listByClassroom(classroomId)).map(decorate);
    },

    async create(input: CreateStudentData) {
      const registration = normalizeRegistration(input.registration);

      const duplicate = await repo.findByRegistration(registration);
      if (duplicate) {
        throw new ConflictError(`Já existe aluno com a matrícula ${registration}`);
      }

      return repo.create({ ...input, registration });
    },
  };
}

export type StudentService = ReturnType<typeof createStudentService>;
