import { describe, expect, it } from "vitest";

import {
  AULAS_PARA_SEQUENCIA,
  type AulaApurada,
  type AvaliacaoApurada,
  anoDe,
  apurarAulas,
  apurarAvaliacoes,
  apurarEvolucao,
  apurarFrequenciaDoAno,
  apurarPresencas,
  MINIMO_DE_AULAS_PARA_MERITO,
  type PresencaApurada,
} from "./apuracao";

function presenca(over: Partial<PresencaApurada> & { id: string }): PresencaApurada {
  return { studentId: "aluno-1", date: "2026-03-02", status: "presente", ...over };
}

function aula(over: Partial<AulaApurada> & { id: string }): AulaApurada {
  return {
    teacherId: "prof-1",
    date: "2026-03-02",
    attendanceRecordedAt: null,
    content: null,
    homework: null,
    ...over,
  };
}

function avaliacao(over: Partial<AvaliacaoApurada> & { id: string }): AvaliacaoApurada {
  return {
    teacherId: "prof-1",
    term: 1,
    appliedOn: "2026-03-02",
    status: "publicada",
    publishedAt: new Date("2026-03-05T12:00:00Z"),
    semLancamento: 0,
    ...over,
  };
}

const chaves = (eventos: { ruleKey: string }[]) => eventos.map((e) => e.ruleKey);

describe("apurarPresencas", () => {
  it("dá mais pela presença que pelo atraso, e nada pela falta", () => {
    const eventos = apurarPresencas([
      presenca({ id: "a", status: "presente" }),
      presenca({ id: "b", status: "atraso", date: "2026-03-03" }),
      presenca({ id: "c", status: "falta", date: "2026-03-04" }),
    ]);

    expect(chaves(eventos)).toEqual(["aluno.presenca", "aluno.atraso"]);
    const [presente, atrasado] = eventos;
    expect(presente?.points).toBeGreaterThan(atrasado?.points ?? 0);
  });

  it("carimba o aluno, a origem e o ano da aula", () => {
    const [evento] = apurarPresencas([presenca({ id: "att-9", studentId: "aluno-7" })]);

    expect(evento).toMatchObject({
      subjectKind: "aluno",
      subjectId: "aluno-7",
      sourceKind: "attendance",
      sourceId: "att-9",
      academicYear: 2026,
      term: null,
    });
  });

  function dias(quantidade: number, status: PresencaApurada["status"], inicio = 1) {
    return Array.from({ length: quantidade }, (_, i) =>
      presenca({
        id: `att-${inicio + i}`,
        status,
        date: `2026-03-${String(inicio + i).padStart(2, "0")}`,
      }),
    );
  }

  it("premia a constância só ao fechar a décima aula", () => {
    const noventa = apurarPresencas(dias(AULAS_PARA_SEQUENCIA - 1, "presente"));
    expect(chaves(noventa)).not.toContain("aluno.sequencia_10");

    const dez = apurarPresencas(dias(AULAS_PARA_SEQUENCIA, "presente"));
    expect(chaves(dez).filter((k) => k === "aluno.sequencia_10")).toHaveLength(1);
  });

  /** Vinte aulas seguidas valem duas constâncias — não uma, nem uma por aula. */
  it("reinicia a contagem depois de premiar", () => {
    const eventos = apurarPresencas(dias(AULAS_PARA_SEQUENCIA * 2, "presente"));
    expect(chaves(eventos).filter((k) => k === "aluno.sequencia_10")).toHaveLength(2);
  });

  it("a falta quebra a sequência; o atraso não", () => {
    const comFalta = apurarPresencas([
      ...dias(5, "presente"),
      presenca({ id: "att-falta", status: "falta", date: "2026-03-06" }),
      ...dias(5, "presente", 7),
    ]);
    expect(chaves(comFalta)).not.toContain("aluno.sequencia_10");

    const comAtraso = apurarPresencas([
      ...dias(5, "presente"),
      presenca({ id: "att-atraso", status: "atraso", date: "2026-03-06" }),
      ...dias(4, "presente", 7),
    ]);
    expect(chaves(comAtraso)).toContain("aluno.sequencia_10");
  });

  /** A ordem vem daqui, não de um `ORDER BY` longe da regra. */
  it("ordena por data antes de contar a sequência", () => {
    const embaralhadas = [...dias(AULAS_PARA_SEQUENCIA, "presente")].reverse();
    expect(chaves(apurarPresencas(embaralhadas))).toContain("aluno.sequencia_10");
  });

  it("não mistura a sequência de alunos diferentes", () => {
    const eventos = apurarPresencas([
      ...dias(5, "presente").map((p) => ({ ...p, studentId: "aluno-1" })),
      ...dias(5, "presente", 6).map((p) => ({ ...p, studentId: "aluno-2", id: `b-${p.id}` })),
    ]);
    expect(chaves(eventos)).not.toContain("aluno.sequencia_10");
  });
});

describe("apurarFrequenciaDoAno", () => {
  /**
   * Datas espalhadas pelo ano. Gerar "2026-03-96" passaria neste teste, porque
   * a regra só compara texto e lê o ano — e deixaria uma data impossível na
   * fixture para alguém tropeçar depois.
   */
  function diaDoAno(indice: number): string {
    const mes = String(Math.floor(indice / 28) + 2).padStart(2, "0");
    const dia = String((indice % 28) + 1).padStart(2, "0");
    return `2026-${mes}-${dia}`;
  }

  function frequencia(compareceu: number, faltou: number) {
    return [
      ...Array.from({ length: compareceu }, (_, i) =>
        presenca({ id: `p-${i}`, status: "presente", date: diaDoAno(i) }),
      ),
      ...Array.from({ length: faltou }, (_, i) =>
        presenca({ id: `f-${i}`, status: "falta", date: diaDoAno(compareceu + i) }),
      ),
    ];
  }

  it("premia acima de 90%, e não exatamente 90%", () => {
    expect(apurarFrequenciaDoAno(frequencia(95, 5), 2026)).toHaveLength(1);
    expect(apurarFrequenciaDoAno(frequencia(90, 10), 2026)).toHaveLength(0);
  });

  /** Sem aula a frequência é indefinida, não 100%. */
  it("não premia quem não teve aula nenhuma", () => {
    expect(apurarFrequenciaDoAno([], 2026)).toHaveLength(0);
  });

  /**
   * Sem piso, quem teve uma aula e compareceu teria 100% e ganharia mais que
   * quem veio a 95 de 100. O percentual precisa de denominador para querer
   * dizer alguma coisa.
   */
  it("exige um mínimo de aulas antes de premiar o percentual", () => {
    expect(apurarFrequenciaDoAno(frequencia(1, 0), 2026)).toHaveLength(0);
    expect(
      apurarFrequenciaDoAno(frequencia(MINIMO_DE_AULAS_PARA_MERITO - 1, 0), 2026),
    ).toHaveLength(0);
    expect(apurarFrequenciaDoAno(frequencia(MINIMO_DE_AULAS_PARA_MERITO, 0), 2026)).toHaveLength(1);
  });

  it("ignora aula de outro ano letivo", () => {
    const eventos = apurarFrequenciaDoAno([presenca({ id: "velha", date: "2025-03-02" })], 2026);
    expect(eventos).toHaveLength(0);
  });

  /** A chave é o ano: reapurar em dezembro não pode somar de novo. */
  it("usa o ano como origem, para não duplicar ao reapurar", () => {
    const [evento] = apurarFrequenciaDoAno(frequencia(95, 5), 2026);
    expect(evento).toMatchObject({ sourceKind: "ano", sourceId: "2026" });
  });
});

describe("apurarEvolucao", () => {
  it("premia quem subiu, e não quem só está alto", () => {
    const eventos = apurarEvolucao(
      [
        { studentId: "subiu", term: 1, media: 4 },
        { studentId: "subiu", term: 2, media: 6 },
        { studentId: "estavel", term: 1, media: 9.5 },
        { studentId: "estavel", term: 2, media: 9.5 },
        { studentId: "caiu", term: 1, media: 8 },
        { studentId: "caiu", term: 2, media: 7 },
      ],
      2026,
    );

    expect(eventos.map((e) => e.subjectId)).toEqual(["subiu"]);
    expect(eventos[0]).toMatchObject({ term: 2, sourceId: "2026-2" });
  });

  /** Comparar contra bimestre sem nota inventaria evolução que ninguém fez. */
  it("exige nota publicada nos dois bimestres", () => {
    const eventos = apurarEvolucao(
      [
        { studentId: "aluno-1", term: 1, media: null },
        { studentId: "aluno-1", term: 2, media: 8 },
      ],
      2026,
    );
    expect(eventos).toHaveLength(0);
  });

  it("não compara bimestres salteados", () => {
    const eventos = apurarEvolucao(
      [
        { studentId: "aluno-1", term: 1, media: 4 },
        { studentId: "aluno-1", term: 3, media: 9 },
      ],
      2026,
    );
    expect(eventos).toHaveLength(0);
  });
});

describe("apurarAulas", () => {
  it("não pontua aula sem chamada registrada", () => {
    expect(apurarAulas([aula({ id: "l-1" })])).toHaveLength(0);
  });

  it("premia a chamada feita até o fim do dia da aula", () => {
    const noPrazo = apurarAulas([
      aula({ id: "l-1", attendanceRecordedAt: new Date("2026-03-02T23:00:00-03:00") }),
    ]);
    expect(chaves(noPrazo)).toContain("professor.chamada_no_prazo");

    const atrasada = apurarAulas([
      aula({ id: "l-2", attendanceRecordedAt: new Date("2026-03-03T08:00:00-03:00") }),
    ]);
    expect(chaves(atrasada)).not.toContain("professor.chamada_no_prazo");
  });

  /**
   * O corte é no fuso da escola. Num servidor em UTC, a chamada das 21h do dia
   * da aula cairia no dia seguinte e o professor perderia o ponto sem motivo.
   */
  it("corta o prazo no fuso da escola, não no relógio do processo", () => {
    const eventos = apurarAulas([
      aula({ id: "l-1", attendanceRecordedAt: new Date("2026-03-02T21:00:00-03:00") }),
    ]);
    expect(chaves(eventos)).toContain("professor.chamada_no_prazo");
  });

  it("premia o diário com conteúdo ou com tarefa, e ignora espaço em branco", () => {
    const registrada = { attendanceRecordedAt: new Date("2026-03-02T10:00:00-03:00") };

    expect(chaves(apurarAulas([aula({ id: "a", ...registrada, content: "Frações" })]))).toContain(
      "professor.diario_preenchido",
    );
    expect(chaves(apurarAulas([aula({ id: "b", ...registrada, homework: "Lista 3" })]))).toContain(
      "professor.diario_preenchido",
    );
    expect(chaves(apurarAulas([aula({ id: "c", ...registrada, content: "   " })]))).not.toContain(
      "professor.diario_preenchido",
    );
  });

  /**
   * A regra é sobre o registro, nunca sobre o conteúdo dele. Se marcar falta
   * valesse menos que marcar presença, o caminho mais curto para o ponto seria
   * mentir na chamada — e a frequência é o dado mais crítico do sistema.
   */
  it("não olha para quem faltou", () => {
    const eventos = apurarAulas([
      aula({ id: "l-1", attendanceRecordedAt: new Date("2026-03-02T10:00:00-03:00") }),
    ]);
    expect(chaves(eventos)).toEqual(["professor.chamada_no_prazo"]);
  });
});

describe("apurarAvaliacoes", () => {
  it("ignora rascunho", () => {
    expect(apurarAvaliacoes([avaliacao({ id: "a-1", status: "rascunho" })])).toHaveLength(0);
  });

  /** Publicar com aluno sem lançamento deixa buraco no boletim. */
  it("só premia publicação sem pendência", () => {
    expect(chaves(apurarAvaliacoes([avaliacao({ id: "a-1" })]))).toContain(
      "professor.avaliacao_publicada",
    );
    expect(chaves(apurarAvaliacoes([avaliacao({ id: "a-2", semLancamento: 3 })]))).not.toContain(
      "professor.avaliacao_publicada",
    );
  });

  it("premia devolutiva dentro de sete dias da aplicação", () => {
    const rapida = apurarAvaliacoes([
      avaliacao({
        id: "a-1",
        appliedOn: "2026-03-02",
        publishedAt: new Date("2026-03-09T12:00:00Z"),
      }),
    ]);
    expect(chaves(rapida)).toContain("professor.devolutiva_em_sete_dias");

    const lenta = apurarAvaliacoes([
      avaliacao({
        id: "a-2",
        appliedOn: "2026-03-02",
        publishedAt: new Date("2026-03-10T12:00:00Z"),
      }),
    ]);
    expect(chaves(lenta)).not.toContain("professor.devolutiva_em_sete_dias");
  });

  /** Cadastro incompleto não é mérito. */
  it("não chuta devolutiva sem data de aplicação", () => {
    const eventos = apurarAvaliacoes([avaliacao({ id: "a-1", appliedOn: null })]);
    expect(chaves(eventos)).not.toContain("professor.devolutiva_em_sete_dias");
  });

  it("guarda o bimestre da avaliação", () => {
    const [evento] = apurarAvaliacoes([avaliacao({ id: "a-1", term: 3 })]);
    expect(evento).toMatchObject({ term: 3, sourceKind: "assessment", sourceId: "a-1" });
  });
});

describe("anoDe", () => {
  it("lê o ano da data civil da aula", () => {
    expect(anoDe("2026-01-05")).toBe(2026);
    expect(anoDe("2025-12-31")).toBe(2025);
  });
});
