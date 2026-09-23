import { describe, expect, it } from "vitest";

import { roles } from "./permissions";
import {
  ALFABETO_SENHA,
  ALUNO_COM_CONTA,
  bimestreDe,
  colegasDeDemonstracao,
  DISCIPLINA_COM_PENDENCIA,
  DISCIPLINAS_BASE,
  diaLetivoDe,
  matriculaSeguinte,
  PERFIS,
  padraoDeMatricula,
  resolverPerfis,
  senhaAleatoria,
  TAMANHO_SENHA,
} from "./seed-producao-data";

/**
 * O seed de produção escreve em banco de escola de verdade, e o que ele decide
 * antes de escrever é o que estes testes guardam: que existe um acesso por
 * papel, que e-mail faltando é erro em vez de endereço inventado, que a senha
 * é gerada de verdade e que a matrícula continua a sequência da escola.
 */

describe("PERFIS", () => {
  it("cobre exatamente uma vez cada papel do RBAC", () => {
    const papeis = PERFIS.map((perfil) => perfil.role).sort();
    expect(papeis).toEqual(Object.keys(roles).sort());
  });

  it("não repete a parte local do e-mail", () => {
    const locais = PERFIS.map((perfil) => perfil.emailLocal);
    expect(new Set(locais).size).toBe(locais.length);
  });
});

describe("DISCIPLINAS_BASE", () => {
  it("não repete nome — o índice único da escola recusaria", () => {
    const nomes = DISCIPLINAS_BASE.map((disciplina) => disciplina.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("não repete sigla: é ela que aparece na grade horária", () => {
    const siglas = DISCIPLINAS_BASE.map((disciplina) => disciplina.code);
    expect(new Set(siglas).size).toBe(siglas.length);
  });

  it("contém a disciplina que recebe a pendência do roteiro", () => {
    // Se sumisse daqui, a Prova 2 em rascunho cairia numa disciplina qualquer —
    // e o roteiro da apresentação apontaria para a tela errada.
    expect(DISCIPLINAS_BASE.map((disciplina) => disciplina.name)).toContain(
      DISCIPLINA_COM_PENDENCIA,
    );
  });
});

describe("senhaAleatoria", () => {
  it("usa o tamanho pedido", () => {
    expect(senhaAleatoria()).toHaveLength(TAMANHO_SENHA);
    expect(senhaAleatoria(24)).toHaveLength(24);
  });

  it("não usa caractere ambíguo — a senha é ditada e digitada à mão", () => {
    const senha = senhaAleatoria(400);
    for (const caractere of senha) expect(ALFABETO_SENHA).toContain(caractere);
    expect(senha).not.toMatch(/[O0Il1o]/);
  });

  it("não repete entre chamadas", () => {
    const geradas = new Set(Array.from({ length: 50 }, () => senhaAleatoria()));
    expect(geradas.size).toBe(50);
  });
});

describe("resolverPerfis", () => {
  it("deriva o e-mail do domínio, sem o arroba e em minúsculas", () => {
    const perfis = resolverPerfis({ dominio: "@Escola-X.BR" });
    expect(perfis.map((perfil) => perfil.email)).toEqual([
      "direcao@escola-x.br",
      "secretaria@escola-x.br",
      "professor@escola-x.br",
      "aluno@escola-x.br",
    ]);
  });

  it("e-mail explícito ganha do derivado", () => {
    const [direcao] = resolverPerfis({
      dominio: "escola-x.br",
      emails: { direcao: "Maria.Diretora@Gmail.com" },
    });
    expect(direcao?.email).toBe("maria.diretora@gmail.com");
  });

  it("recusa em vez de inventar endereço quando não há de onde tirar", () => {
    expect(() => resolverPerfis({ emails: { direcao: "maria@escola-x.br" } })).toThrow(
      /--dominio ou --email-secretaria/,
    );
  });

  it("gera senha própria por acesso, e marca a que veio por flag", () => {
    const perfis = resolverPerfis({
      dominio: "escola-x.br",
      senhas: { aluno: "senha-da-flag" },
    });

    const geradas = perfis.filter((perfil) => perfil.senhaGerada);
    expect(geradas).toHaveLength(3);
    expect(new Set(geradas.map((perfil) => perfil.senha)).size).toBe(3);

    const aluno = perfis.find((perfil) => perfil.key === "aluno");
    expect(aluno?.senha).toBe("senha-da-flag");
    expect(aluno?.senhaGerada).toBe(false);
  });

  it("usa o nome padrão do papel quando nenhum vem", () => {
    const perfis = resolverPerfis({ dominio: "escola-x.br", nomes: { professor: "  " } });
    expect(perfis.find((perfil) => perfil.key === "professor")?.nome).toBe("Professor(a)");
  });
});

describe("diaLetivoDe", () => {
  it("usa o fuso da escola, não o UTC — 21h de São Paulo ainda é hoje", () => {
    // 2026-09-23T00:30Z é 21h30 do dia 22 em São Paulo. Foi exatamente aqui que
    // o seed datou as aulas de amanhã e a pendência de chamada sumiu da fila da
    // direção, que só conta aula com data anterior à de hoje.
    const noite = new Date("2026-09-23T00:30:00Z");

    expect(diaLetivoDe(noite)).toBe("2026-09-22");
    expect(noite.toISOString().slice(0, 10)).toBe("2026-09-23");
  });

  it("respeita outro fuso quando a escola tem o seu", () => {
    const instante = new Date("2026-09-23T00:30:00Z");
    expect(diaLetivoDe(instante, "America/Rio_Branco")).toBe("2026-09-22");
    expect(diaLetivoDe(instante, "UTC")).toBe("2026-09-23");
  });
});

describe("bimestreDe", () => {
  it("segue o calendário escolar, não o trimestre civil", () => {
    const bimestre = (mes: number) => bimestreDe(`2026-${String(mes).padStart(2, "0")}-15`);

    expect([bimestre(2), bimestre(3), bimestre(4)]).toEqual([1, 1, 1]);
    expect([bimestre(5), bimestre(6), bimestre(7)]).toEqual([2, 2, 2]);
    expect([bimestre(8), bimestre(9)]).toEqual([3, 3]);
    expect([bimestre(10), bimestre(11), bimestre(12)]).toEqual([4, 4, 4]);
  });

  it("põe janeiro no 1º: não existe bimestre zero", () => {
    expect(bimestreDe("2026-01-10")).toBe(1);
  });

  it("lê o mês do texto: o primeiro de outubro é 4º bimestre, não 3º", () => {
    expect(bimestreDe("2026-10-01")).toBe(4);
  });
});

describe("colegasDeDemonstracao", () => {
  const colegas = colegasDeDemonstracao();

  it("tem turma cheia o bastante para os painéis mostrarem número", () => {
    expect(colegas.length).toBeGreaterThan(20);
  });

  it("sai sem matrícula: quem numera é a sequência da escola", () => {
    for (const colega of colegas) {
      expect(colega).not.toHaveProperty("registration");
    }
  });

  it("não repete nome — a listagem da direção já exibiu oito homônimas", () => {
    const nomes = colegas.map((colega) => colega.name);
    expect(new Set(nomes).size).toBe(nomes.length);
  });

  it("traz alguém abaixo dos 75% da LDB, que é o recorte de risco", () => {
    expect(colegas.some((colega) => colega.attendance < 0.75)).toBe(true);
  });

  it("traz documentação pendente, que conta como matriculado", () => {
    expect(colegas.some((colega) => colega.status === "documentacao_pendente")).toBe(true);
  });

  it("não traz transferido: numa turma só, aluno fora da sala confunde", () => {
    expect(colegas.some((colega) => colega.status === "transferido")).toBe(false);
  });

  it("é estável entre chamadas — apresentação não se ensaia com número que muda", () => {
    expect(colegasDeDemonstracao()).toEqual(colegas);
  });
});

describe("ALUNO_COM_CONTA", () => {
  it("não tem frequência cheia: 100% não mostra o cálculo funcionando", () => {
    expect(ALUNO_COM_CONTA.attendance).toBeLessThan(1);
    expect(ALUNO_COM_CONTA.attendance).toBeGreaterThan(0.75);
    expect(ALUNO_COM_CONTA.lates).toBeGreaterThan(0);
  });

  it("tem aptidão escrita, e folgada acima da média de aprovação", () => {
    // Sem aptidão explícita ele herdaria o piso da faixa (5,4) e o boletim da
    // apresentação abria em recuperação em quase toda disciplina.
    expect(ALUNO_COM_CONTA.aptitude).toBeGreaterThan(7);
    expect(ALUNO_COM_CONTA.aptitude).toBeLessThanOrEqual(10);
  });
});

describe("matriculaSeguinte", () => {
  it("começa em 0001 numa escola sem aluno no ano", () => {
    expect(matriculaSeguinte(null, 2026)).toBe("2026-0001");
  });

  it("continua a sequência da escola", () => {
    expect(matriculaSeguinte("2026-0041", 2026)).toBe("2026-0042");
  });

  it("ignora matrícula de outro ano — a sequência é por ano", () => {
    expect(matriculaSeguinte("2025-0300", 2026)).toBe("2026-0001");
  });

  it("casa só o formato canônico do ano", () => {
    expect(padraoDeMatricula(2026)).toBe("2026-____");
  });
});
