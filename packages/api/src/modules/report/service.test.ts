import { describe, expect, it } from "vitest";

import { SEM_DADO, taxa } from "./indicators";
import type { ReportRepository } from "./repository";
import { createReportService } from "./service";

const AGORA = new Date("2026-09-22T12:00:00Z");

type Turma = Awaited<ReturnType<ReportRepository["alunosPorTurma"]>>[number];
type Freq = Awaited<ReturnType<ReportRepository["frequenciaPorTurma"]>>[number];
type Docente = Awaited<ReturnType<ReportRepository["cargaPorDocente"]>>[number];

interface Estado {
  turmas?: Partial<Turma>[];
  situacoes?: { status: string; total: number }[];
  frequencia?: Partial<Freq>[];
  porAluno?: { studentId: string; registros: number; comparecimentos: number }[];
  docentes?: Partial<Docente>[];
}

function fakeRepository(estado: Estado = {}): ReportRepository {
  return {
    alunosPorTurma: async () => (estado.turmas ?? []) as Turma[],
    movimentacao: async () => (estado.situacoes ?? []) as never,
    frequenciaPorTurma: async () => (estado.frequencia ?? []) as Freq[],
    frequenciaPorAluno: async () => estado.porAluno ?? [],
    cargaPorDocente: async () => (estado.docentes ?? []) as Docente[],
  };
}

const acha = <T extends { chave: string }>(lista: T[], chave: string) =>
  lista.find((i) => i.chave === chave);

describe("taxa", () => {
  it("é nula sem denominador, nunca zero", () => {
    expect(taxa(0, 0)).toBeNull();
    expect(taxa(9, 10)).toBe(0.9);
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
    frequencia: [{ registros: 100, comparecimentos: 94 }],
    porAluno: [
      { studentId: "a", registros: 100, comparecimentos: 95 },
      { studentId: "b", registros: 100, comparecimentos: 60 },
      // Sem aula registrada: não está em risco, está sem aula.
      { studentId: "c", registros: 0, comparecimentos: 0 },
    ],
    docentes: [{ semChamada: 3 }, { semChamada: 2 }],
  };

  it("calcula os que os dados sustentam", async () => {
    const lista = await createReportService(fakeRepository(estado)).indicadores(2026, AGORA);

    expect(acha(lista, "alunos_ativos")?.valor).toBe(58);
    expect(acha(lista, "taxa_frequencia")?.valor).toBeCloseTo(0.94);
    expect(acha(lista, "alunos_em_risco")?.valor).toBe(1);
    expect(acha(lista, "pendencias_lancamento")?.valor).toBe(5);
  });

  /**
   * O ponto da tela. Um painel com quatro números chutados faz a direção
   * decidir sobre dado inventado; um com quatro linhas dizendo o que falta diz
   * o que construir.
   */
  it("os que não dá para medir vêm nulos, com o motivo", async () => {
    const lista = await createReportService(fakeRepository(estado)).indicadores(2026, AGORA);

    for (const chave of [
      "taxa_ocupacao",
      "taxa_aprovacao",
      "evasao",
      "leitura_comunicados",
      "inadimplencia",
      "rematricula",
    ]) {
      const indicador = acha(lista, chave);
      expect(indicador?.valor).toBeNull();
      expect(indicador?.indisponivel).toBe(SEM_DADO[chave]);
    }
  });

  /** Todo indicador mostra a fórmula: número sem fórmula é fé. */
  it("todo indicador traz a fórmula", async () => {
    const lista = await createReportService(fakeRepository(estado)).indicadores(2026, AGORA);
    for (const indicador of lista) {
      expect(indicador.formula.length).toBeGreaterThan(10);
    }
  });

  /**
   * Aluno matriculado que ainda não foi alocado em turma some de um `join`
   * com `classroom` — e some em silêncio. Ele é matrícula ativa tanto quanto
   * os outros, então a conta parte da situação, não da turma.
   */
  it("conta quem ainda não tem turma", async () => {
    const lista = await createReportService(
      fakeRepository({
        situacoes: [
          { status: "ativo", total: 288 },
          { status: "documentacao_pendente", total: 15 },
        ],
        // Nenhuma turma: se a conta partisse daqui, daria zero.
        turmas: [],
      }),
    ).indicadores(2026, AGORA);

    expect(acha(lista, "alunos_ativos")?.valor).toBe(303);
  });

  it("escola sem movimento não vira zero de fachada", async () => {
    const lista = await createReportService(fakeRepository()).indicadores(2026, AGORA);

    expect(acha(lista, "alunos_ativos")?.valor).toBe(0);
    // Sem registro de chamada a frequência é indefinida, não 0%.
    expect(acha(lista, "taxa_frequencia")?.valor).toBeNull();
  });
});

describe("turmasEmAlerta", () => {
  it("traz só as turmas abaixo dos 75%", async () => {
    const alerta = await createReportService(
      fakeRepository({
        frequencia: [
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
    ).turmasEmAlerta(2026);

    expect(alerta.map((t) => t.nome)).toEqual(["7º B"]);
  });

  /** Turma sem chamada não está abaixo do mínimo — está sem frequência. */
  it("turma sem registro não entra no alerta", async () => {
    const alerta = await createReportService(
      fakeRepository({
        frequencia: [
          { classroomId: "t1", classroomName: "6º A", registros: 0, comparecimentos: 0, alunos: 0 },
        ],
      }),
    ).turmasEmAlerta(2026);

    expect(alerta).toEqual([]);
  });
});

describe("exportar", () => {
  it("nomeia o arquivo com o relatório, o ano e a data", async () => {
    const { nome } = await createReportService(fakeRepository()).exportar(
      "frequencia-por-turma",
      2026,
      AGORA,
    );
    expect(nome).toBe("frequencia-por-turma-2026-2026-09-22.csv");
  });

  it("monta o CSV com cabeçalho em português", async () => {
    const { conteudo } = await createReportService(
      fakeRepository({
        turmas: [
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
        frequencia: [{ classroomName: "6º A", registros: 0, comparecimentos: 0, alunos: 0 }],
      }),
    ).exportar("frequencia-por-turma", 2026, AGORA);

    const linha = conteudo.replace("﻿", "").split("\r\n")[1];
    expect(linha).toBe("6º A;0;0;0;;");
  });

  it("docente sem turma não divide por zero", async () => {
    const { conteudo } = await createReportService(
      fakeRepository({
        docentes: [{ teacherName: "Ana Lima", turmas: 0, aulas: 0, semChamada: 0 }],
      }),
    ).exportar("carga-dos-docentes", 2026, AGORA);

    const linha = conteudo.replace("﻿", "").split("\r\n")[1];
    expect(linha).toBe("Ana Lima;0;0;0;");
  });
});
