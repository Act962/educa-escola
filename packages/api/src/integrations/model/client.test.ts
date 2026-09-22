import { afterEach, describe, expect, it, vi } from "vitest";

import { createClienteCompativel, ErroDoModelo } from "./client";

const config = { baseUrl: "https://api.exemplo.com/v1", apiKey: "sk-segreda", model: "modelo-x" };

const pedido = { sistema: "Você é o Astro.", pergunta: "quantos alunos?", maxTokens: 300 };

/**
 * `fetch` falso, com a assinatura real declarada.
 *
 * Sem os parâmetros, `vi.fn(async () => …)` dá `[]` em `mock.calls`, e
 * conferir a URL e o corpo enviados passaria a exigir conversão por
 * `unknown` — que é o jeito de o teste deixar de checar justamente o que ele
 * existe para checar.
 */
function respondeCom(corpo: unknown, status = 200) {
  return vi.fn(
    async (_url: string, _init?: RequestInit) =>
      new Response(JSON.stringify(corpo), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createClienteCompativel", () => {
  it("chama /chat/completions com o modelo e a credencial", async () => {
    const fetchFalso = respondeCom({
      choices: [{ message: { content: " São 289 alunos ativos. " } }],
      usage: { total_tokens: 120 },
    });
    vi.stubGlobal("fetch", fetchFalso);

    const saida = await createClienteCompativel(config).responder(pedido);

    const [url, init = {}] = fetchFalso.mock.calls[0] ?? [];
    expect(url).toBe("https://api.exemplo.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-segreda");

    const corpo = JSON.parse(init.body as string);
    expect(corpo.model).toBe("modelo-x");
    expect(corpo.max_tokens).toBe(300);
    expect(corpo.messages[0]).toEqual({ role: "system", content: "Você é o Astro." });

    expect(saida).toEqual({ texto: "São 289 alunos ativos.", tokens: 120 });
  });

  /** Os dois aparecem na documentação dos provedores; quem digita não paga por isso. */
  it("tolera o endereço com barra no fim", async () => {
    const fetchFalso = respondeCom({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchFalso);

    await createClienteCompativel({ ...config, baseUrl: "https://api.exemplo.com/v1//" }).responder(
      pedido,
    );

    expect(fetchFalso.mock.calls[0]?.[0]).toBe("https://api.exemplo.com/v1/chat/completions");
  });

  /** Temperatura baixa: o Astro fala de número de escola, não escreve poema. */
  it("pede resposta pouco criativa", async () => {
    const fetchFalso = respondeCom({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchFalso);

    await createClienteCompativel(config).responder(pedido);

    const [, init = {}] = fetchFalso.mock.calls[0] ?? [];
    const corpo = JSON.parse(init.body as string);
    expect(corpo.temperature).toBeLessThanOrEqual(0.2);
  });

  /**
   * Conta com mais de uma organização precisa dizer em qual o consumo é
   * debitado. Sem o cabeçalho, a OpenAI usa a padrão — e a fatura chega no
   * lugar errado, que é o tipo de erro que só aparece no fim do mês.
   */
  it("manda a organização como cabeçalho quando ela existe", async () => {
    const fetchFalso = respondeCom({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchFalso);

    await createClienteCompativel({ ...config, organizationId: "org-oqUIj123" }).responder(pedido);

    const [, init = {}] = fetchFalso.mock.calls[0] ?? [];
    expect((init.headers as Record<string, string>)["openai-organization"]).toBe("org-oqUIj123");
  });

  /** Mandar o cabeçalho vazio é pedir 400 de graça a quem não o conhece. */
  it("omite o cabeçalho quando não há organização", async () => {
    for (const organizationId of [undefined, null, ""]) {
      const fetchFalso = respondeCom({ choices: [{ message: { content: "ok" } }] });
      vi.stubGlobal("fetch", fetchFalso);

      await createClienteCompativel({ ...config, organizationId }).responder(pedido);

      const [, init = {}] = fetchFalso.mock.calls[0] ?? [];
      expect(init.headers as Record<string, string>).not.toHaveProperty("openai-organization");
    }
  });

  /**
   * "401" não diz nada para a secretaria; "a chave foi recusada" manda ela
   * para a tela certa.
   */
  it("traduz o status para quem vai resolver o problema", async () => {
    const casos: [number, RegExp][] = [
      [401, /credencial/i],
      [403, /credencial/i],
      [404, /endereço ou o nome do modelo/i],
      [429, /limitou o uso/i],
      [500, /provedor do modelo está com problema/i],
    ];

    for (const [status, esperado] of casos) {
      vi.stubGlobal("fetch", respondeCom({ error: "x" }, status));
      await expect(createClienteCompativel(config).responder(pedido)).rejects.toThrow(esperado);
    }
  });

  /**
   * O corpo do provedor às vezes ecoa parte da requisição — e a requisição
   * carrega os fatos da escola, com número de aluno. Ele não entra na
   * mensagem de erro, que é lida na tela e pode acabar num print.
   */
  it("não ecoa o corpo da resposta do provedor na mensagem", async () => {
    vi.stubGlobal(
      "fetch",
      respondeCom({ error: { message: "input was: Alunos ativos 289, Júlia com 67%" } }, 400),
    );

    const erro: Error = await createClienteCompativel(config)
      .responder(pedido)
      .then(() => new Error("não deveria ter respondido"))
      .catch((e: Error) => e);

    expect(erro.message).not.toContain("Júlia");
    expect(erro.message).not.toContain("289");
  });

  /**
   * O código é curto, fixo e é o que diz o que fazer: `invalid_api_key` manda
   * trocar a chave, `insufficient_quota` manda pôr saldo. Sem ele, os dois
   * chegam à tela como "o provedor recusou" e a escola fica adivinhando.
   */
  it("repassa o código do provedor, e só o código", async () => {
    vi.stubGlobal(
      "fetch",
      respondeCom(
        { error: { code: "invalid_api_key", message: "chave de Júlia, 289 alunos" } },
        401,
      ),
    );

    const erro: Error = await createClienteCompativel(config)
      .responder(pedido)
      .then(() => new Error("não deveria ter respondido"))
      .catch((e: Error) => e);

    expect(erro.message).toContain("invalid_api_key");
    expect(erro.message).not.toContain("Júlia");
  });

  /** Campo grande ali não é código, é texto — e texto pode ecoar requisição. */
  it("descarta o que vier no lugar do código e for longo demais", async () => {
    vi.stubGlobal("fetch", respondeCom({ error: { code: "x".repeat(200) } }, 401));

    await expect(createClienteCompativel(config).responder(pedido)).rejects.toThrow(
      /credencial\. Confira a chave nas configurações\.$/,
    );
  });

  it("recusa resposta em formato desconhecido", async () => {
    vi.stubGlobal("fetch", respondeCom({ resultado: "oi" }));

    await expect(createClienteCompativel(config).responder(pedido)).rejects.toThrow(
      /formato que não reconheço/,
    );
  });

  /** Endereço errado, DNS, servidor fora: é configuração da escola. */
  it("marca falha de rede como problema de configuração", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
        throw new TypeError("fetch failed");
      }),
    );

    const erro: ErroDoModelo = await createClienteCompativel(config)
      .responder(pedido)
      .then(() => new ErroDoModelo("não deveria ter respondido", false))
      .catch((e: ErroDoModelo) => e);

    expect(erro).toBeInstanceOf(ErroDoModelo);
    expect(erro.daConfiguracao).toBe(true);
    expect(erro.message).toMatch(/Confira o endereço/);
  });

  it("diz quando o modelo simplesmente não respondeu a tempo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, _init?: RequestInit): Promise<Response> => {
        throw Object.assign(new Error("timed out"), { name: "TimeoutError" });
      }),
    );

    await expect(createClienteCompativel(config).responder(pedido)).rejects.toThrow(
      /não respondeu em 30 segundos/,
    );
  });

  /** A credencial vai no cabeçalho, nunca no corpo nem na URL. */
  it("não põe a credencial na URL nem no corpo", async () => {
    const fetchFalso = respondeCom({ choices: [{ message: { content: "ok" } }] });
    vi.stubGlobal("fetch", fetchFalso);

    await createClienteCompativel(config).responder(pedido);

    const [url, init = {}] = fetchFalso.mock.calls[0] ?? [];
    expect(url).not.toContain("sk-segreda");
    expect(init.body as string).not.toContain("sk-segreda");
  });
});

describe("listarModelos", () => {
  /**
   * Nome de modelo envelhece: provedor lança e aposenta o tempo todo. Quem
   * responde o que existe hoje é ele, não uma lista escrita no código.
   */
  it("pergunta ao provedor e devolve os ids em ordem", async () => {
    const fetchFalso = respondeCom({
      data: [{ id: "gpt-4o" }, { id: "gpt-4o-mini" }, { id: "o4-mini" }],
    });
    vi.stubGlobal("fetch", fetchFalso);

    const lista = await createClienteCompativel(config).listarModelos();

    expect(fetchFalso.mock.calls[0]?.[0]).toBe("https://api.exemplo.com/v1/models");
    expect(lista).toEqual(["gpt-4o", "gpt-4o-mini", "o4-mini"]);
  });

  it("leva credencial e organização na consulta", async () => {
    const fetchFalso = respondeCom({ data: [{ id: "m" }] });
    vi.stubGlobal("fetch", fetchFalso);

    await createClienteCompativel({ ...config, organizationId: "org-x" }).listarModelos();

    const [, init = {}] = fetchFalso.mock.calls[0] ?? [];
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer sk-segreda");
    expect(headers["openai-organization"]).toBe("org-x");
  });

  /** Ignora linha sem id em vez de devolver `undefined` para dentro da tela. */
  it("descarta entrada sem id", async () => {
    vi.stubGlobal("fetch", respondeCom({ data: [{ id: "bom" }, {}, { id: "" }] }));

    expect(await createClienteCompativel(config).listarModelos()).toEqual(["bom"]);
  });

  /**
   * Endpoint que existe e devolve vazio — ou noutro formato — não é falha
   * nossa: a escola digita o nome e segue.
   */
  it("manda digitar à mão quando não vem nada", async () => {
    vi.stubGlobal("fetch", respondeCom({ data: [] }));

    await expect(createClienteCompativel(config).listarModelos()).rejects.toThrow(
      /Digite o nome do modelo à mão/,
    );
  });

  it("traduz o status como no resto do cliente", async () => {
    vi.stubGlobal("fetch", respondeCom({}, 401));

    await expect(createClienteCompativel(config).listarModelos()).rejects.toThrow(/credencial/i);
  });
});
