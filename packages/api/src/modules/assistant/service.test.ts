import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { ErroDoModelo, type ModeloDeLinguagem } from "../../integrations/modelo/cliente";
import type { AssistantRepository } from "./repository";
import { cifrarCredencial } from "./segredo";
import { CONFIGURACAO_PADRAO, createAssistantService, montarInstrucao } from "./service";

/** 32 bytes em base64, só para o teste. Não é segredo de lugar nenhum. */
const CHAVE = Buffer.alloc(32, 7).toString("base64");
const AGORA = new Date("2026-03-10T15:00:00");

type Linha = NonNullable<Awaited<ReturnType<AssistantRepository["find"]>>>;

/**
 * A credencial do fixture é cifrada de verdade.
 *
 * Com um `iv` inventado, `perguntar` estourava em "Invalid initialization
 * vector" — e o teste que deveria provar a tradução de erro do modelo passava
 * a provar que o fixture estava errado.
 */
const CREDENCIAL = cifrarCredencial("sk-de-teste-7Z9K", CHAVE);

const configurada = (over: Partial<Linha> = {}): Linha =>
  ({
    schoolId: "e1",
    enabled: true,
    providerLabel: "OpenAI",
    baseUrl: "https://api.exemplo.com/v1",
    model: "modelo-x",
    apiKeyCipher: CREDENCIAL.cipher,
    apiKeyIv: CREDENCIAL.iv,
    apiKeyTag: CREDENCIAL.authTag,
    apiKeyHint: "••••7Z9K",
    maxTokens: 600,
    dailyLimit: 200,
    allowTeachers: true,
    allowStudents: false,
    updatedByUserId: "u1",
    updatedAt: AGORA,
    ...over,
  }) as Linha;

function fakeRepo(over: Partial<AssistantRepository> = {}): AssistantRepository {
  return {
    find: async () => null,
    save: async (patch) => ({ ...configurada(), ...patch }) as never,
    countUsageSince: async () => 0,
    recordUsage: async () => ({ id: "u" }),
    ...over,
  };
}

const modeloQueResponde = (texto = "Resposta."): ModeloDeLinguagem => ({
  responder: async () => ({ texto, tokens: 42 }),
  listarModelos: async () => ["modelo-x", "modelo-y"],
});

/**
 * Opções num objeto, e não parâmetros com padrão.
 *
 * `(over, modelo, chave = CHAVE)` chamado com `undefined` explícito **usa o
 * padrão** — foi assim que os dois testes de "sem chave no servidor" passaram
 * a afirmar o contrário do que dizem.
 */
const servico = (
  opcoes: {
    repo?: Partial<AssistantRepository>;
    modelo?: ModeloDeLinguagem;
    semChaveDoServidor?: boolean;
  } = {},
) =>
  createAssistantService(fakeRepo(opcoes.repo ?? {}), {
    now: () => AGORA,
    chave: opcoes.semChaveDoServidor ? undefined : CHAVE,
    modelo: () => opcoes.modelo ?? modeloQueResponde(),
  });

const comConfiguracao = (over: Partial<Linha> = {}) => ({ find: async () => configurada(over) });

const quem = { userId: "u1", role: "owner" as const, nome: "Marina", escola: "Dom Pedro II" };

const BASE = {
  enabled: false,
  maxTokens: 600,
  dailyLimit: 200,
  allowTeachers: true,
  allowStudents: false,
};

describe("padrões", () => {
  /**
   * Aluno desligado por padrão: é o público que a escola precisa decidir
   * conscientemente, não herdar. E tudo nasce desligado porque credencial de
   * modelo é chave de gasto.
   */
  it("nasce desligado e sem o aluno", () => {
    expect(CONFIGURACAO_PADRAO.enabled).toBe(false);
    expect(CONFIGURACAO_PADRAO.allowStudents).toBe(false);
  });
});

describe("configuracao", () => {
  /**
   * O teste que mais importa deste módulo: a credencial **nunca** volta. Nem
   * cifrada — o texto cifrado mais a chave do servidor reconstroem o segredo,
   * e a tela não precisa de nenhum dos dois.
   */
  it("não devolve a credencial, nem cifrada", async () => {
    const visao = await servico({ repo: comConfiguracao() }).configuracao();
    const chaves = Object.keys(visao);

    expect(chaves).not.toContain("apiKeyCipher");
    expect(chaves).not.toContain("apiKeyIv");
    expect(chaves).not.toContain("apiKeyTag");
    expect(JSON.stringify(visao)).not.toContain(CREDENCIAL.cipher);
  });

  it("diz que existe credencial e qual é, sem entregá-la", async () => {
    const visao = await servico({ repo: comConfiguracao() }).configuracao();

    expect(visao.credencialGravada).toBe(true);
    expect(visao.apiKeyHint).toBe("••••7Z9K");
  });

  it("avisa quando o servidor não tem a chave de cifragem", async () => {
    const visao = await servico({
      repo: comConfiguracao(),
      semChaveDoServidor: true,
    }).configuracao();

    expect(visao.chaveDoServidor).toBe(false);
  });

  it("devolve o padrão quando a escola nunca configurou", async () => {
    const visao = await servico().configuracao();

    expect(visao.enabled).toBe(false);
    expect(visao.credencialGravada).toBe(false);
  });
});

describe("salvar", () => {
  function capturando(over: Partial<Linha> = {}) {
    const gravados: Record<string, unknown>[] = [];
    const repo: Partial<AssistantRepository> = {
      find: async () => configurada(over),
      save: async (patch) => {
        gravados.push(patch as Record<string, unknown>);
        return { ...configurada(over), ...patch } as never;
      },
    };
    return { gravados, repo };
  }

  /**
   * Editar o nome do modelo não pode obrigar a redigitar a credencial: quem
   * redigita segredo toda hora acaba guardando ele num bloco de notas.
   */
  it("sem `apiKey`, mantém a chave que está lá", async () => {
    const { gravados, repo } = capturando();

    await servico({ repo }).salvar({ ...BASE, model: "outro-modelo" }, "u1");

    expect(gravados[0]).not.toHaveProperty("apiKeyCipher");
    expect(gravados[0]?.model).toBe("outro-modelo");
  });

  it("string vazia apaga a credencial inteira", async () => {
    const { gravados, repo } = capturando();

    await servico({ repo }).salvar({ ...BASE, apiKey: "" }, "u1");

    expect(gravados[0]).toMatchObject({
      apiKeyCipher: null,
      apiKeyIv: null,
      apiKeyTag: null,
      apiKeyHint: null,
    });
  });

  it("cifra a credencial e guarda só os quatro últimos em claro", async () => {
    const { gravados, repo } = capturando();

    await servico({ repo }).salvar({ ...BASE, apiKey: "sk-super-secreta-7Z9K" }, "u1");

    const gravado = gravados[0] ?? {};
    expect(gravado.apiKeyHint).toBe("••••7Z9K");
    // Um `encrypt` trocado por um `base64` passaria em todo o resto menos aqui.
    expect(String(gravado.apiKeyCipher)).not.toContain("super-secreta");
    expect(gravado.apiKeyIv).toBeTruthy();
    expect(gravado.apiKeyTag).toBeTruthy();
  });

  it("recusa gravar credencial sem a chave do servidor", async () => {
    const s = servico({ semChaveDoServidor: true });

    await expect(s.salvar({ ...BASE, apiKey: "sk-alguma-coisa" }, "u1")).rejects.toThrow(
      /ASSISTANT_ENCRYPTION_KEY/,
    );
  });

  /** Ligar sem as três peças deixaria um botão que só sabe dar erro. */
  it("recusa ligar com configuração incompleta", async () => {
    const s = servico({
      repo: {
        find: async () => configurada({ apiKeyCipher: null }),
        save: async (patch) => ({ ...configurada({ apiKeyCipher: null }), ...patch }) as never,
      },
    });

    await expect(s.salvar({ ...BASE, enabled: true }, "u1")).rejects.toBeInstanceOf(
      ValidationError,
    );
  });
});

describe("situacao", () => {
  it("fechado enquanto a configuração estiver incompleta", async () => {
    const s = servico({ repo: comConfiguracao({ model: null }) });

    expect(await s.situacao("owner")).toEqual({ disponivel: false, ligado: false });
  });

  /**
   * Quem pode perguntar é decisão da escola, não do RBAC: ela precisa abrir
   * para o aluno sem mexer em papel.
   */
  it("respeita a liberação por papel que a escola configurou", async () => {
    const fechado = servico({ repo: comConfiguracao() });
    expect((await fechado.situacao("student")).disponivel).toBe(false);
    expect((await fechado.situacao("teacher")).disponivel).toBe(true);

    const aberto = servico({ repo: comConfiguracao({ allowStudents: true }) });
    expect((await aberto.situacao("student")).disponivel).toBe(true);

    const semProfessor = servico({ repo: comConfiguracao({ allowTeachers: false }) });
    expect((await semProfessor.situacao("teacher")).disponivel).toBe(false);
  });

  /** Direção e secretaria sempre entram: são elas que configuram. */
  it("gestão entra mesmo com tudo fechado", async () => {
    const s = servico({
      repo: comConfiguracao({ allowTeachers: false, allowStudents: false }),
    });

    expect((await s.situacao("owner")).disponivel).toBe(true);
    expect((await s.situacao("admin")).disponivel).toBe(true);
  });
});

describe("perguntar", () => {
  it("recusa quando o Astro está desligado", async () => {
    const s = servico({ repo: comConfiguracao({ enabled: false }) });

    await expect(
      s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("recusa papel que a escola não liberou", async () => {
    const s = servico({ repo: comConfiguracao() });

    await expect(
      s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, { ...quem, role: "student" }),
    ).rejects.toThrow(/não tem acesso/);
  });

  /** Credencial de modelo sem teto é conta aberta. */
  it("para no teto diário da escola", async () => {
    const s = servico({
      repo: { find: async () => configurada({ dailyLimit: 5 }), countUsageSince: async () => 5 },
    });

    await expect(
      s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("conta a partir da meia-noite de hoje", async () => {
    const janelas: Date[] = [];
    const s = servico({
      repo: {
        find: async () => configurada(),
        countUsageSince: async (desde) => {
          janelas.push(desde);
          return 0;
        },
      },
    });

    await s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem);

    expect(janelas[0]?.getHours()).toBe(0);
    expect(janelas[0]?.getDate()).toBe(10);
  });

  it("registra o uso e devolve quantas sobram", async () => {
    const registros: unknown[] = [];
    const s = servico({
      repo: {
        find: async () => configurada({ dailyLimit: 10 }),
        countUsageSince: async () => 3,
        recordUsage: async (data) => {
          registros.push(data);
          return { id: "u" };
        },
      },
    });

    const saida = await s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem);

    expect(saida.restantesHoje).toBe(6);
    expect(registros[0]).toMatchObject({ userId: "u1", role: "owner", tokens: 42 });
  });

  /**
   * O registro guarda contagem, nunca a pergunta: conteúdo de criança é outra
   * finalidade e outro consentimento.
   */
  it("não registra o texto da pergunta", async () => {
    const registros: Record<string, unknown>[] = [];
    const s = servico({
      repo: {
        find: async () => configurada(),
        recordUsage: async (data) => {
          registros.push(data as Record<string, unknown>);
          return { id: "u" };
        },
      },
    });

    await s.perguntar({ pergunta: "a Júlia está reprovada?", fatos: "x" }, quem);

    expect(JSON.stringify(registros[0])).not.toContain("Júlia");
  });

  /** Falha de provedor precisa sair como 4xx legível, não 500 com pilha. */
  it("traduz erro do modelo em erro de domínio", async () => {
    const quebrado: ModeloDeLinguagem = {
      responder: async () => {
        throw new ErroDoModelo("O modelo recusou a credencial.", true);
      },
      listarModelos: async () => [],
    };
    const s = servico({ repo: comConfiguracao(), modelo: quebrado });

    await expect(s.perguntar({ pergunta: "oi", fatos: "x" }, quem)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("não registra uso quando o modelo falha", async () => {
    let registrou = false;
    const quebrado: ModeloDeLinguagem = {
      responder: async () => {
        throw new ErroDoModelo("caiu", true);
      },
      listarModelos: async () => [],
    };
    const s = servico({
      repo: {
        find: async () => configurada(),
        recordUsage: async () => {
          registrou = true;
          return { id: "u" };
        },
      },
      modelo: quebrado,
    });

    await expect(s.perguntar({ pergunta: "oi", fatos: "x" }, quem)).rejects.toThrow();
    expect(registrou).toBe(false);
  });

  /** A credencial decifrada não pode escapar para a resposta nem para o log. */
  it("a resposta não carrega a credencial", async () => {
    const ecoa: ModeloDeLinguagem = {
      responder: async ({ sistema }) => ({ texto: sistema, tokens: null }),
      listarModelos: async () => [],
    };
    const s = servico({ repo: comConfiguracao(), modelo: ecoa });

    const saida = await s.perguntar({ pergunta: "oi", fatos: "Alunos: 10." }, quem);

    expect(saida.texto).toContain("Alunos: 10.");
    expect(saida.texto).not.toContain("sk-de-teste");
  });
});

describe("montarInstrucao", () => {
  /**
   * A fronteira de permissão é de subtração: o modelo só enxerga `fatos`. O
   * pedido de não inventar existe para o resto — fora dos fatos, modelo
   * preenche lacuna com plausibilidade, e número plausível sobre frequência
   * de criança é pior que "não sei".
   */
  it("leva os fatos e proíbe completar o que não está neles", () => {
    const texto = montarInstrucao({
      escola: "Dom Pedro II",
      papel: "student",
      nome: "Ana",
      fatos: "Sua frequência: 93,7%.",
    });

    expect(texto).toContain("Sua frequência: 93,7%.");
    expect(texto).toContain("SOMENTE os fatos");
    expect(texto).toMatch(/Nunca estime/);
  });

  it("diz ao modelo o que cada papel enxerga", () => {
    expect(montarInstrucao({ escola: "E", papel: "teacher", nome: "R", fatos: "" })).toContain(
      "apenas as próprias turmas",
    );
    expect(montarInstrucao({ escola: "E", papel: "student", nome: "A", fatos: "" })).toContain(
      "apenas o que é dele",
    );
  });
});

describe("modelosDisponiveis", () => {
  it("exige endereço e credencial salvos", async () => {
    await expect(servico().modelosDisponiveis()).rejects.toThrow(/Salve o endereço e a credencial/);
  });

  it("devolve a lista que o provedor deu", async () => {
    const s = servico({
      repo: comConfiguracao(),
      modelo: {
        responder: async () => ({ texto: "", tokens: null }),
        listarModelos: async () => ["a", "b"],
      },
    });

    expect(await s.modelosDisponiveis()).toEqual(["a", "b"]);
  });

  /** Falha de provedor sai como 4xx legível, igual ao resto do módulo. */
  it("traduz erro do provedor", async () => {
    const s = servico({
      repo: comConfiguracao(),
      modelo: {
        responder: async () => ({ texto: "", tokens: null }),
        listarModelos: async () => {
          throw new ErroDoModelo("O modelo recusou a credencial.", true);
        },
      },
    });

    await expect(s.modelosDisponiveis()).rejects.toBeInstanceOf(ValidationError);
  });
});
