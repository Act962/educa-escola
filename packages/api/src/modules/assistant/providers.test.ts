import { describe, expect, it } from "vitest";

import { camposAoTrocarProvedor, PROVEDORES, provedorDe } from "./providers";

describe("catálogo de provedores", () => {
  it("não repete id", () => {
    const ids = PROVEDORES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** "Outro" é a saída para o provedor que não está na lista. Sem ele, a
   * escolha viraria uma lista fechada, que é o oposto do que a lista é. */
  it("sempre oferece 'Outro'", () => {
    expect(PROVEDORES.some((p) => p.id === "outro")).toBe(true);
  });

  it("todo endereço preenchido é http(s) e sem barra no fim", () => {
    for (const provedor of PROVEDORES.filter((p) => p.baseUrl)) {
      expect(provedor.baseUrl).toMatch(/^https?:\/\//);
      expect(provedor.baseUrl).not.toMatch(/\/$/);
    }
  });

  /** Id gravado que não existe mais não pode quebrar a tela. */
  it("id desconhecido cai em 'Outro'", () => {
    expect(provedorDe("anthropic-nativo").id).toBe("outro");
    expect(provedorDe(null).id).toBe("outro");
    expect(provedorDe(undefined).id).toBe("outro");
  });
});

describe("camposAoTrocarProvedor", () => {
  /**
   * A armadilha que esta função existe para evitar: escolher Ollama e ficar
   * com `api.openai.com` é a configuração que parece certa, salva sem
   * reclamar e falha na primeira pergunta — com mensagem sobre credencial,
   * que manda a pessoa procurar no lugar errado.
   */
  it("troca o endereço junto com o provedor", () => {
    expect(camposAoTrocarProvedor("openai").baseUrl).toBe("https://api.openai.com/v1");
    expect(camposAoTrocarProvedor("ollama").baseUrl).toBe("http://localhost:11434/v1");
  });

  /**
   * O defeito que isto guarda: o `Select` precisa de um valor para mostrar.
   * Com o estado vazio e o primeiro item exibido como se fosse o escolhido, a
   * tela dizia `gpt-4o-mini`, o formulário mandava vazio, e o servidor recusava
   * pedindo para preencher um campo que a pessoa estava vendo preenchido.
   */
  it("já escolhe o primeiro modelo sugerido, em vez de deixar vazio", () => {
    for (const provedor of PROVEDORES.filter((p) => p.modelos.length > 0)) {
      expect(camposAoTrocarProvedor(provedor.id).model).toBe(provedor.modelos[0]);
    }
  });

  it("fica vazio só quando não há o que sugerir", () => {
    for (const provedor of PROVEDORES.filter((p) => p.modelos.length === 0)) {
      expect(camposAoTrocarProvedor(provedor.id).model).toBe("");
      expect(camposAoTrocarProvedor(provedor.id).modeloDigitado).toBe(true);
    }
  });

  /** Sem lista para escolher, o campo precisa virar texto ou fica sem opção. */
  it("cai no campo de texto quando o provedor não sugere modelo", () => {
    expect(camposAoTrocarProvedor("outro").modeloDigitado).toBe(true);
    expect(camposAoTrocarProvedor("azure").modeloDigitado).toBe(true);
    expect(camposAoTrocarProvedor("openai").modeloDigitado).toBe(false);
  });

  it("endereço vazio para quem tem endereço próprio da instalação", () => {
    expect(camposAoTrocarProvedor("azure").baseUrl).toBe("");
    expect(camposAoTrocarProvedor("outro").baseUrl).toBe("");
  });
});
