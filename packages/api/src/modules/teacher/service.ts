import { toSchoolDate } from "../../dates";
import { ConflictError, NotFoundError } from "../../errors";
import { conviteDeProfessorFor, gerarToken, hashToken, prazoDe } from "./convite";
import type { TeacherRepository } from "./repository";
import type { ConvidarProfessorInput, TeacherFilters } from "./schema";

/**
 * Como a direção enxerga o corpo docente.
 *
 * **Tudo aqui é sobre registro, nunca sobre desempenho.** Pendência de chamada
 * e de nota são fatos operacionais — quem deve o quê. Média da turma e taxa de
 * aprovação ficam de fora de propósito: §10.6 do requisito diz que indicador
 * pedagógico é apoio, não ranking de docentes, e uma tela de gestão de pessoal
 * é exatamente onde esse limite seria atravessado sem querer.
 */

export interface TeacherListItem {
  userId: string;
  name: string;
  email: string;
  classrooms: number;
  subjects: number;
  lessons: number;
  /** Aulas encerradas sem chamada. */
  pendingAttendance: number;
  /** Lançamentos de nota que faltam. */
  pendingGrades: number;
  situation: Situation;
}

/**
 * A situação é derivada, nunca digitada.
 *
 * `sem_turma` vem antes de tudo: docente sem aula no ano não está atrasado,
 * está sem alocação — dizer "em dia" para ele esconderia o problema real, que
 * é a grade não ter sido montada.
 */
export type Situation = "em_dia" | "atencao" | "atrasado" | "sem_turma";

/** A partir de quantas pendências a situação deixa de ser "atenção". */
export const PENDING_FOR_OVERDUE = 3;

export function situationOf(input: {
  lessons: number;
  pendingAttendance: number;
  pendingGrades: number;
}): Situation {
  if (input.lessons === 0) return "sem_turma";

  const total = input.pendingAttendance + input.pendingGrades;
  if (total === 0) return "em_dia";
  return total >= PENDING_FOR_OVERDUE ? "atrasado" : "atencao";
}

/**
 * O que o cadastro de professor precisa de fora.
 *
 * `criarConta` é injetada e não chamada direto porque criar usuário é do
 * Better Auth, e o serviço precisa rodar em teste sem subir autenticação —
 * mesma razão do repositório vir por parâmetro.
 */
export interface DepsDoCorpoDocente {
  now: () => Date;
  linkBaseUrl: string;
  actor: { userId: string };
  criarConta: (input: {
    name: string;
    email: string;
    password: string;
  }) => Promise<{ userId: string }>;
}

export function createTeacherService(repo: TeacherRepository, deps?: DepsDoCorpoDocente) {
  /** As dependências só fazem falta no convite; a leitura não usa nenhuma. */
  function exigirDeps(): DepsDoCorpoDocente {
    if (!deps) throw new Error("O serviço foi montado sem as dependências do convite.");
    return deps;
  }

  return {
    /** As disciplinas da escola, para a secretaria marcar no cadastro. */
    disciplinas: () => repo.listSubjects(),

    /**
     * Cadastra um professor: cria o convite e devolve o endereço.
     *
     * **A escola nunca conhece a senha.** O que sai daqui é um link; quem
     * escolhe a senha é o professor, ao abri-lo. Enquanto não houver envio
     * automático, o endereço aparece uma vez para a secretaria copiar — mesma
     * costura do link de matrícula.
     */
    async convidar(input: ConvidarProfessorInput) {
      const d = exigirDeps();
      const email = input.email.trim().toLowerCase();

      const jaEstá = await repo.memberByEmail(email);
      if (jaEstá) {
        throw new ConflictError("Este e-mail já tem acesso a esta escola.");
      }

      /*
       * Um convite vivo por e-mail.
       *
       * Dois links válidos para a mesma pessoa é a receita para a secretaria
       * mandar o antigo e o professor abrir o novo — ou o contrário. O
       * anterior é revogado, e o endereço que vale é sempre o último emitido.
       */
      const aberto = await repo.openInviteFor(email);
      const agora = d.now();
      if (aberto) await repo.revokeInvite(aberto.id, agora);

      const token = gerarToken();
      await repo.createInvite({
        name: input.name.trim(),
        email,
        tokenHash: hashToken(token),
        subjectIds: input.subjectIds,
        expiresAt: prazoDe(agora, input.expiryDays),
        createdByUserId: d.actor.userId,
      });

      return { url: conviteDeProfessorFor(d.linkBaseUrl, token), email };
    },

    /**
     * A lista do corpo docente com o que cada um está devendo.
     *
     * Ordenada por nome e não por pendência: é um cadastro de pessoas, e uma
     * lista que reordena sozinha conforme alguém atrasa vira um ranking de
     * docentes por acidente. Quem quer ver só as pendências usa o filtro.
     */
    async list(filters: TeacherFilters, now: Date) {
      const hoje = toSchoolDate(now);

      const [teachers, carga, chamadas, grades] = await Promise.all([
        repo.list(filters.search),
        repo.loadByTeacher(filters.academicYear),
        repo.pendingCallsByTeacher(filters.academicYear, hoje),
        repo.pendingGradesByTeacher(filters.academicYear),
      ]);

      const porCarga = new Map(carga.map((linha) => [linha.teacherId, linha]));
      const porChamada = new Map(chamadas.map((linha) => [linha.teacherId, linha.pending]));
      const porNota = new Map(grades.map((linha) => [linha.teacherId, linha.faltando]));

      const linhas: TeacherListItem[] = teachers.map((teacher) => {
        const dele = porCarga.get(teacher.userId);
        const base = {
          lessons: dele?.lessons ?? 0,
          pendingAttendance: porChamada.get(teacher.userId) ?? 0,
          pendingGrades: porNota.get(teacher.userId) ?? 0,
        };

        return {
          userId: teacher.userId,
          name: teacher.name,
          email: teacher.email,
          classrooms: dele?.classrooms ?? 0,
          subjects: dele?.subjects ?? 0,
          ...base,
          situation: situationOf(base),
        };
      });

      const visiveis = filters.withPending
        ? linhas.filter((linha) => linha.situation === "atrasado" || linha.situation === "atencao")
        : linhas;

      return {
        items: visiveis,
        total: linhas.length,
        summary: {
          total: linhas.length,
          withoutClassroom: linhas.filter((l) => l.situation === "sem_turma").length,
          withPending: linhas.filter((l) => l.situation === "atrasado" || l.situation === "atencao")
            .length,
          pendingAttendance: linhas.reduce((soma, l) => soma + l.pendingAttendance, 0),
        },
      };
    },

    /** A ficha de um docente: onde ele dá aula e o que está devendo. */
    async byId(userId: string, academicYear: number, now: Date) {
      const teacher = await repo.findMember(userId);
      if (!teacher) throw new NotFoundError("Professor não encontrado nesta escola");

      const hoje = toSchoolDate(now);
      const [alocacoes, alunos, attendanceRate, carga, chamadas, grades] = await Promise.all([
        repo.assignmentsOf(userId, academicYear),
        repo.reachOf(userId, academicYear),
        repo.attendanceOf(userId, academicYear),
        repo.loadByTeacher(academicYear),
        repo.pendingCallsByTeacher(academicYear, hoje),
        repo.pendingGradesByTeacher(academicYear),
      ]);

      const dele = carga.find((linha) => linha.teacherId === userId);
      const base = {
        lessons: dele?.lessons ?? 0,
        pendingAttendance: chamadas.find((l) => l.teacherId === userId)?.pending ?? 0,
        pendingGrades: grades.find((l) => l.teacherId === userId)?.faltando ?? 0,
      };

      return {
        ...teacher,
        ...base,
        recordedLessons: dele?.registradas ?? 0,
        alunos,
        situation: situationOf(base),
        // Uma linha por turma, com as disciplinas que ele dá nela: a leitura
        // natural é "no 8º A ele dá Matemática e Física", não uma lista de
        // pares turma+disciplina repetindo a turma.
        classrooms: groupByClassroom(alocacoes),
        classroomAttendance: rate(attendanceRate.comparecimentos, attendanceRate.registros),
      };
    },
  };
}

/** Agrupa as alocações por turma. `null` de frequência quando não há registro. */
export function groupByClassroom(
  alocacoes: { classroomId: string; classroomName: string; subjectName: string }[],
) {
  const byClassroom = new Map<string, { classroomId: string; name: string; subjects: string[] }>();

  for (const linha of alocacoes) {
    const atual = byClassroom.get(linha.classroomId) ?? {
      classroomId: linha.classroomId,
      name: linha.classroomName,
      subjects: [],
    };
    if (!atual.subjects.includes(linha.subjectName)) atual.subjects.push(linha.subjectName);
    byClassroom.set(linha.classroomId, atual);
  }

  return [...byClassroom.values()];
}

/**
 * Taxa de 0 a 1. **`null` sem registro, não zero** — é a mesma leitura que a
 * frequência do aluno faz: sem aula registrada não existe frequência.
 */
export function rate(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return parte / total;
}

export type TeacherService = ReturnType<typeof createTeacherService>;
