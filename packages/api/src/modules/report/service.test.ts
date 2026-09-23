import { describe, expect, it } from "vitest";

import { NO_DATA, rate } from "./indicators";
import type { ReportRepository } from "./repository";
import { createReportService } from "./service";

const AGORA = new Date("2026-09-22T12:00:00Z");

type Turma = Awaited<ReturnType<ReportRepository["studentsByClassroom"]>>[number];
type Freq = Awaited<ReturnType<ReportRepository["attendanceByClassroom"]>>[number];
type Docente = Awaited<ReturnType<ReportRepository["loadByTeacher"]>>[number];

interface Estado {
  classrooms?: Partial<Turma>[];
  situacoes?: { status: string; total: number }[];
  attendanceRate?: Partial<Freq>[];
  byStudent?: { studentId: string; registros: number; comparecimentos: number }[];
  teachers?: Partial<Docente>[];
}

function fakeRepository(estado: Estado = {}): ReportRepository {
  return {
    studentsByClassroom: async () => (estado.classrooms ?? []) as Turma[],
    movimentacao: async () => (estado.situacoes ?? []) as never,
    attendanceByClassroom: async () => (estado.attendanceRate ?? []) as Freq[],
    attendanceByStudent: async () => estado.byStudent ?? [],
    loadByTeacher: async () => (estado.teachers ?? []) as Docente[],
  };
}

const acha = <T extends { key: string }>(list: T[], key: string) => list.find((i) => i.key === key);

describe("taxa", () => {
  it("é nula sem denominador, nunca zero", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(9, 10)).toBe(0.9);
  });
});

describe("indicadores", () => {
  const estado: Estado = {
    situacoes: [
      { status: "ativo", total: 50 },
      { status: "documentacao_pendente", total: 8 },
      // Transferido não é matrícula ativa.
      { status: "transferido", total: 3 },
    ],
    attendanceRate: [{ registros: 100, comparecimentos: 94 }],
    byStudent: [
      { studentId: "a", registros: 100, comparecimentos: 95 },
      { studentId: "b", registros: 100, comparecimentos: 60 },
      // Sem aula registrada: não está em risco, está sem aula.
      { studentId: "c", registros: 0, comparecimentos: 0 },
    ],
    teachers: [{ semChamada: 3 }, { semChamada: 2 }],
  };

  it("calcula os que os dados sustentam", async () => {
    const list = await createReportService(fakeRepository(estado)).indicators(2026, AGORA);

    expect(acha(list, "alunos_ativos")?.valor).toBe(58);
    expect(acha(list, "taxa_frequencia")?.valor).toBeCloseTo(0.94);
    expect(acha(list, "alunos_em_risco")?.valor).toBe(1);
    expect(acha(list, "pendencias_lancamento")?.valor).toBe(5);
  });

  /**
   * O ponto da tela. Um painel com quatro números chutados faz a direção
   * decidir sobre dado inventado; um com quatro linhas dizendo o que falta diz
   * o que construir.
   */
  it("os que não dá para medir vêm nulos, com o motivo", async () => {
    const list = await createReportService(fakeRepository(estado)).indicators(2026, AGORA);

    for (const key of [
      "taxa_ocupacao",
      "taxa_aprovacao",
      "evasao",
      "leitura_comunicados",
      "inadimplencia",
      "rematricula",
    ]) {
      const indicator = acha(list, key);
      expect(indicator?.valor).toBeNull();
      expect(indicator?.indisponivel).toBe(NO_DATA[key]);
    }
  });

  /** Todo indicador mostra a fórmula: número sem fórmula é fé. */
  it("todo indicador traz a fórmula", async () => {
    const list = await createReportService(fakeRepository(estado)).indicators(2026, AGORA);
    for (const indicator of list) {
      expect(indicator.formula.length).toBeGreaterThan(10);
    }
  });

  /**
   * Aluno matriculado que ainda não foi alocado em turma some de um `join`
   * com `classroom` — e some em silêncio. Ele é matrícula ativa tanto quanto
   * os outros, então a conta parte da situação, não da turma.
   */
  it("conta quem ainda não tem turma", async () => {
    const list = await createReportService(
      fakeRepository({
        situacoes: [
          { status: "ativo", total: 288 },
          { status: "documentacao_pendente", total: 15 },
        ],
        // Nenhuma turma: se a conta partisse daqui, daria zero.
        classrooms: [],
      }),
    ).indicators(2026, AGORA);

    expect(acha(list, "alunos_ativos")?.valor).toBe(303);
  });

  it("escola sem movimento não vira zero de fachada", async () => {
    const list = await createReportService(fakeRepository()).indicators(2026, AGORA);

    expect(acha(list, "alunos_ativos")?.valor).toBe(0);
    // Sem registro de chamada a frequência é indefinida, não 0%.
    expect(acha(list, "taxa_frequencia")?.valor).toBeNull();
  });
});

describe("turmasEmAlerta", () => {
  it("traz só as turmas abaixo dos 75%", async () => {
    const alerta = await createReportService(
      fakeRepository({
        attendanceRate: [
          {
            classroomId: "t1",
            classroomName: "6º A",
            registros: 100,
            comparecimentos: 90,
            alunos: 30,
          },
          {
            classroomId: "t2",
            classroomName: "7º B",
            registros: 100,
            comparecimentos: 70,
            alunos: 28,
          },
        ],
      }),
    ).classroomsAtRisk(2026);

    expect(alerta.map((t) => t.name)).toEqual(["7º B"]);
  });

  /** Turma sem chamada não está abaixo do mínimo — está sem frequência. */
  it("turma sem registro não entra no alerta", async () => {
    const alerta = await createReportService(
      fakeRepository({
        attendanceRate: [
          { classroomId: "t1", classroomName: "6º A", registros: 0, comparecimentos: 0, alunos: 0 },
        ],
      }),
    ).classroomsAtRisk(2026);

    expect(alerta).toEqual([]);
  });
});

describe("exportar", () => {
  it("nomeia o arquivo com o relatório, o ano e a data", async () => {
    const { name } = await createReportService(fakeRepository()).exportar(
      "frequencia-por-turma",
      2026,
      AGORA,
    );
    expect(name).toBe("frequencia-por-turma-2026-2026-09-22.csv");
  });

  it("monta o CSV com cabeçalho em português", async () => {
    const { conteudo } = await createReportService(
      fakeRepository({
        classrooms: [
          {
            classroomName: "6º A",
            gradeLevel: 6,
            total: 30,
            naSala: 28,
            documentacaoPendente: 2,
            manha: 30,
            tarde: 0,
            noite: 0,
          },
        ],
      }),
    ).exportar("alunos-por-turma", 2026, AGORA);

    const linhas = conteudo.replace("﻿", "").split("\r\n");
    expect(linhas[0]).toBe("Turma;Série;Total;Na sala;Documentação pendente;Manhã;Tarde;Noite");
    expect(linhas[1]).toBe("6º A;6;30;28;2;30;0;0");
  });

  /**
   * Turma sem chamada fica com a célula em branco, e não com "Não": ela não
   * está acima nem abaixo do mínimo — ela não tem frequência.
   */
  it("turma sem registro sai com frequência em branco", async () => {
    const { conteudo } = await createReportService(
      fakeRepository({
        attendanceRate: [{ classroomName: "6º A", registros: 0, comparecimentos: 0, alunos: 0 }],
      }),
    ).exportar("frequencia-por-turma", 2026, AGORA);

    const linha = conteudo.replace("﻿", "").split("\r\n")[1];
    expect(linha).toBe("6º A;0;0;0;;");
  });

  it("docente sem turma não divide por zero", async () => {
    const { conteudo } = await createReportService(
      fakeRepository({
        teachers: [{ teacherName: "Ana Lima", classrooms: 0, lessons: 0, semChamada: 0 }],
      }),
    ).exportar("carga-dos-docentes", 2026, AGORA);

    const linha = conteudo.replace("﻿", "").split("\r\n")[1];
    expect(linha).toBe("Ana Lima;0;0;0;");
  });
});
