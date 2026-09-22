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

describe("configurações da instituição", () => {
  /**
   * A tela de Configurações não tem recurso próprio no RBAC: ela se apoia em
   * `organization: ["update"]`, que já existia. Este teste é o que torna essa
   * escolha explícita — se um dia alguém der `organization` ao professor por
   * outro motivo, a tela de configurações abre junto, e a falha aparece aqui
   * em vez de em produção.
   */
  it("só direção e secretaria configuram a escola", () => {
    for (const role of APP_ROLES) {
      const esperado = role === "owner" || role === "admin";
      expect(can(role, { organization: ["update"] })).toBe(esperado);
    }
  });

  /**
   * A leitura das configurações usa a mesma permissão da escrita, porque a
   * tela lista nome e e-mail de quem tem acesso total — mapa de quem atacar.
   */
  it("quem não configura também não lê a lista de quem tem acesso total", () => {
    expect(can("teacher", { organization: ["update"] })).toBe(false);
    expect(can("student", { organization: ["update"] })).toBe(false);
  });
});

describe("Astro", () => {
  /** A credencial do modelo é chave de gasto: quem assina responde pela escola. */
  it("só a gestão configura o modelo", () => {
    for (const role of APP_ROLES) {
      const esperado = role === "owner" || role === "admin";
      expect(can(role, { assistant: ["manage"] })).toBe(esperado);
    }
  });

  /**
   * Não existe ação de "usar" no RBAC de propósito: quem pode perguntar é
   * decidido na configuração da escola, porque ela precisa abrir para o aluno
   * sem mexer em papel.
   */
  it("professor e aluno não têm nada de `assistant`", () => {
    expect(can("teacher", { assistant: ["manage"] })).toBe(false);
    expect(can("student", { assistant: ["manage"] })).toBe(false);
  });
});

describe("programa de indicações", () => {
  /** Desenhar a regra de desconto é decisão comercial da direção. */
  it("só a gestão configura e enxerga quem indicou quem", () => {
    for (const role of APP_ROLES) {
      const esperado = role === "owner" || role === "admin";
      expect(can(role, { referral: ["manage"] })).toBe(esperado);
      expect(can(role, { referral: ["read"] })).toBe(esperado);
    }
  });

  /**
   * O aluno vê o próprio link e mesmo assim não tem `referral`. A permissão
   * cobre a lista nominal — quem indicou quem, nome de família e de quem se
   * matriculou. A tela dele resolve por identidade, como "Meu perfil".
   */
  it("aluno divulga sem ganhar permissão de leitura da lista", () => {
    expect(can("student", { referral: ["read"] })).toBe(false);
  });

  it("professor fica de fora: ele não tem mensalidade para descontar", () => {
    expect(can("teacher", { referral: ["read"] })).toBe(false);
    expect(can("teacher", { referral: ["manage"] })).toBe(false);
  });
});

describe("comunicados", () => {
  it("todo papel recebe comunicado", () => {
    for (const role of APP_ROLES) {
      expect(can(role, { communication: ["read"] })).toBe(true);
    }
  });

  /** Comunicado institucional não se desfaz depois de lido (§8.3). */
  it("só a gestão escreve para a escola", () => {
    expect(can("owner", { communication: ["manage"] })).toBe(true);
    expect(can("admin", { communication: ["manage"] })).toBe(true);
    expect(can("teacher", { communication: ["manage"] })).toBe(false);
    expect(can("student", { communication: ["manage"] })).toBe(false);
  });
});
