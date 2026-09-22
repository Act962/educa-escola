import { toSchoolDate } from "../../dates";
import { NotFoundError } from "../../errors";
import type { TeacherRepository } from "./repository";
import type { TeacherFilters } from "./schema";

/**
 * Como a direção enxerga o corpo docente.
 *
 * **Tudo aqui é sobre registro, nunca sobre desempenho.** Pendência de chamada
 * e de nota são fatos operacionais — quem deve o quê. Média da turma e taxa de
 * aprovação ficam de fora de propósito: §10.6 do requisito diz que indicador
 * pedagógico é apoio, não ranking de docentes, e uma tela de gestão de pessoal
 * é exatamente onde esse limite seria atravessado sem querer.
 */

export interface DocenteNaLista {
  userId: string;
  name: string;
  email: string;
  turmas: number;
  disciplinas: number;
  aulas: number;
  /** Aulas encerradas sem chamada. */
  chamadasPendentes: number;
  /** Lançamentos de nota que faltam. */
  notasPendentes: number;
  situacao: Situacao;
}

/**
 * A situação é derivada, nunca digitada.
 *
 * `sem_turma` vem antes de tudo: docente sem aula no ano não está atrasado,
 * está sem alocação — dizer "em dia" para ele esconderia o problema real, que
 * é a grade não ter sido montada.
 */
export type Situacao = "em_dia" | "atencao" | "atrasado" | "sem_turma";

/** A partir de quantas pendências a situação deixa de ser "atenção". */
export const PENDENCIAS_PARA_ATRASO = 3;

export function situacaoDe(input: {
  aulas: number;
  chamadasPendentes: number;
  notasPendentes: number;
}): Situacao {
  if (input.aulas === 0) return "sem_turma";

  const total = input.chamadasPendentes + input.notasPendentes;
  if (total === 0) return "em_dia";
  return total >= PENDENCIAS_PARA_ATRASO ? "atrasado" : "atencao";
}

export function createTeacherService(repo: TeacherRepository) {
  return {
    /**
     * A lista do corpo docente com o que cada um está devendo.
     *
     * Ordenada por nome e não por pendência: é um cadastro de pessoas, e uma
     * lista que reordena sozinha conforme alguém atrasa vira um ranking de
     * docentes por acidente. Quem quer ver só as pendências usa o filtro.
     */
    async list(filters: TeacherFilters, now: Date) {
      const hoje = toSchoolDate(now);

      const [docentes, carga, chamadas, notas] = await Promise.all([
        repo.list(filters.search),
        repo.loadByTeacher(filters.academicYear),
        repo.pendingCallsByTeacher(filters.academicYear, hoje),
        repo.pendingGradesByTeacher(filters.academicYear),
      ]);

      const porCarga = new Map(carga.map((linha) => [linha.teacherId, linha]));
      const porChamada = new Map(chamadas.map((linha) => [linha.teacherId, linha.pendentes]));
      const porNota = new Map(notas.map((linha) => [linha.teacherId, linha.faltando]));

      const linhas: DocenteNaLista[] = docentes.map((docente) => {
        const dele = porCarga.get(docente.userId);
        const base = {
          aulas: dele?.aulas ?? 0,
          chamadasPendentes: porChamada.get(docente.userId) ?? 0,
          notasPendentes: porNota.get(docente.userId) ?? 0,
        };

        return {
          userId: docente.userId,
          name: docente.name,
          email: docente.email,
          turmas: dele?.turmas ?? 0,
          disciplinas: dele?.disciplinas ?? 0,
          ...base,
          situacao: situacaoDe(base),
        };
      });

      const visiveis = filters.comPendencia
        ? linhas.filter((linha) => linha.situacao === "atrasado" || linha.situacao === "atencao")
        : linhas;

      return {
        items: visiveis,
        total: linhas.length,
        resumo: {
          total: linhas.length,
          semTurma: linhas.filter((l) => l.situacao === "sem_turma").length,
          comPendencia: linhas.filter((l) => l.situacao === "atrasado" || l.situacao === "atencao")
            .length,
          chamadasPendentes: linhas.reduce((soma, l) => soma + l.chamadasPendentes, 0),
        },
      };
    },

    /** A ficha de um docente: onde ele dá aula e o que está devendo. */
    async byId(userId: string, academicYear: number, now: Date) {
      const docente = await repo.findMember(userId);
      if (!docente) throw new NotFoundError("Professor não encontrado nesta escola");

      const hoje = toSchoolDate(now);
      const [alocacoes, alunos, frequencia, carga, chamadas, notas] = await Promise.all([
        repo.assignmentsOf(userId, academicYear),
        repo.reachOf(userId, academicYear),
        repo.attendanceOf(userId, academicYear),
        repo.loadByTeacher(academicYear),
        repo.pendingCallsByTeacher(academicYear, hoje),
        repo.pendingGradesByTeacher(academicYear),
      ]);

      const dele = carga.find((linha) => linha.teacherId === userId);
      const base = {
        aulas: dele?.aulas ?? 0,
        chamadasPendentes: chamadas.find((l) => l.teacherId === userId)?.pendentes ?? 0,
        notasPendentes: notas.find((l) => l.teacherId === userId)?.faltando ?? 0,
      };

      return {
        ...docente,
        ...base,
        aulasRegistradas: dele?.registradas ?? 0,
        alunos,
        situacao: situacaoDe(base),
        // Uma linha por turma, com as disciplinas que ele dá nela: a leitura
        // natural é "no 8º A ele dá Matemática e Física", não uma lista de
        // pares turma+disciplina repetindo a turma.
        turmas: agruparPorTurma(alocacoes),
        frequenciaDasTurmas: taxa(frequencia.comparecimentos, frequencia.registros),
      };
    },
  };
}

/** Agrupa as alocações por turma. `null` de frequência quando não há registro. */
export function agruparPorTurma(
  alocacoes: { classroomId: string; classroomName: string; subjectName: string }[],
) {
  const porTurma = new Map<string, { classroomId: string; nome: string; disciplinas: string[] }>();

  for (const linha of alocacoes) {
    const atual = porTurma.get(linha.classroomId) ?? {
      classroomId: linha.classroomId,
      nome: linha.classroomName,
      disciplinas: [],
    };
    if (!atual.disciplinas.includes(linha.subjectName)) atual.disciplinas.push(linha.subjectName);
    porTurma.set(linha.classroomId, atual);
  }

  return [...porTurma.values()];
}

/**
 * Taxa de 0 a 1. **`null` sem registro, não zero** — é a mesma leitura que a
 * frequência do aluno faz: sem aula registrada não existe frequência.
 */
export function taxa(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return parte / total;
}

export type TeacherService = ReturnType<typeof createTeacherService>;
