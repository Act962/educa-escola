import { describe, expect, it } from "vitest";

import { APP_ROLES, roles } from "./permissions";

const can = (
  role: keyof typeof roles,
  request: Parameters<(typeof roles)["owner"]["authorize"]>[0],
) => roles[role].authorize(request).success;

describe("papéis da escola", () => {
  it("expõe exatamente os quatro papéis do produto", () => {
    expect([...APP_ROLES].sort()).toEqual(["admin", "owner", "student", "teacher"]);
  });

  it("só o owner pode excluir a escola", () => {
    expect(can("owner", { organization: ["delete"] })).toBe(true);
    expect(can("admin", { organization: ["delete"] })).toBe(false);
    expect(can("teacher", { organization: ["delete"] })).toBe(false);
    expect(can("student", { organization: ["delete"] })).toBe(false);
  });

  it("administrativo opera turmas e convites", () => {
    expect(can("admin", { classroom: ["create", "update", "delete"] })).toBe(true);
    expect(can("admin", { invitation: ["create"] })).toBe(true);
    expect(can("admin", { organization: ["update"] })).toBe(true);
  });

  it("professor lê turmas mas não administra", () => {
    expect(can("teacher", { classroom: ["read"] })).toBe(true);
    expect(can("teacher", { enrollment: ["read"] })).toBe(true);
    expect(can("teacher", { classroom: ["create"] })).toBe(false);
    expect(can("teacher", { member: ["create"] })).toBe(false);
    expect(can("teacher", { invitation: ["create"] })).toBe(false);
  });

  it("estudante só lê a própria turma", () => {
    expect(can("student", { classroom: ["read"] })).toBe(true);
    expect(can("student", { classroom: ["update"] })).toBe(false);
    expect(can("student", { enrollment: ["read"] })).toBe(false);
    expect(can("student", { member: ["create"] })).toBe(false);
  });

  it("professor registra chamada e nota, mas não cadastra aluno", () => {
    expect(can("teacher", { attendance: ["create", "update"] })).toBe(true);
    expect(can("teacher", { grade: ["create", "update"] })).toBe(true);
    expect(can("teacher", { assessment: ["publish"] })).toBe(true);
    expect(can("teacher", { student: ["read"] })).toBe(true);
    expect(can("teacher", { student: ["create"] })).toBe(false);
    expect(can("teacher", { student: ["delete"] })).toBe(false);
  });

  /**
   * O aluno é o papel em que um deslize custa caro: qualquer escrita aqui
   * significaria alguém alterando a própria nota ou a própria frequência.
   */
  it("estudante só lê, e nunca publica nem escreve", () => {
    expect(can("student", { grade: ["read"] })).toBe(true);
    expect(can("student", { assessment: ["read"] })).toBe(true);
    expect(can("student", { attendance: ["read"] })).toBe(true);

    expect(can("student", { grade: ["create"] })).toBe(false);
    expect(can("student", { grade: ["update"] })).toBe(false);
    expect(can("student", { attendance: ["create"] })).toBe(false);
    expect(can("student", { assessment: ["publish"] })).toBe(false);
    expect(can("student", { lesson: ["update"] })).toBe(false);
  });

  it("só direção e secretaria cadastram aluno", () => {
    for (const role of APP_ROLES) {
      const expected = role === "owner" || role === "admin";
      expect(can(role, { student: ["create"] })).toBe(expected);
      expect(can(role, { student: ["delete"] })).toBe(expected);
    }
  });

  it("nenhum papel além do owner/admin escreve matrícula", () => {
    for (const role of APP_ROLES) {
      const expected = role === "owner" || role === "admin";
      expect(can(role, { enrollment: ["create"] })).toBe(expected);
    }
  });
});

describe("apps do Órbita", () => {
  it("todo papel de trabalho enxerga a lista de apps", () => {
    for (const role of ["owner", "admin", "teacher"] as const) {
      expect(can(role, { app: ["read"] })).toBe(true);
    }
  });

  /**
   * Instalar é contratar: cria organização no Órbita e debita Stars da escola.
   * Secretaria abre o que já está instalado; quem assina é a direção.
   */
  it("só o owner instala e remove app", () => {
    for (const role of APP_ROLES) {
      const esperado = role === "owner";
      expect(can(role, { app: ["install"] })).toBe(esperado);
      expect(can(role, { app: ["remove"] })).toBe(esperado);
    }
  });

  it("aluno não vê a aba de apps", () => {
    expect(can("student", { app: ["read"] })).toBe(false);
  });
});

describe("pontuação e placar", () => {
  it("todo papel vê os próprios pontos", () => {
    for (const role of APP_ROLES) {
      expect(can(role, { score: ["read"] })).toBe(true);
    }
  });

  /** Apurar reprocessa o ano inteiro da escola — é escrita em massa. */
  it("só quem responde pela escola reprocessa a apuração", () => {
    expect(can("owner", { score: ["apurar"] })).toBe(true);
    expect(can("admin", { score: ["apurar"] })).toBe(true);
    expect(can("teacher", { score: ["apurar"] })).toBe(false);
    expect(can("student", { score: ["apurar"] })).toBe(false);
  });

  /**
   * O §7.5 do requisito proíbe classificação nominal entre alunos. Esta é a
   * barreira: sem `ranking: read`, as procedures de placar não abrem.
   */
  it("aluno e professor não leem placar nominal", () => {
    expect(can("student", { ranking: ["read"] })).toBe(false);
    expect(can("teacher", { ranking: ["read"] })).toBe(false);
    expect(can("admin", { ranking: ["read"] })).toBe(true);
    expect(can("owner", { ranking: ["read"] })).toBe(true);
  });

  /** Expor o nome da escola num placar externo é decisão da direção. */
  it("só a direção adere a placar externo", () => {
    expect(can("owner", { ranking: ["opt_in"] })).toBe(true);
    expect(can("admin", { ranking: ["opt_in"] })).toBe(false);
  });

  /**
   * Ler dado de outra escola é o que a arquitetura inteira existe para
   * impedir. Nenhum papel tem esta ação — ela entra na PR do placar entre
   * escolas, com aval explícito, e este teste é o que obriga a decisão a ser
   * consciente em vez de herdada.
   */
  it("nenhum papel lê placar de outra escola", () => {
    for (const role of APP_ROLES) {
      expect(can(role, { ranking: ["read_cross_school"] })).toBe(false);
    }
  });
});

describe("corpo docente", () => {
  /**
   * A lista carrega pendência de colega — dado de pessoal, não acadêmico. Por
   * isso `faculty` é recurso próprio e não herda de quem lê aluno.
   */
  it("só a gestão enxerga o corpo docente", () => {
    expect(can("owner", { faculty: ["read"] })).toBe(true);
    expect(can("admin", { faculty: ["read"] })).toBe(true);
    expect(can("teacher", { faculty: ["read"] })).toBe(false);
    expect(can("student", { faculty: ["read"] })).toBe(false);
  });

  it("quem lê aluno não passa a ler docente por herança", () => {
    expect(can("teacher", { student: ["read"] })).toBe(true);
    expect(can("teacher", { faculty: ["read"] })).toBe(false);
  });
});

describe("calendário", () => {
  /** Esconder quando tem aula de quem estuda ou dá aula não protege nada. */
  it("todo papel lê o calendário", () => {
    for (const role of APP_ROLES) {
      expect(can(role, { calendar: ["read"] })).toBe(true);
    }
  });

  it("só a gestão monta o calendário", () => {
    expect(can("owner", { calendar: ["manage"] })).toBe(true);
    expect(can("admin", { calendar: ["manage"] })).toBe(true);
    expect(can("teacher", { calendar: ["manage"] })).toBe(false);
    expect(can("student", { calendar: ["manage"] })).toBe(false);
  });
});
