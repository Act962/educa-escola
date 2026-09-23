import { describe, expect, it } from "vitest";

import {
  garantirModelo,
  type ModeloDeMensagem,
  ModeloMalFormadoError,
  paraMeta,
  problemasDoModelo,
  renderizar,
  textoRenderizado,
  valoresDeExemplo,
  variaveisDe,
  variaveisDoModelo,
} from "./template";

const base: ModeloDeMensagem = {
  nome: "aviso_de_reuniao",
  categoria: "UTILITY",
  idioma: "pt_BR",
  cabecalho: "Escola {{escola}}",
  corpo: "Olá, {{responsavel}}. A reunião do {{aluno}} é dia {{data}}. Contamos com você.",
  rodape: "Órbita Edu",
  exemplos: ["Municipal X", "Maria", "João", "12/10"],
};

describe("variáveis", () => {
  it("lê os nomes na ordem em que aparecem, sem repetir", () => {
    expect(variaveisDe("Oi {{a}}, o {{b}} e de novo {{a}}")).toEqual(["a", "b"]);
  });

  /**
   * A ordem é o contrato com `exemplos` e com os campos de teste da tela.
   * Trocá-la desalinha exemplo de variável em todo modelo já gravado.
   */
  it("põe as do cabeçalho antes das do corpo", () => {
    expect(variaveisDoModelo(base)).toEqual(["escola", "responsavel", "aluno", "data"]);
  });
});

describe("validação", () => {
  it("aceita um modelo bem formado", () => {
    expect(problemasDoModelo(base)).toEqual([]);
  });

  it("recusa nome fora do snake_case", () => {
    expect(problemasDoModelo({ ...base, nome: "Aviso de Reunião" })[0]).toContain(
      "letras minúsculas",
    );
  });

  /**
   * As três regras que mais custam caro: a Meta as recusa **depois** de horas
   * de revisão, e o motivo que ela devolve não aponta para o caractere.
   */
  it("recusa variável na borda do corpo e variáveis coladas", () => {
    expect(problemasDoModelo({ ...base, corpo: "{{aluno}} faltou ontem." }).join(" ")).toContain(
      "não pode começar",
    );
    expect(problemasDoModelo({ ...base, corpo: "O aluno é {{aluno}}" }).join(" ")).toContain(
      "não pode terminar",
    );
    expect(problemasDoModelo({ ...base, corpo: "Oi {{a}}{{b}}, tudo bem?" }).join(" ")).toContain(
      "coladas",
    );
  });

  it("exige um exemplo por variável", () => {
    const problemas = problemasDoModelo({ ...base, exemplos: ["Municipal X", "Maria"] });
    expect(problemas.join(" ")).toContain("{{aluno}}");
    expect(problemas.join(" ")).toContain("{{data}}");
  });

  it("recusa corpo acima do limite da Meta", () => {
    const longo = `Aviso: ${"a".repeat(1100)}`;
    expect(problemasDoModelo({ ...base, corpo: longo }).join(" ")).toContain("1024");
  });

  it("recusa variável no rodapé e mais de uma no cabeçalho", () => {
    expect(problemasDoModelo({ ...base, rodape: "Escola {{escola}}" }).join(" ")).toContain(
      "rodapé não aceita",
    );
    expect(
      problemasDoModelo({
        ...base,
        cabecalho: "{{a}} e {{b}}",
        exemplos: ["x", "y", "z", "w"],
      }).join(" "),
    ).toContain("uma variável");
  });

  it("recusa botão de link sem endereço e botões demais", () => {
    expect(
      problemasDoModelo({
        ...base,
        botoes: [{ tipo: "link", texto: "Abrir", url: "escola.br" }],
      }).join(" "),
    ).toContain("http(s)");

    expect(
      problemasDoModelo({
        ...base,
        botoes: Array.from({ length: 4 }, (_, i) => ({
          tipo: "resposta" as const,
          texto: `Opção ${i}`,
        })),
      }).join(" "),
    ).toContain("No máximo 3");
  });

  it("garantirModelo lança com a lista inteira dentro", () => {
    try {
      garantirModelo({ ...base, nome: "X", corpo: "" });
      expect.unreachable("deveria ter lançado");
    } catch (error) {
      expect(error).toBeInstanceOf(ModeloMalFormadoError);
      expect((error as ModeloMalFormadoError).problemas.length).toBeGreaterThan(1);
    }
  });
});

describe("tradução para a Meta", () => {
  /**
   * Cabeçalho e corpo numeram **separado**: para a Meta são componentes
   * diferentes, e o `{{1}}` de um não é o `{{1}}` do outro. Numerar junto faz
   * a mensagem sair com o valor errado no lugar errado — e passa despercebido
   * até alguém ler o WhatsApp que chegou.
   */
  it("numera cabeçalho e corpo em sequências independentes", () => {
    const componentes = paraMeta(base);
    const header = componentes.find((c) => c.type === "HEADER");
    const body = componentes.find((c) => c.type === "BODY");

    expect(header?.text).toBe("Escola {{1}}");
    expect(body?.text).toBe("Olá, {{1}}. A reunião do {{2}} é dia {{3}}. Contamos com você.");
  });

  it("leva os exemplos na forma que a Meta espera", () => {
    const componentes = paraMeta(base);
    expect(componentes.find((c) => c.type === "HEADER")?.example).toEqual({
      header_text: ["Municipal X"],
    });
    expect(componentes.find((c) => c.type === "BODY")?.example).toEqual({
      body_text: [["Maria", "João", "12/10"]],
    });
  });

  it("traduz os três tipos de botão", () => {
    const componentes = paraMeta({
      ...base,
      botoes: [
        { tipo: "resposta", texto: "Confirmo" },
        { tipo: "link", texto: "Abrir", url: "https://escola.br" },
        { tipo: "telefone", texto: "Ligar", telefone: "+5586998122039" },
      ],
    });

    expect(componentes.find((c) => c.type === "BUTTONS")?.buttons).toEqual([
      { type: "QUICK_REPLY", text: "Confirmo" },
      { type: "URL", text: "Abrir", url: "https://escola.br" },
      { type: "PHONE_NUMBER", text: "Ligar", phone_number: "+5586998122039" },
    ]);
  });

  it("não manda componente vazio quando não há cabeçalho nem rodapé", () => {
    const componentes = paraMeta({
      ...base,
      cabecalho: null,
      rodape: "",
      exemplos: ["Maria", "João", "12/10"],
    });
    expect(componentes.map((c) => c.type)).toEqual(["BODY"]);
  });
});

describe("prévia", () => {
  it("preenche com os valores dados", () => {
    const previa = renderizar(base, {
      escola: "Municipal X",
      responsavel: "Ana",
      aluno: "Pedro",
      data: "12/10",
    });

    expect(previa.cabecalho).toBe("Escola Municipal X");
    expect(previa.corpo).toBe("Olá, Ana. A reunião do Pedro é dia 12/10. Contamos com você.");
    expect(textoRenderizado(previa)).toContain("Órbita Edu");
  });

  /**
   * Variável sem valor fica **visível**. Buraco silencioso numa mensagem que
   * já saiu é pior que um marcador que alguém vê na prévia e corrige.
   */
  it("deixa o marcador à mostra quando falta valor", () => {
    expect(renderizar(base, { escola: "X" }).corpo).toContain("{{responsavel}}");
  });

  it("os exemplos da Meta são os valores padrão da prévia", () => {
    expect(valoresDeExemplo(base)).toEqual({
      escola: "Municipal X",
      responsavel: "Maria",
      aluno: "João",
      data: "12/10",
    });
  });
});
