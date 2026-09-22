import { describe, expect, it } from "vitest";

import { limparCredencial } from "./secret";

/**
 * Quem cola a credencial quase sempre cola de um `.env`, e o `.env` traz o
 * nome da variável junto. Esse valor cifra bem, abre bem e é recusado pelo
 * provedor com `invalid_api_key` — o erro aponta para a chave quando o defeito
 * está na colagem.
 */
describe("limparCredencial", () => {
  it("tira o nome da variável colado junto", () => {
    expect(limparCredencial("OPENAI_API_KEY=sk-proj-abc123")).toBe("sk-proj-abc123");
    expect(limparCredencial("ASSISTANT_KEY = sk-abc")).toBe("sk-abc");
  });

  it("tira aspas, que o .env aceita nas duas formas", () => {
    expect(limparCredencial('OPENAI_API_KEY="sk-proj-abc"')).toBe("sk-proj-abc");
    expect(limparCredencial("'sk-proj-abc'")).toBe("sk-proj-abc");
  });

  it("tira espaço e quebra de linha que o navegador trouxe junto", () => {
    expect(limparCredencial("  sk-proj-abc\n")).toBe("sk-proj-abc");
  });

  /**
   * Credencial é caixa mista e tem hífen; o padrão do nome de variável é
   * caixa-alta com `_`. Sem essa distinção, uma chave que por acaso tivesse
   * `=` no meio perderia o começo — e o erro seria silencioso.
   */
  it("não confunde a própria credencial com nome de variável", () => {
    expect(limparCredencial("sk-proj-ab=cd")).toBe("sk-proj-ab=cd");
    expect(limparCredencial("Bearer=x")).toBe("Bearer=x");
  });
});
