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
    monthlyTokenBudget: null,
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
    usoDesde: async () => ({ perguntas: 0, tokens: 0, semContagem: 0 }),
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

    const erro: Error = await s
      .salvar({ ...BASE, apiKey: "sk-alguma-coisa" }, "u1")
      .then(() => new Error("não deveria ter gravado"))
      .catch((e: Error) => e);

    expect(erro.message).toContain("ASSISTANT_ENCRYPTION_KEY");
    // A instrução tem de dizer só o que falta, e incluir o reinício: o `.env`
    // é lido na subida, e sem isso a pessoa acrescenta a linha e vê o mesmo
    // erro de novo.
    expect(erro.message).toContain("apps/web/.env");
    expect(erro.message).toMatch(/reinicie/i);
    // `printf` e não `echo … >>`: arquivo `.env` sem quebra de linha no fim
    // faz o `>>` colar a variável nova no fim da anterior, e as duas ficam
    // inválidas — com o mesmo erro de antes, o que faz quem seguiu a
    // instrução concluir que a instrução é que estava errada.
    expect(erro.message).toContain("printf");
    expect(erro.message).not.toMatch(/echo "ASSISTANT/);
    expect(erro.message).not.toContain("turbo.json");
    expect(erro.message).not.toContain("packages/env");
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
      repo: {
        find: async () => configurada({ dailyLimit: 5 }),
        usoDesde: async () => ({ perguntas: 5, tokens: 0, semContagem: 0 }),
      },
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
        usoDesde: async (desde) => {
          janelas.push(desde);
          return { perguntas: 0, tokens: 0, semContagem: 0 };
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
        usoDesde: async () => ({ perguntas: 3, tokens: 0, semContagem: 0 }),
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

describe("mensagem do que falta para ligar", () => {
  /**
   * O que falta é decidido pela **mescla** do que está gravado com o que veio
   * no formulário — que é o estado que ficaria na linha. Por isso o teste
   * controla os dois lados: `guardado` é a linha, `entrada` é o que a direção
   * mandou.
   */
  const ligar = (
    opcoes: {
      guardado?: Partial<Linha>;
      entrada?: Partial<Parameters<ReturnType<typeof servico>["salvar"]>[0]>;
      gravou?: { chamou: boolean };
    } = {},
  ) =>
    servico({
      repo: {
        find: async () => configurada(opcoes.guardado ?? {}),
        save: async (patch) => {
          if (opcoes.gravou) opcoes.gravou.chamou = true;
          return { ...configurada(opcoes.guardado ?? {}), ...patch } as never;
        },
      },
    }).salvar(
      {
        ...BASE,
        enabled: true,
        baseUrl: "https://api.exemplo.com/v1",
        model: "modelo-x",
        ...opcoes.entrada,
      },
      "u1",
    );

  /**
   * Listar os três quando só um falta faz a pessoa duvidar da tela, não do
   * campo — foi o que aconteceu com o modelo vindo vazio do dropdown.
   */
  it("nomeia só o campo que está faltando", async () => {
    await expect(ligar({ entrada: { model: null } })).rejects.toThrow(
      "Para ligar o Astro, falta preencher o modelo.",
    );
    await expect(ligar({ entrada: { baseUrl: null } })).rejects.toThrow(
      "Para ligar o Astro, falta preencher o endereço da API.",
    );
    await expect(
      ligar({ guardado: { apiKeyCipher: null }, entrada: { apiKey: "" } }),
    ).rejects.toThrow("Para ligar o Astro, falta preencher a credencial.");
  });

  it("junta com 'e' quando falta mais de um", async () => {
    await expect(
      ligar({ guardado: { apiKeyCipher: null }, entrada: { model: null, apiKey: "" } }),
    ).rejects.toThrow("Para ligar o Astro, falta preencher o modelo e a credencial.");

    await expect(
      ligar({
        guardado: { apiKeyCipher: null },
        entrada: { baseUrl: null, model: null, apiKey: "" },
      }),
    ).rejects.toThrow(
      "Para ligar o Astro, falta preencher o endereço da API, o modelo e a credencial.",
    );
  });

  /**
   * A credencial que já está gravada conta: editar o modelo sem redigitar o
   * segredo não pode ser lido como "falta a credencial".
   */
  it("a credencial já gravada basta, mesmo sem redigitar", async () => {
    await expect(ligar({ entrada: { apiKey: undefined } })).resolves.toMatchObject({
      enabled: true,
    });
  });

  /**
   * A recusa não pode deixar no banco o estado que ela diz não aceitar. Antes
   * a checagem vinha depois do `save`, e a linha ficava com `enabled = true` e
   * o modelo vazio — nada quebrava, mas quem abrisse o banco leria "ligado".
   */
  it("recusa sem gravar nada", async () => {
    const gravou = { chamou: false };

    await expect(ligar({ entrada: { model: null }, gravou })).rejects.toThrow();

    expect(gravou.chamou).toBe(false);
  });

  it("deixa ligar quando está tudo lá", async () => {
    await expect(ligar()).resolves.toMatchObject({ enabled: true });
  });
});

describe("chave de cifragem girada", () => {
  /** Credencial gravada com outra chave: o GCM autentica, e a etiqueta não bate. */
  const comChaveAntiga = () => ({
    find: async () =>
      configurada({
        apiKeyCipher: cifrarCredencial("sk-antiga", Buffer.alloc(32, 1).toString("base64")).cipher,
      }),
  });

  it("a tela sabe que a credencial não abre, antes da primeira pergunta", async () => {
    const visao = await servico({ repo: comChaveAntiga() }).configuracao();

    expect(visao.credencialGravada).toBe(true);
    expect(visao.credencialAbre).toBe(false);
  });

  it("credencial que abre é reportada como tal", async () => {
    const visao = await servico({ repo: comConfiguracao() }).configuracao();

    expect(visao.credencialAbre).toBe(true);
  });

  /**
   * Sem isto a escola descobre por um 500: a exceção do `node:crypto` não é
   * erro de domínio e sai como falha nossa, quando é configuração dela.
   */
  it("a pergunta recusa com instrução, não com erro do crypto", async () => {
    const s = servico({ repo: comChaveAntiga() });

    await expect(s.perguntar({ pergunta: "oi", fatos: "x" }, quem)).rejects.toBeInstanceOf(
      ValidationError,
    );

    await expect(s.perguntar({ pergunta: "oi", fatos: "x" }, quem)).rejects.toThrow(
      /Regrave a credencial/,
    );
  });
});

/**
 * O orçamento do mês é o teto que a escola declara; o diário é o que já
 * existia. Os dois barram do mesmo jeito, e a barra lateral pinta pelos mesmos
 * limiares — é por isso que `nivelDeUso` mora fora daqui.
 */
describe("orçamento de tokens", () => {
  /** Janela do dia e janela do mês são consultas distintas sobre a mesma tabela. */
  const repoComUso = (
    porJanela: (desde: Date) => { perguntas: number; tokens: number; semContagem: number },
    linha: Partial<Linha> = {},
  ): Partial<AssistantRepository> => ({
    find: async () => configurada(linha),
    usoDesde: async (desde) => porJanela(desde),
  });

  const ehDoMes = (desde: Date) => desde.getDate() === 1;

  it("recusa a pergunta quando o mês chegou ao orçamento", async () => {
    const s = servico({
      repo: repoComUso(
        (desde) =>
          ehDoMes(desde)
            ? { perguntas: 80, tokens: 50_000, semContagem: 0 }
            : { perguntas: 4, tokens: 2_400, semContagem: 0 },
        { monthlyTokenBudget: 50_000 },
      ),
    });

    await expect(s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem)).rejects.toThrow(
      /orçamento de 50.000 tokens/,
    );
  });

  /**
   * Orçamento nulo é "a escola não disse quanto aceita gastar". Parar o Astro
   * num número que ninguém escolheu seria inventar a decisão dela.
   */
  it("sem orçamento declarado, só o teto diário barra", async () => {
    const s = servico({
      repo: repoComUso(() => ({ perguntas: 1, tokens: 9_000_000, semContagem: 0 })),
      modelo: modeloQueResponde(),
    });

    await expect(s.perguntar({ pergunta: "quantos alunos?", fatos: "x" }, quem)).resolves.toEqual({
      texto: "Resposta.",
      restantesHoje: 198,
    });
  });

  it("uso devolve as duas janelas, com o pior nível dos dois", async () => {
    const s = servico({
      repo: repoComUso(
        (desde) =>
          ehDoMes(desde)
            ? { perguntas: 300, tokens: 96_000, semContagem: 7 }
            : { perguntas: 10, tokens: 6_000, semContagem: 0 },
        { dailyLimit: 200, monthlyTokenBudget: 100_000 },
      ),
    });

    expect(await s.uso()).toEqual({
      ligado: true,
      perguntas: { usadas: 10, teto: 200, nivel: "ok" },
      tokens: { usados: 96_000, teto: 100_000, nivel: "critico", semContagem: 7 },
      nivel: "critico",
    });
  });

  /** Sem linha gravada, a escola ainda não configurou nada — nem teto de token. */
  it("uso responde com o padrão quando a escola nunca configurou", async () => {
    const s = servico({ repo: { find: async () => null } });

    expect(await s.uso()).toEqual({
      ligado: false,
      perguntas: { usadas: 0, teto: CONFIGURACAO_PADRAO.dailyLimit, nivel: "ok" },
      tokens: { usados: 0, teto: null, nivel: "ok", semContagem: 0 },
      nivel: "ok",
    });
  });
});
