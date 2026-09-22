import { describe, expect, it } from "vitest";

import { roles } from "./permissions";
import {
  ALFABETO_SENHA,
  DISCIPLINAS_BASE,
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
