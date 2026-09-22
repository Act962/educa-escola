import { toSchoolDate } from "../../dates";
import { ENROLLED_STATUSES } from "../student/schema";
import { MINIMUM_ATTENDANCE_RATE } from "../student/service";
import { type Column, fileName, generateCsv, numberCell, percentCell } from "./csv";
import { buildIndicators, type Indicator, rate } from "./indicators";
import type { ReportRepository } from "./repository";

export type ReportKey = "alunos-por-turma" | "frequencia-por-turma" | "carga-dos-docentes";

export interface AvailableReport {
  chave: ReportKey;
  titulo: string;
  descricao: string;
}

/** O catálogo do §15.1 e §15.2 no recorte que os dados de hoje sustentam. */
export const REPORTS: AvailableReport[] = [
  {
    chave: "alunos-por-turma",
    titulo: "Alunos por turma",
    descricao: "Quantos em cada turma, por turno, e quantos com documentação pendente.",
  },
  {
    chave: "frequencia-por-turma",
    titulo: "Frequência por turma",
    descricao: "Frequência média de cada turma no ano, contra o mínimo de 75%.",
  },
  {
    chave: "carga-dos-docentes",
    titulo: "Carga dos docentes",
    descricao: "Turmas, aulas dadas e chamadas em aberto por professor.",
  },
];

export function createReportService(repo: ReportRepository) {
  async function indicadores(academicYear: number, now: Date): Promise<Indicator[]> {
    const hoje = toSchoolDate(now);

    const [situacoes, frequenciaTurmas, porAluno, docentes] = await Promise.all([
      repo.movimentacao(),
      repo.frequenciaPorTurma(academicYear),
      repo.frequenciaPorAluno(academicYear),
      repo.cargaPorDocente(academicYear, hoje),
    ]);

    const registros = frequenciaTurmas.reduce((soma, t) => soma + t.registros, 0);
    const comparecimentos = frequenciaTurmas.reduce((soma, t) => soma + t.comparecimentos, 0);

    // Conta por situação, e **não** partindo da turma: aluno matriculado que
    // ainda não foi alocado some de um `join` com `classroom`, e some em
    // silêncio. A escola de demonstração tem cinco nessa situação, e eles são
    // matrícula ativa tanto quanto os outros.
    const naSala = situacoes
      .filter((linha) => ENROLLED_STATUSES.includes(linha.status as never))
      .reduce((soma, linha) => soma + linha.total, 0);

    return buildIndicators({
      alunosNaSala: naSala,
      frequenciaGeral: rate(comparecimentos, registros),
      // Aluno sem aula registrada não está em risco: está sem aula. É a mesma
      // leitura que `attendanceRate` faz devolvendo `null` em vez de 0%.
      alunosEmRisco: porAluno.filter(
        (aluno) =>
          aluno.registros > 0 && aluno.comparecimentos / aluno.registros < MINIMUM_ATTENDANCE_RATE,
      ).length,
      pendenciasDeLancamento: docentes.reduce((soma, d) => soma + d.semChamada, 0),
    });
  }

  return {
    indicadores,

    catalogo: () => REPORTS,

    /**
     * Gera o CSV de um relatório.
     *
     * O servidor monta o arquivo, e não o navegador: a conta e o recorte têm
     * de ser os mesmos da tela, e reimplementá-los no cliente seria criar duas
     * versões da verdade que divergem na primeira mudança.
     */
    async exportar(chave: ReportKey, academicYear: number, now: Date) {
      const hoje = toSchoolDate(now);

      if (chave === "alunos-por-turma") {
        const linhas = await repo.alunosPorTurma(academicYear);
        type Linha = (typeof linhas)[number];
        const colunas: Column<Linha>[] = [
          { titulo: "Turma", valor: (l) => l.classroomName },
          { titulo: "Série", valor: (l) => l.gradeLevel ?? "" },
          { titulo: "Total", valor: (l) => l.total },
          { titulo: "Na sala", valor: (l) => l.naSala },
          { titulo: "Documentação pendente", valor: (l) => l.documentacaoPendente },
          { titulo: "Manhã", valor: (l) => l.manha },
          { titulo: "Tarde", valor: (l) => l.tarde },
          { titulo: "Noite", valor: (l) => l.noite },
        ];
        return {
          nome: fileName("Alunos por turma", academicYear, hoje),
          conteudo: generateCsv(colunas, linhas),
        };
      }

      if (chave === "frequencia-por-turma") {
        const linhas = await repo.frequenciaPorTurma(academicYear);
        type Linha = (typeof linhas)[number];
        const colunas: Column<Linha>[] = [
          { titulo: "Turma", valor: (l) => l.classroomName },
          { titulo: "Alunos com registro", valor: (l) => l.alunos },
          { titulo: "Registros de chamada", valor: (l) => l.registros },
          { titulo: "Comparecimentos", valor: (l) => l.comparecimentos },
          {
            titulo: "Frequência",
            valor: (l) => percentCell(rate(l.comparecimentos, l.registros)),
          },
          {
            titulo: "Abaixo do mínimo",
            valor: (l) => {
              const t = rate(l.comparecimentos, l.registros);
              // Vazio, e não "Não", quando não há aula: a turma não está
              // acima nem abaixo do mínimo — ela não tem frequência.
              return t === null ? "" : t < MINIMUM_ATTENDANCE_RATE ? "Sim" : "Não";
            },
          },
        ];
        return {
          nome: fileName("Frequência por turma", academicYear, hoje),
          conteudo: generateCsv(colunas, linhas),
        };
      }

      const linhas = await repo.cargaPorDocente(academicYear, hoje);
      type Linha = (typeof linhas)[number];
      const colunas: Column<Linha>[] = [
        { titulo: "Professor", valor: (l) => l.teacherName },
        { titulo: "Turmas", valor: (l) => l.turmas },
        { titulo: "Aulas no ano", valor: (l) => l.aulas },
        { titulo: "Chamadas em aberto", valor: (l) => l.semChamada },
        {
          titulo: "Média de aulas por turma",
          valor: (l) => numberCell(l.turmas > 0 ? l.aulas / l.turmas : null),
        },
      ];
      return {
        nome: fileName("Carga dos docentes", academicYear, hoje),
        conteudo: generateCsv(colunas, linhas),
      };
    },

    /** As turmas com frequência abaixo do mínimo — o recorte que a direção age. */
    async turmasEmAlerta(academicYear: number) {
      const linhas = await repo.frequenciaPorTurma(academicYear);
      return linhas
        .map((linha) => ({
          classroomId: linha.classroomId,
          nome: linha.classroomName,
          frequencia: rate(linha.comparecimentos, linha.registros),
          alunos: linha.alunos,
        }))
        .filter((linha) => linha.frequencia !== null && linha.frequencia < MINIMUM_ATTENDANCE_RATE);
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
