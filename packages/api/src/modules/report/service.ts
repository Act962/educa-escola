import { toSchoolDate } from "../../dates";
import { ENROLLED_STATUSES } from "../student/schema";
import { MINIMUM_ATTENDANCE_RATE } from "../student/service";
import { type Column, fileName, generateCsv, numberCell, percentCell } from "./csv";
import { buildIndicators, type Indicator, rate } from "./indicators";
import type { ReportRepository } from "./repository";

export type ReportKey = "alunos-por-turma" | "frequencia-por-turma" | "carga-dos-docentes";

export interface AvailableReport {
  key: ReportKey;
  title: string;
  descricao: string;
}

/** O catálogo do §15.1 e §15.2 no recorte que os dados de hoje sustentam. */
export const REPORTS: AvailableReport[] = [
  {
    key: "alunos-por-turma",
    title: "Alunos por turma",
    descricao: "Quantos em cada turma, por turno, e quantos com documentação pendente.",
  },
  {
    key: "frequencia-por-turma",
    title: "Frequência por turma",
    descricao: "Frequência média de cada turma no ano, contra o mínimo de 75%.",
  },
  {
    key: "carga-dos-docentes",
    title: "Carga dos docentes",
    descricao: "Turmas, aulas dadas e chamadas em aberto por professor.",
  },
];

export function createReportService(repo: ReportRepository) {
  async function indicators(academicYear: number, now: Date): Promise<Indicator[]> {
    const hoje = toSchoolDate(now);

    const [situacoes, frequenciaTurmas, byStudent, teachers] = await Promise.all([
      repo.movimentacao(),
      repo.attendanceByClassroom(academicYear),
      repo.attendanceByStudent(academicYear),
      repo.loadByTeacher(academicYear, hoje),
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
      studentsInRoom: naSala,
      overallAttendance: rate(comparecimentos, registros),
      // Aluno sem aula registrada não está em risco: está sem aula. É a mesma
      // leitura que `attendanceRate` faz devolvendo `null` em vez de 0%.
      studentsAtRisk: byStudent.filter(
        (aluno) =>
          aluno.registros > 0 && aluno.comparecimentos / aluno.registros < MINIMUM_ATTENDANCE_RATE,
      ).length,
      pendingGradeEntries: teachers.reduce((soma, d) => soma + d.semChamada, 0),
    });
  }

  return {
    indicators,

    catalogo: () => REPORTS,

    /**
     * Gera o CSV de um relatório.
     *
     * O servidor monta o arquivo, e não o navegador: a conta e o recorte têm
     * de ser os mesmos da tela, e reimplementá-los no cliente seria criar duas
     * versões da verdade que divergem na primeira mudança.
     */
    async exportar(key: ReportKey, academicYear: number, now: Date) {
      const hoje = toSchoolDate(now);

      if (key === "alunos-por-turma") {
        const linhas = await repo.studentsByClassroom(academicYear);
        type Linha = (typeof linhas)[number];
        const columns: Column<Linha>[] = [
          { title: "Turma", valor: (l) => l.classroomName },
          { title: "Série", valor: (l) => l.gradeLevel ?? "" },
          { title: "Total", valor: (l) => l.total },
          { title: "Na sala", valor: (l) => l.naSala },
          { title: "Documentação pendente", valor: (l) => l.documentacaoPendente },
          { title: "Manhã", valor: (l) => l.manha },
          { title: "Tarde", valor: (l) => l.tarde },
          { title: "Noite", valor: (l) => l.noite },
        ];
        return {
          name: fileName("Alunos por turma", academicYear, hoje),
          conteudo: generateCsv(columns, linhas),
        };
      }

      if (key === "frequencia-por-turma") {
        const linhas = await repo.attendanceByClassroom(academicYear);
        type Linha = (typeof linhas)[number];
        const columns: Column<Linha>[] = [
          { title: "Turma", valor: (l) => l.classroomName },
          { title: "Alunos com registro", valor: (l) => l.alunos },
          { title: "Registros de chamada", valor: (l) => l.registros },
          { title: "Comparecimentos", valor: (l) => l.comparecimentos },
          {
            title: "Frequência",
            valor: (l) => percentCell(rate(l.comparecimentos, l.registros)),
          },
          {
            title: "Abaixo do mínimo",
            valor: (l) => {
              const t = rate(l.comparecimentos, l.registros);
              // Vazio, e não "Não", quando não há aula: a turma não está
              // acima nem abaixo do mínimo — ela não tem frequência.
              return t === null ? "" : t < MINIMUM_ATTENDANCE_RATE ? "Sim" : "Não";
            },
          },
        ];
        return {
          name: fileName("Frequência por turma", academicYear, hoje),
          conteudo: generateCsv(columns, linhas),
        };
      }

      const linhas = await repo.loadByTeacher(academicYear, hoje);
      type Linha = (typeof linhas)[number];
      const columns: Column<Linha>[] = [
        { title: "Professor", valor: (l) => l.teacherName },
        { title: "Turmas", valor: (l) => l.classrooms },
        { title: "Aulas no ano", valor: (l) => l.lessons },
        { title: "Chamadas em aberto", valor: (l) => l.semChamada },
        {
          title: "Média de aulas por turma",
          valor: (l) => numberCell(l.classrooms > 0 ? l.lessons / l.classrooms : null),
        },
      ];
      return {
        name: fileName("Carga dos docentes", academicYear, hoje),
        conteudo: generateCsv(columns, linhas),
      };
    },

    /** As turmas com frequência abaixo do mínimo — o recorte que a direção age. */
    async classroomsAtRisk(academicYear: number) {
      const linhas = await repo.attendanceByClassroom(academicYear);
      return linhas
        .map((linha) => ({
          classroomId: linha.classroomId,
          name: linha.classroomName,
          attendanceRate: rate(linha.comparecimentos, linha.registros),
          alunos: linha.alunos,
        }))
        .filter(
          (linha) =>
            linha.attendanceRate !== null && linha.attendanceRate < MINIMUM_ATTENDANCE_RATE,
        );
    },
  };
}

export type ReportService = ReturnType<typeof createReportService>;
