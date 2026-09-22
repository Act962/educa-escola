import { weightedAverage } from "../assessment/service";
import type { ScoreRepository } from "./repository";
import { type Level, levelOf, nextLevel, ruleFor, type SubjectKind } from "./rules";
import type { NewEvent, TermAverage } from "./tally";
import {
  tallyAssessments,
  tallyAttendance,
  tallyImprovement,
  tallyLessons,
  tallyYearAttendance,
} from "./tally";

export interface PosicaoNoPlacar {
  /** 1 é o primeiro. `null` quando a pessoa ainda não pontuou. */
  posicao: number | null;
  /** Quantos disputam — o denominador do "3º de 28". */
  total: number;
}

export interface ScorePanel {
  pontos: number;
  nivel: Level;
  proximo: ReturnType<typeof nextLevel>;
  extrato: {
    id: string;
    ruleKey: string;
    label: string;
    points: number;
    term: number | null;
    occurredAt: Date;
  }[];
}

/** Quantos fatos o extrato mostra. Suficiente para explicar o total recente. */
const TAMANHO_DO_EXTRATO = 30;

/**
 * Posição de um sujeito num placar já ordenado.
 *
 * Empate divide a mesma posição — dois alunos com 240 pontos são os dois
 * segundos, e o seguinte é o quarto. Desempatar por id daria a um deles uma
 * vantagem que os dados não sustentam.
 */
export function posicaoEm(
  placar: { subjectId: string; points: number }[],
  subjectId: string,
): PosicaoNoPlacar {
  const total = placar.length;
  const meu = placar.find((linha) => linha.subjectId === subjectId);
  if (!meu) return { posicao: null, total };

  const acima = placar.filter((linha) => linha.points > meu.points).length;
  return { posicao: acima + 1, total };
}

/** Média de pontos de um grupo. `null` com grupo vazio — não é zero. */
export function averagePoints(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((soma, valor) => soma + valor, 0) / valores.length);
}

export function createScoreService(repo: ScoreRepository) {
  function comRotulo(eventos: Awaited<ReturnType<ScoreRepository["listEvents"]>>) {
    return eventos.map((evento) => ({
      ...evento,
      // Regra removida do catálogo continua tendo eventos gravados: o fato
      // aconteceu. Mostrar a chave crua é feio, mas é honesto — melhor que
      // sumir com pontos que a pessoa já viu somados no total.
      label: ruleFor(evento.ruleKey)?.label ?? evento.ruleKey,
    }));
  }

  async function painel(
    subjectKind: SubjectKind,
    subjectId: string,
    academicYear: number,
  ): Promise<ScorePanel> {
    const [saldo, eventos] = await Promise.all([
      repo.balance({ subjectKind, subjectId, academicYear }),
      repo.listEvents({ subjectKind, subjectId, academicYear, limit: TAMANHO_DO_EXTRATO }),
    ]);

    const pontos = saldo?.points ?? 0;
    return {
      pontos,
      nivel: levelOf(pontos),
      proximo: nextLevel(pontos),
      extrato: comRotulo(eventos),
    };
  }

  return {
    /**
     * Apura o ano inteiro e refaz o saldo.
     *
     * Reexecutável de propósito, e é bom que seja: **não existe agendador**, o
     * que significa que a apuração acontece quando alguém clica. O índice
     * único de origem garante que clicar duas vezes não dobra pontuação.
     */
    async apurar(academicYear: number) {
      const [presencas, aulas, avaliacoes, lancamentos] = await Promise.all([
        repo.presencasDoAno(academicYear),
        repo.aulasDoAno(academicYear),
        repo.avaliacoesDoAno(academicYear),
        repo.lancamentosPublicadosDoAno(academicYear),
      ]);

      const medias = averagesByTerm(lancamentos);

      const eventos: NewEvent[] = [
        ...tallyAttendance(presencas),
        ...tallyYearAttendance(presencas, academicYear),
        ...tallyImprovement(medias, academicYear),
        ...tallyLessons(aulas),
        ...tallyAssessments(avaliacoes),
      ];

      const novos = await repo.appendEvents(eventos);
      await repo.rebuildBalances(academicYear);

      return { apurados: eventos.length, novos, academicYear };
    },

    /**
     * O painel do aluno.
     *
     * Devolve **posição e total, nunca a lista** — o §7.5 do requisito proíbe
     * ranking nominal entre alunos, e a garantia está na forma do retorno, não
     * numa checagem de tela que a próxima pessoa pode esquecer.
     */
    async doAluno(input: { studentId: string; classroomId: string | null; academicYear: number }) {
      const base = await painel("aluno", input.studentId, input.academicYear);

      if (!input.classroomId) {
        return { ...base, posicao: null, totalNaTurma: 0, mediaDaTurma: null };
      }

      const [placar, colegas] = await Promise.all([
        repo.scoreboard({ subjectKind: "aluno", academicYear: input.academicYear }),
        repo.studentIdsByClassroom(input.classroomId),
      ]);

      const daTurma = new Set(colegas);
      const placarDaTurma = placar.filter((linha) => daTurma.has(linha.subjectId));
      const { posicao } = posicaoEm(placarDaTurma, input.studentId);

      return {
        ...base,
        posicao,
        // O denominador é a turma inteira, não só quem pontuou: "3º de 12"
        // numa turma de 28 faria o aluno achar que metade sumiu.
        totalNaTurma: colegas.length,
        mediaDaTurma: averagePoints(
          colegas.map((id) => placarDaTurma.find((linha) => linha.subjectId === id)?.points ?? 0),
        ),
      };
    },

    /** O painel do professor. Posição entre docentes — decisão de produto, §10.6. */
    async doProfessor(teacherId: string, academicYear: number) {
      const [base, placar] = await Promise.all([
        painel("professor", teacherId, academicYear),
        repo.scoreboard({ subjectKind: "professor", academicYear }),
      ]);

      return { ...base, ...posicaoEm(placar, teacherId) };
    },

    /**
     * O placar nominal de alunos da escola. **Só para a direção.**
     *
     * Existe porque a coordenação precisa enxergar quem está descolando e quem
     * sumiu. Não é a tela do aluno, e o router é quem segura isso.
     */
    async rankingDeAlunos(academicYear: number) {
      const placar = await repo.scoreboard({ subjectKind: "aluno", academicYear });
      const alunos = await repo.studentsByIds(placar.map((linha) => linha.subjectId));
      const porId = new Map(alunos.map((aluno) => [aluno.id, aluno]));

      return placar.map((linha, indice) => ({
        posicao: indice + 1,
        subjectId: linha.subjectId,
        nome: porId.get(linha.subjectId)?.name ?? "Aluno removido",
        classroomId: porId.get(linha.subjectId)?.classroomId ?? null,
        pontos: linha.points,
        nivel: levelOf(linha.points),
      }));
    },

    /** O placar de professores. Mesma ressalva do §10.6 registrada no requisito. */
    async rankingDeProfessores(academicYear: number) {
      const placar = await repo.scoreboard({ subjectKind: "professor", academicYear });
      const docentes = await repo.teachersByIds(placar.map((linha) => linha.subjectId));
      const porId = new Map(docentes.map((docente) => [docente.id, docente.name]));

      return placar.map((linha, indice) => ({
        posicao: indice + 1,
        subjectId: linha.subjectId,
        // Quem perdeu o vínculo com a escola mantém os pontos do que fez, e a
        // tela precisa de um rótulo para a linha em vez de um id cru.
        nome: porId.get(linha.subjectId) ?? "Sem vínculo atual",
        pontos: linha.points,
        nivel: levelOf(linha.points),
      }));
    },
  };
}

/**
 * Média ponderada por aluno e bimestre.
 *
 * Usa `weightedAverage` do `assessment` em vez de refazer a conta: se as duas
 * divergissem, o ponto de evolução e o boletim contariam histórias diferentes
 * sobre o mesmo aluno.
 */
export function averagesByTerm(
  lancamentos: { studentId: string; term: number; score: number; weight: number }[],
): TermAverage[] {
  const agrupado = new Map<string, { score: number; weight: number }[]>();

  for (const linha of lancamentos) {
    const chave = `${linha.studentId}|${linha.term}`;
    const lista = agrupado.get(chave) ?? [];
    lista.push({ score: linha.score, weight: linha.weight });
    agrupado.set(chave, lista);
  }

  return [...agrupado].map(([chave, notas]) => {
    const [studentId = "", term = "0"] = chave.split("|");
    return { studentId, term: Number(term), media: weightedAverage(notas) };
  });
}

export type ScoreService = ReturnType<typeof createScoreService>;
