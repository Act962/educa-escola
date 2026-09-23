import { afterEach, describe, expect, it, vi } from "vitest";

import { createCloudChannel } from "./cloud";
import {
  CanalIndisponivelError,
  CredencialRecusadaError,
  ForaDaJanelaError,
  ModeloInvalidoError,
  NumeroInvalidoError,
} from "./port";
import type { ModeloDeMensagem } from "./template";

/**
 * O adaptador da Meta com o `fetch` dublado.
 *
 * O que se testa aqui é o que **só este arquivo faz**: o corpo que sai e a
 * tradução do erro que volta. O comportamento comum aos dois adaptadores está
 * em `contract.ts`, e a suíte contra a Meta de verdade não roda em pull
 * request — o que ficar só lá não é coberto por PR nenhum.
 */

const canal = () =>
  createCloudChannel({
    phoneNumberId: "111",
    wabaId: "222",
    token: "EAA-token",
    apiVersion: "v21.0",
  });

/** O `fetch` dublado, com os parâmetros tipados para o teste poder lê-los. */
function responder(status: number, body: unknown) {
  return vi.fn(
    async (_url: string, _init: RequestInit) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
      }),
  );
}

afterEach(() => vi.unstubAllGlobals());

const modelo: ModeloDeMensagem = {
  nome: "aviso_de_reuniao",
  categoria: "UTILITY",
  idioma: "pt_BR",
  corpo: "Olá, {{responsavel}}. A reunião é dia {{data}}. Contamos com você.",
  exemplos: ["Maria", "12/10"],
};

describe("o que sai", () => {
  it("manda o modelo no formato da Cloud API", async () => {
    const fetchSpy = responder(200, { messages: [{ id: "wamid.XYZ" }] });
    vi.stubGlobal("fetch", fetchSpy);

    const aceito = await canal().enviarModelo({
      para: "+5586998122039",
      nome: "aviso_de_reuniao",
      idioma: "pt_BR",
      variaveis: ["Ana", "12/10"],
    });

    expect(aceito.providerMessageId).toBe("wamid.XYZ");

    const [url, init] = fetchSpy.mock.calls[0] ?? ["", {}];
    expect(url).toBe("https://graph.facebook.com/v21.0/111/messages");
    expect(JSON.parse(String(init.body))).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "+5586998122039",
      type: "template",
      template: {
        name: "aviso_de_reuniao",
        language: { code: "pt_BR" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Ana" },
              { type: "text", text: "12/10" },
            ],
          },
        ],
      },
    });
  });

  /**
   * Prévia de link faz a Meta buscar a página e muda a cara da mensagem sem a
   * escola ter pedido. Fica desligada, e é fácil alguém religar sem perceber.
   */
  it("manda texto livre com a prévia de link desligada", async () => {
    const fetchSpy = responder(200, { messages: [{ id: "wamid.T" }] });
    vi.stubGlobal("fetch", fetchSpy);

    await canal().enviarTexto({ para: "+5586998122039", texto: "Bom dia" });

    const [, init] = fetchSpy.mock.calls[0] ?? ["", {}];
    expect(JSON.parse(String(init.body)).text).toEqual({ body: "Bom dia", preview_url: false });
  });

  it("não chega a chamar a Meta com destinatário fora do E.164", async () => {
    const fetchSpy = responder(200, {});
    vi.stubGlobal("fetch", fetchSpy);

    await expect(canal().enviarTexto({ para: "86998122039", texto: "oi" })).rejects.toBeInstanceOf(
      NumeroInvalidoError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("não chega a chamar a Meta com modelo mal formado", async () => {
    const fetchSpy = responder(200, {});
    vi.stubGlobal("fetch", fetchSpy);

    await expect(canal().criarModelo({ ...modelo, nome: "Nome Errado" })).rejects.toThrow();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("o que volta", () => {
  /**
   * 131047 é o erro mais comum de quem tenta texto livre — e o único cuja
   * saída é *outro caminho*, não "tente de novo". Ele precisa chegar à tela
   * com essa instrução.
   */
  it("traduz a janela de 24 horas fechada", async () => {
    vi.stubGlobal("fetch", responder(400, { error: { code: 131047, message: "…" } }));

    await expect(
      canal().enviarTexto({ para: "+5586998122039", texto: "oi" }),
    ).rejects.toBeInstanceOf(ForaDaJanelaError);
  });

  it("traduz token recusado com a instrução do token permanente", async () => {
    vi.stubGlobal("fetch", responder(401, { error: { code: 190 } }));

    await expect(canal().verificar()).rejects.toThrowError(/System User/);
    await expect(canal().verificar()).rejects.toBeInstanceOf(CredencialRecusadaError);
  });

  it("traduz número sem WhatsApp", async () => {
    vi.stubGlobal("fetch", responder(400, { error: { code: 131026 } }));

    await expect(
      canal().enviarTexto({ para: "+5586998122039", texto: "oi" }),
    ).rejects.toBeInstanceOf(NumeroInvalidoError);
  });

  it("5xx não é problema da escola", async () => {
    vi.stubGlobal("fetch", responder(500, { error: { code: 1 } }));

    const erro = await canal()
      .verificar()
      .catch((e) => e);

    expect(erro).toBeInstanceOf(CanalIndisponivelError);
    expect(erro.daConfiguracao).toBe(false);
  });

  /**
   * A mensagem da Meta não entra no texto que a escola lê: ela às vezes ecoa
   * parte da requisição, e a requisição carrega o número da família. Só o
   * código passa.
   */
  it("não repassa a mensagem crua da Meta", async () => {
    vi.stubGlobal(
      "fetch",
      responder(400, {
        error: { code: 100, message: "Invalid parameter to=+5586998122039 for user 42" },
      }),
    );

    const erro = await canal()
      .verificar()
      .catch((e) => e);

    expect(erro).toBeInstanceOf(ModeloInvalidoError);
    expect(erro.message).not.toContain("5586998122039");
    expect(erro.message).toContain("100");
  });

  it("traduz o motivo da recusa de um modelo", async () => {
    vi.stubGlobal(
      "fetch",
      responder(200, {
        data: [
          {
            id: "1",
            name: "aviso_de_reuniao",
            language: "pt_BR",
            status: "REJECTED",
            category: "UTILITY",
            rejected_reason: "INVALID_FORMAT",
          },
          {
            id: "2",
            name: "boletim",
            language: "pt_BR",
            status: "PENDING",
            category: "UTILITY",
            rejected_reason: "NONE",
          },
        ],
      }),
    );

    const modelos = await canal().listarModelos();

    expect(modelos[0]).toMatchObject({ status: "recusado" });
    expect(modelos[0]?.motivo).toContain("formato inválido");
    // `PENDING` vira `enviado`: para a escola, mandou e está esperando.
    expect(modelos[1]).toMatchObject({ status: "enviado", motivo: null });
  });

  it("rede fora vira canal indisponível, não erro de credencial", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );

    await expect(canal().verificar()).rejects.toBeInstanceOf(CanalIndisponivelError);
  });
});
