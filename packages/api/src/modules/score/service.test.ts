import { describe, expect, it } from "vitest";

import type { AulaApurada, AvaliacaoApurada, PresencaApurada } from "./apuracao";
import type { ScoreRepository } from "./repository";
import { createScoreService, mediaDePontos, mediasPorBimestre, posicaoEm } from "./service";

interface EstadoDoDuble {
  saldos?: { subjectKind: string; subjectId: string; points: number }[];
  presencas?: PresencaApurada[];
  aulas?: AulaApurada[];
  avaliacoes?: AvaliacaoApurada[];
  lancamentos?: { studentId: string; term: number; score: number; weight: number }[];
  turma?: string[];
  alunos?: { id: string; name: string; classroomId: string | null }[];
  docentes?: { id: string; name: string }[];
}

/**
 * Dublê tipado como o repositório real, sem cast: quando a interface mudar,
 * isto para de compilar em vez de mentir.
 */
function fakeRepository(estado: EstadoDoDuble = {}) {
  const gravados: { ruleKey: string; subjectId: string }[] = [];
  let reconstruiu = 0;

  const saldos = estado.saldos ?? [];

  const repo: ScoreRepository = {
    appendEvents: async (eventos) => {
      gravados.push(...eventos.map((e) => ({ ruleKey: e.ruleKey, subjectId: e.subjectId })));
      return eventos.length;
    },
    rebuildBalances: async () => {
      reconstruiu += 1;
      return [];
    },
    balance: async ({ subjectKind, subjectId }) => {
      const achado = saldos.find((s) => s.subjectKind === subjectKind && s.subjectId === subjectId);
      return achado ? ({ points: achado.points } as never) : null;
    },
    scoreboard: async ({ subjectKind }) =>
      saldos
        .filter((s) => s.subjectKind === subjectKind)
        .map((s) => ({ subjectId: s.subjectId, points: s.points }))
        .sort((a, b) => b.points - a.points || a.subjectId.localeCompare(b.subjectId)),
    listEvents: async () => [],
    presencasDoAno: async () => estado.presencas ?? [],
    aulasDoAno: async () => estado.aulas ?? [],
    avaliacoesDoAno: async () => estado.avaliacoes ?? [],
    lancamentosPublicadosDoAno: async () => estado.lancamentos ?? [],
    studentsByIds: async (ids) => (estado.alunos ?? []).filter((a) => ids.includes(a.id)),
    teachersByIds: async (ids) => (estado.docentes ?? []).filter((d) => ids.includes(d.id)),
    studentIdsByClassroom: async () => estado.turma ?? [],
  };

  return { repo, gravados, contagem: () => reconstruiu };
}

describe("posicaoEm", () => {
  const placar = [
    { subjectId: "a", points: 300 },
    { subjectId: "b", points: 200 },
    { subjectId: "c", points: 200 },
    { subjectId: "d", points: 100 },
  ];

  /** Empate divide a posição: desempatar por id daria vantagem sem dado. */
  it("empate compartilha a posição, e o seguinte pula", () => {
    expect(posicaoEm(placar, "a").posicao).toBe(1);
    expect(posicaoEm(placar, "b").posicao).toBe(2);
    expect(posicaoEm(placar, "c").posicao).toBe(2);
    expect(posicaoEm(placar, "d").posicao).toBe(4);
  });

  it("quem não pontuou não tem posição, mas o total continua de pé", () => {
    expect(posicaoEm(placar, "ninguem")).toEqual({ posicao: null, total: 4 });
  });
});

describe("mediaDePontos", () => {
  it("é nula com grupo vazio, e não zero", () => {
    expect(mediaDePontos([])).toBeNull();
    expect(mediaDePontos([10, 20, 31])).toBe(20);
  });
});

describe("mediasPorBimestre", () => {
  it("pondera pelo peso da avaliação", () => {
    const medias = mediasPorBimestre([
      { studentId: "aluno-1", term: 1, score: 10, weight: 3 },
      { studentId: "aluno-1", term: 1, score: 6, weight: 1 },
    ]);
    expect(medias).toEqual([{ studentId: "aluno-1", term: 1, media: 9 }]);
  });

  it("separa aluno e bimestre", () => {
    const medias = mediasPorBimestre([
      { studentId: "a", term: 1, score: 8, weight: 1 },
      { studentId: "a", term: 2, score: 6, weight: 1 },
      { studentId: "b", term: 1, score: 5, weight: 1 },
    ]);
    expect(medias).toHaveLength(3);
  });
});

describe("apurar", () => {
  it("apura os cinco tipos de fato e refaz o saldo uma vez", async () => {
    const { repo, gravados, contagem } = fakeRepository({
      presencas: [{ id: "att-1", studentId: "aluno-1", date: "2026-03-02", status: "presente" }],
      aulas: [
        {
          id: "l-1",
          teacherId: "prof-1",
          date: "2026-03-02",
          attendanceRecordedAt: new Date("2026-03-02T20:00:00-03:00"),
          content: "Frações",
          homework: null,
        },
      ],
      avaliacoes: [
        {
          id: "av-1",
          teacherId: "prof-1",
          term: 1,
          appliedOn: "2026-03-02",
          status: "publicada",
          publishedAt: new Date("2026-03-04T12:00:00Z"),
          semLancamento: 0,
        },
      ],
    });

    const resultado = await createScoreService(repo).apurar(2026);

    // Uma presença só não ganha o mérito de frequência do ano: falta
    // denominador. É `MINIMO_DE_AULAS_PARA_MERITO` fazendo o seu trabalho.
    expect(gravados.map((g) => g.ruleKey).sort()).toEqual([
      "aluno.presenca",
      "professor.avaliacao_publicada",
      "professor.chamada_no_prazo",
      "professor.devolutiva_em_sete_dias",
      "professor.diario_preenchido",
    ]);
    expect(resultado).toMatchObject({ apurados: 5, academicYear: 2026 });
    expect(contagem()).toBe(1);
  });

  /** Sem fato nenhum a apuração não pode explodir — a escola pode estar vazia. */
  it("não quebra com escola sem movimento", async () => {
    const { repo } = fakeRepository();
    await expect(createScoreService(repo).apurar(2026)).resolves.toMatchObject({ apurados: 0 });
  });
});

describe("painel do aluno", () => {
  const estado: EstadoDoDuble = {
    saldos: [
      { subjectKind: "aluno", subjectId: "aluno-1", points: 200 },
      { subjectKind: "aluno", subjectId: "aluno-2", points: 300 },
      { subjectKind: "aluno", subjectId: "aluno-3", points: 100 },
      { subjectKind: "aluno", subjectId: "de-outra-turma", points: 9000 },
    ],
    turma: ["aluno-1", "aluno-2", "aluno-3", "aluno-sem-ponto"],
  };

  /**
   * O teste que mais importa desta PR. O §7.5 proíbe ranking nominal entre
   * alunos, e a garantia tem de estar na **forma do retorno** — não numa
   * checagem de tela que a próxima pessoa esquece.
   */
  it("nunca devolve lista de colegas, em nenhuma chave", async () => {
    const { repo } = fakeRepository(estado);
    const painel = await createScoreService(repo).doAluno({
      studentId: "aluno-1",
      classroomId: "turma-1",
      academicYear: 2026,
    });

    const serializado = JSON.stringify(painel);
    expect(serializado).not.toContain("aluno-2");
    expect(serializado).not.toContain("aluno-3");
    expect(Object.keys(painel).sort()).toEqual([
      "extrato",
      "mediaDaTurma",
      "nivel",
      "pontos",
      "posicao",
      "proximo",
      "totalNaTurma",
    ]);
  });

  it("posiciona dentro da turma, ignorando quem é de outra", async () => {
    const { repo } = fakeRepository(estado);
    const painel = await createScoreService(repo).doAluno({
      studentId: "aluno-1",
      classroomId: "turma-1",
      academicYear: 2026,
    });

    // 2º de 4: o aluno de 9000 pontos é de outra turma e não entra na conta.
    expect(painel.posicao).toBe(2);
    expect(painel.totalNaTurma).toBe(4);
  });

  /** "3º de 12" numa turma de 28 faria o aluno achar que metade sumiu. */
  it("o denominador é a turma inteira, não só quem pontuou", async () => {
    const { repo } = fakeRepository(estado);
    const painel = await createScoreService(repo).doAluno({
      studentId: "aluno-1",
      classroomId: "turma-1",
      academicYear: 2026,
    });

    // (200 + 300 + 100 + 0) / 4
    expect(painel.mediaDaTurma).toBe(150);
  });

  it("aluno sem turma tem pontos, mas não tem com quem se comparar", async () => {
    const { repo } = fakeRepository(estado);
    const painel = await createScoreService(repo).doAluno({
      studentId: "aluno-1",
      classroomId: null,
      academicYear: 2026,
    });

    expect(painel.pontos).toBe(200);
    expect(painel).toMatchObject({ posicao: null, totalNaTurma: 0, mediaDaTurma: null });
  });

  it("aluno que ainda não pontuou vê zero e o primeiro nível", async () => {
    const { repo } = fakeRepository(estado);
    const painel = await createScoreService(repo).doAluno({
      studentId: "aluno-sem-ponto",
      classroomId: "turma-1",
      academicYear: 2026,
    });

    expect(painel.pontos).toBe(0);
    expect(painel.nivel.ordem).toBe(1);
    expect(painel.posicao).toBeNull();
  });
});

describe("placar nominal", () => {
  it("numera do primeiro ao último e nomeia cada aluno", async () => {
    const { repo } = fakeRepository({
      saldos: [
        { subjectKind: "aluno", subjectId: "aluno-1", points: 100 },
        { subjectKind: "aluno", subjectId: "aluno-2", points: 300 },
      ],
      alunos: [
        { id: "aluno-1", name: "Ana", classroomId: "t1" },
        { id: "aluno-2", name: "Bruno", classroomId: "t1" },
      ],
    });

    const placar = await createScoreService(repo).rankingDeAlunos(2026);
    expect(placar.map((l) => [l.posicao, l.nome])).toEqual([
      [1, "Bruno"],
      [2, "Ana"],
    ]);
  });

  /** Aluno apagado não pode derrubar a tela da direção. */
  it("sobrevive a saldo de aluno que não existe mais", async () => {
    const { repo } = fakeRepository({
      saldos: [{ subjectKind: "aluno", subjectId: "fantasma", points: 10 }],
      alunos: [],
    });

    const placar = await createScoreService(repo).rankingDeAlunos(2026);
    expect(placar[0]?.nome).toBe("Aluno removido");
  });
});

describe("placar de professores", () => {
  it("resolve o nome pelo vínculo com a escola", async () => {
    const { repo } = fakeRepository({
      saldos: [{ subjectKind: "professor", subjectId: "prof-1", points: 500 }],
      docentes: [{ id: "prof-1", name: "Ricardo Alves" }],
    });

    const placar = await createScoreService(repo).rankingDeProfessores(2026);
    expect(placar[0]).toMatchObject({ posicao: 1, nome: "Ricardo Alves", pontos: 500 });
  });

  /**
   * Quem saiu da escola mantém os pontos do que fez — o fato aconteceu. A
   * linha precisa de rótulo, e mostrar o id cru do usuário numa tela da
   * direção seria vazar uma chave interna sem necessidade.
   */
  it("rotula quem perdeu o vínculo, sem mostrar o id", async () => {
    const { repo } = fakeRepository({
      saldos: [{ subjectKind: "professor", subjectId: "prof-antigo", points: 120 }],
      docentes: [],
    });

    const placar = await createScoreService(repo).rankingDeProfessores(2026);
    expect(placar[0]?.nome).toBe("Sem vínculo atual");
  });
});
