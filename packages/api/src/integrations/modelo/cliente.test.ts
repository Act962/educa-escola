import { afterEach, describe, expect, it, vi } from "vitest";

import { createClienteCompativel, ErroDoModelo } from "./cliente";

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
