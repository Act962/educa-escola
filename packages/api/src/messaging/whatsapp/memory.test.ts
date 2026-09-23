import { describe, expect, it } from "vitest";

import { testWhatsAppChannelContract } from "./contract";
import { createMemoryChannel } from "./memory";
import { ModeloInvalidoError, NumeroInvalidoError } from "./port";
import type { ModeloDeMensagem } from "./template";

/**
 * O dublê contra o contrato compartilhado.
 *
 * É esta execução que roda em todo PR. A da Meta só acontece com credencial no
 * ambiente — então um caso que só exista lá não é coberto em pull request
 * nenhum. Caso novo vai para `contract.ts`.
 */
testWhatsAppChannelContract("memoria", async () => ({
  canal: createMemoryChannel(),
  sufixo: Math.random().toString(36).slice(2, 8),
  destinatario: "+5586998122039",
  cleanup: async () => {},
}));

const modelo: ModeloDeMensagem = {
  nome: "aviso_de_reuniao",
  categoria: "UTILITY",
  idioma: "pt_BR",
  corpo: "Olá, {{responsavel}}. A reunião é dia {{data}}. Contamos com você.",
  exemplos: ["Maria", "12/10"],
};

describe("o dublê", () => {
  it("registra o que foi enviado", async () => {
    const canal = createMemoryChannel();
    await canal.criarModelo(modelo);
    await canal.enviarModelo({
      para: "+5586998122039",
      nome: modelo.nome,
      idioma: "pt_BR",
      variaveis: ["Ana", "12/10"],
    });

    expect(canal.enviados()).toHaveLength(1);
    expect(canal.enviados()[0]).toMatchObject({ tipo: "modelo", para: "+5586998122039" });
  });

  /**
   * Dublê mais permissivo que o fornecedor é pior que nenhum: faz o CI passar
   * verde para código que quebra em produção. Estas três recusas são as que a
   * Meta faz e que o caminho feliz nunca exercita.
   */
  it("recusa mandar por modelo ainda em aprovação", async () => {
    const canal = createMemoryChannel({ aprovacaoImediata: false });
    await canal.criarModelo(modelo);

    await expect(
      canal.enviarModelo({
        para: "+5586998122039",
        nome: modelo.nome,
        idioma: "pt_BR",
        variaveis: ["Ana", "12/10"],
      }),
    ).rejects.toBeInstanceOf(ModeloInvalidoError);
  });

  it("recusa nome de modelo repetido no mesmo idioma", async () => {
    const canal = createMemoryChannel();
    await canal.criarModelo(modelo);
    await expect(canal.criarModelo(modelo)).rejects.toBeInstanceOf(ModeloInvalidoError);
  });

  it("aceita o mesmo nome em outro idioma", async () => {
    const canal = createMemoryChannel();
    await canal.criarModelo(modelo);
    await expect(canal.criarModelo({ ...modelo, idioma: "es" })).resolves.toMatchObject({
      idioma: "es",
    });
  });

  it("recusa número sem o código do país", async () => {
    const canal = createMemoryChannel();
    await expect(
      canal.enviarTexto({ para: "(86) 99812-2039", texto: "oi" }),
    ).rejects.toBeInstanceOf(NumeroInvalidoError);
  });

  /**
   * Qualidade é coisa que só a Meta sabe. Um dublê afirmando "excelente"
   * ensinaria a tela a exibir invenção como fato.
   */
  it("não inventa a qualidade do número", async () => {
    const canal = createMemoryChannel();
    expect((await canal.verificar()).qualidade).toBeNull();
  });
});
