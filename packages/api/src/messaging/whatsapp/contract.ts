import { describe, expect, it } from "vitest";

import { ModeloInvalidoError, NumeroInvalidoError, type WhatsAppChannel } from "./port";
import { type ModeloDeMensagem, ModeloMalFormadoError } from "./template";

/**
 * A suíte de contrato: **um texto só, rodado contra os dois adaptadores**.
 *
 * Mesma ideia de `storage/contract.ts`, e pelo mesmo motivo: se o teste do
 * dublê fosse outro texto que o teste da Meta, "passa em memória" deixaria de
 * significar alguma coisa — e é exatamente aí que dublê mente. Em todo PR ela
 * roda contra `memoria`; contra a Cloud API, só quando há credencial no
 * ambiente.
 *
 * O que entra aqui é o que **os dois precisam garantir**: recusa de número
 * fora do E.164, recusa de modelo mal formado, e a ida e volta de criar,
 * listar e apagar modelo. O que é de um só — a tradução de código de erro da
 * Meta, o registro de envios do dublê — fica no teste do adaptador.
 */

export interface CanalContractFixture {
  canal: WhatsAppChannel;
  /**
   * Sufixo próprio deste ambiente, para o nome do modelo.
   *
   * Contra a Meta de verdade os nomes vivem numa conta compartilhada e as
   * execuções se atropelam: sem sufixo, o segundo `criarModelo` encontraria o
   * modelo da execução anterior e falharia por nome repetido.
   */
  sufixo: string;
  /** Um número que aceita mensagem neste ambiente. */
  destinatario: string;
  cleanup: () => Promise<void>;
}

export function testWhatsAppChannelContract(
  nome: string,
  create: () => Promise<CanalContractFixture>,
): void {
  describe(`contrato de WhatsAppChannel — ${nome}`, () => {
    const modeloBase = (sufixo: string): ModeloDeMensagem => ({
      nome: `contrato_${sufixo}`,
      categoria: "UTILITY",
      idioma: "pt_BR",
      corpo: "Olá, {{nome}}. A reunião é dia {{data}}. Contamos com você.",
      rodape: "Órbita Edu",
      exemplos: ["Maria", "12/10"],
    });

    it("recusa destinatário fora do E.164", async () => {
      const { canal, cleanup } = await create();
      try {
        await expect(
          canal.enviarTexto({ para: "86998122039", texto: "oi" }),
        ).rejects.toBeInstanceOf(NumeroInvalidoError);
      } finally {
        await cleanup();
      }
    });

    it("recusa modelo mal formado antes de gastar uma ida ao fornecedor", async () => {
      const { canal, sufixo, cleanup } = await create();
      try {
        await expect(
          canal.criarModelo({
            ...modeloBase(sufixo),
            // Corpo terminando em variável: a Meta recusa, e recusar só lá
            // custaria horas de espera por um defeito de uma linha.
            corpo: "A reunião é dia {{data}}",
          }),
        ).rejects.toBeInstanceOf(ModeloMalFormadoError);
      } finally {
        await cleanup();
      }
    });

    it("cria, lista e apaga um modelo", async () => {
      const { canal, sufixo, cleanup } = await create();
      const modelo = modeloBase(sufixo);

      try {
        const criado = await canal.criarModelo(modelo);
        expect(criado.nome).toBe(modelo.nome);
        // Nunca "aprovado" como garantia: a Meta aprova quando quer, e o dublê
        // só finge. O que o contrato exige é que o modelo **apareça**.
        expect(["aprovado", "enviado"]).toContain(criado.status);

        const lista = await canal.listarModelos();
        expect(lista.map((m) => m.nome)).toContain(modelo.nome);

        const { apagado } = await canal.apagarModelo(modelo.nome);
        expect(apagado).toBe(true);
      } finally {
        await cleanup();
      }
    });

    it("recusa enviar por um modelo que não existe", async () => {
      const { canal, destinatario, sufixo, cleanup } = await create();
      try {
        await expect(
          canal.enviarModelo({
            para: destinatario,
            nome: `inexistente_${sufixo}`,
            idioma: "pt_BR",
            variaveis: [],
          }),
        ).rejects.toBeInstanceOf(ModeloInvalidoError);
      } finally {
        await cleanup();
      }
    });

    it("diz o que sabe fazer", async () => {
      const { canal, cleanup } = await create();
      try {
        // `recursos` é o que permite a tela explicar a ausência de modelos num
        // fornecedor que não os tem, em vez de mostrar uma lista vazia.
        expect(typeof canal.recursos.modelos).toBe("boolean");
        expect(typeof canal.recursos.textoLivre).toBe("boolean");
        expect(typeof canal.recursos.gestaoDeModelos).toBe("boolean");
      } finally {
        await cleanup();
      }
    });
  });
}
