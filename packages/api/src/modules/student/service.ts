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

/**
 * Panorama de frequência por turma, para a direção.
 *
 * Reusa `attendanceRate` e `MINIMUM_ATTENDANCE_RATE` em vez de recalcular o
 * limiar: se a regra dos 75% mudar, esta tela muda junto. Turma sem aula
 * registrada tem taxa `null`, não 0% — acusar 0% de quem ainda não teve aula
 * seria mentir com número.
 */
export interface AttendanceOverviewRow {
  classroomId: string | null;
  classroomName: string;
  shift: string;
  rate: number | null;
  belowMinimum: number;
  students: number;
}

export interface AttendanceStudentRow {
  studentId: string;
  studentName: string;
  registration: string;
  classroomName: string | null;
  shift: string;
  rate: number;
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
    /**
     * Média de cada turma e quem está abaixo do mínimo, do mesmo conjunto.
     *
     * Os dois números saem da mesma consulta de propósito: em duas consultas,
     * a média da turma e a contagem de alunos abaixo poderiam discordar entre
     * si e ninguém saberia qual acreditar.
     */
    async attendanceOverview() {
      const linhas = await repo.presenceByStudent();

      const porTurma = new Map<string, AttendanceOverviewRow & PresenceCounts>();
      const abaixo: AttendanceStudentRow[] = [];

      for (const linha of linhas) {
        const chave = linha.classroomId ?? "sem-turma";
        const atual = porTurma.get(chave) ?? {
          classroomId: linha.classroomId,
          classroomName: linha.classroomName ?? "Sem turma",
          shift: linha.shift,
          rate: null,
          belowMinimum: 0,
          students: 0,
          presentCount: 0,
          lateCount: 0,
          absentCount: 0,
        };

        atual.students += 1;
        atual.presentCount += linha.presentCount;
        atual.lateCount += linha.lateCount;
        atual.absentCount += linha.absentCount;

        const taxa = attendanceRate(linha);
        if (taxa !== null && taxa < MINIMUM_ATTENDANCE_RATE) {
          atual.belowMinimum += 1;
          abaixo.push({
            studentId: linha.studentId,
            studentName: linha.studentName,
            registration: linha.registration,
            classroomName: linha.classroomName,
            shift: linha.shift,
            rate: taxa,
          });
        }

        porTurma.set(chave, atual);
      }

      const turmas: AttendanceOverviewRow[] = [...porTurma.values()].map((turma) => ({
        classroomId: turma.classroomId,
        classroomName: turma.classroomName,
        shift: turma.shift,
        rate: attendanceRate(turma),
        belowMinimum: turma.belowMinimum,
        students: turma.students,
      }));

      const geral = attendanceRate(
        linhas.reduce(
          (soma, linha) => ({
            presentCount: soma.presentCount + linha.presentCount,
            lateCount: soma.lateCount + linha.lateCount,
            absentCount: soma.absentCount + linha.absentCount,
          }),
          { presentCount: 0, lateCount: 0, absentCount: 0 },
        ),
      );

      return {
        rate: geral,
        students: linhas.length,
        belowMinimum: abaixo.length,
        minimumRate: MINIMUM_ATTENDANCE_RATE,
        // Quem está mais longe do mínimo primeiro: é quem a direção precisa
        // procurar antes que o ano feche.
        classrooms: turmas.sort((a, b) => (a.rate ?? 1) - (b.rate ?? 1)),
        below: abaixo.sort((a, b) => a.rate - b.rate),
      };
    },

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
