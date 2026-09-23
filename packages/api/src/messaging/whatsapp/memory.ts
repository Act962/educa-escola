/**
 * O dublê: aceita, registra e não manda nada.
 *
 * Existe por dois motivos, e o segundo é o que costuma faltar em dublê de
 * teste. O primeiro é a suíte: todo PR roda o contrato sem tocar na Meta. O
 * segundo é a **demonstração** — apresentar o fluxo inteiro sem número
 * conectado, sem gastar conversa e sem mandar mensagem para ninguém de
 * verdade. `WHATSAPP_DRIVER=memoria` é isso.
 *
 * Ele recusa o que a Meta recusaria: número fora do E.164, modelo inexistente,
 * nome repetido, modelo mal formado. Dublê mais permissivo que o fornecedor é
 * pior que nenhum — faz o CI passar verde para código que quebra em produção.
 */

import {
  CanalIndisponivelError,
  type EnvioAceito,
  type EnvioDeModelo,
  type EnvioDeTexto,
  ModeloInvalidoError,
  type ModeloRemoto,
  type RecursosDoCanal,
  validarDestinatario,
  type WhatsAppChannel,
} from "./port";
import { garantirModelo, type ModeloDeMensagem } from "./template";

const RECURSOS: RecursosDoCanal = {
  modelos: true,
  textoLivre: true,
  gestaoDeModelos: true,
};

export interface EnvioRegistrado {
  tipo: "modelo" | "texto";
  para: string;
  /** O nome do modelo, ou o texto livre. */
  conteudo: string;
  em: Date;
}

export interface MemoryChannel extends WhatsAppChannel {
  /** O que foi "enviado". Só o dublê expõe isto — a porta não o conhece. */
  enviados(): EnvioRegistrado[];
}

export interface MemoryConfig {
  /**
   * O modelo nasce aprovado.
   *
   * `true` por padrão porque o dublê existe para a demonstração fluir: esperar
   * aprovação de uma Meta que não existe travaria o roteiro no primeiro passo.
   * O teste que precisa ver o estado de espera passa `false`.
   */
  aprovacaoImediata?: boolean;
  /** Número que o `verificar` devolve. */
  numero?: string;
}

export function createMemoryChannel(config: MemoryConfig = {}): MemoryChannel {
  const modelos = new Map<string, ModeloRemoto>();
  const registro: EnvioRegistrado[] = [];
  const aprovado = config.aprovacaoImediata ?? true;

  const chave = (nome: string, idioma: string) => `${nome}::${idioma}`;

  return {
    recursos: RECURSOS,

    async verificar() {
      return {
        numero: config.numero ?? "+55 86 99999-0000",
        nomeVerificado: "Escola (simulado)",
        // `null` e não `GREEN`: qualidade é coisa que só a Meta sabe, e um
        // dublê afirmando "excelente" ensinaria a tela a confiar em invenção.
        qualidade: null,
      };
    },

    async enviarModelo(input: EnvioDeModelo): Promise<EnvioAceito> {
      validarDestinatario(input.para);

      const remoto = modelos.get(chave(input.nome, input.idioma));
      if (!remoto) {
        throw new ModeloInvalidoError(
          `O modelo "${input.nome}" não existe em ${input.idioma}. Crie e aguarde a aprovação.`,
        );
      }
      if (remoto.status !== "aprovado") {
        throw new ModeloInvalidoError(
          `O modelo "${input.nome}" ainda não foi aprovado. Só modelo aprovado inicia conversa.`,
        );
      }

      registro.push({ tipo: "modelo", para: input.para, conteudo: input.nome, em: new Date() });
      return { providerMessageId: `simulado-${registro.length}` };
    },

    async enviarTexto(input: EnvioDeTexto): Promise<EnvioAceito> {
      validarDestinatario(input.para);
      if (!input.texto.trim()) {
        throw new CanalIndisponivelError("Mensagem vazia.");
      }

      registro.push({ tipo: "texto", para: input.para, conteudo: input.texto, em: new Date() });
      return { providerMessageId: `simulado-${registro.length}` };
    },

    async listarModelos() {
      return [...modelos.values()];
    },

    async criarModelo(modelo: ModeloDeMensagem) {
      garantirModelo(modelo);

      if (modelos.has(chave(modelo.nome, modelo.idioma))) {
        throw new ModeloInvalidoError(
          `Já existe um modelo chamado "${modelo.nome}" em ${modelo.idioma}.`,
        );
      }

      const remoto: ModeloRemoto = {
        id: `simulado-${modelo.nome}`,
        nome: modelo.nome,
        idioma: modelo.idioma,
        status: aprovado ? "aprovado" : "enviado",
        categoria: modelo.categoria,
        motivo: null,
      };

      modelos.set(chave(modelo.nome, modelo.idioma), remoto);
      return remoto;
    },

    async apagarModelo(nome: string) {
      let apagado = false;
      for (const k of [...modelos.keys()]) {
        if (k.startsWith(`${nome}::`)) {
          modelos.delete(k);
          apagado = true;
        }
      }
      return { apagado };
    },

    enviados: () => [...registro],
  };
}
