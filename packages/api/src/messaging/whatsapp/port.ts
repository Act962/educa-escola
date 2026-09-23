/**
 * A porta do canal de WhatsApp.
 *
 * O resto do app enxerga só esta interface. Mesma ideia de `storage/port.ts` e
 * de `messaging/messenger.ts`: trocar o fornecedor é escrever outro adaptador,
 * e nenhum service, router ou tela muda.
 *
 * Isto não é zelo antecipado — é a situação de agora. **Estamos avaliando a API
 * oficial da Meta e alternativas não oficiais ao mesmo tempo.** Escrever para a
 * Graph API dentro dos services seria decidir por inércia uma escolha que ainda
 * está aberta, e desfazer depois seria reescrever o domínio.
 */

import type { ModeloDeMensagem } from "./template";

/**
 * O que este fornecedor sabe fazer.
 *
 * Existe porque o próximo adaptador **não vai ter modelos**. É aí que uma API
 * não oficial difere de verdade: ela manda texto livre para quem quiser e não
 * conhece aprovação da Meta. Sem um descritor, a aba de modelos apareceria
 * vazia e sem explicação; com ele, a tela diz "este fornecedor não usa modelos
 * aprovados", que é informação e não falha.
 */
export interface RecursosDoCanal {
  /** Manda mensagem a partir de modelo aprovado — e portanto inicia conversa. */
  modelos: boolean;
  /** Manda texto livre. Na API oficial, só dentro da janela de 24h. */
  textoLivre: boolean;
  /** Cria e consulta modelos pelo próprio sistema, sem o painel da Meta. */
  gestaoDeModelos: boolean;
}

export interface NumeroVerificado {
  /** Como a Meta formata o número: "+55 86 99812-2039". */
  numero: string;
  /** O nome que aparece para quem recebe. `null` enquanto não verificado. */
  nomeVerificado: string | null;
  /** `GREEN` · `YELLOW` · `RED`, ou `null` quando o fornecedor não reporta. */
  qualidade: string | null;
}

/**
 * O retorno de um envio: **aceito**, não entregue.
 *
 * Entrega e leitura chegam por webhook, que está fora deste MVP. Prometer
 * `entregue` no retorno da chamada seria mentir — e é o tipo de mentira que só
 * aparece quando alguém pergunta por que a mensagem não chegou.
 */
export interface EnvioAceito {
  /** O id da mensagem no provedor, quando ele devolve um. */
  providerMessageId: string | null;
}

export interface EnvioDeModelo {
  /** E.164, com o `+`. */
  para: string;
  nome: string;
  idioma: string;
  /** Valores do corpo, na ordem das variáveis. */
  variaveis: string[];
  /** Valores do cabeçalho, quando ele tem variável. */
  variaveisDoCabecalho?: string[];
}

export interface EnvioDeTexto {
  para: string;
  texto: string;
}

/** O estado do modelo no fornecedor, no vocabulário dele. */
export type StatusRemoto = "aprovado" | "enviado" | "recusado" | "pausado";

export interface ModeloRemoto {
  id: string | null;
  nome: string;
  idioma: string;
  status: StatusRemoto;
  categoria: string;
  /** O motivo da recusa, quando há. */
  motivo: string | null;
}

export interface WhatsAppChannel {
  /** Confere a credencial e devolve o que o provedor sabe do número. */
  verificar(): Promise<NumeroVerificado>;

  /**
   * Inicia conversa. É o caminho normal.
   *
   * Método próprio, e não `enviar({ tipo })`, porque as duas operações têm
   * regras distintas na origem: esta pode começar conversa, a outra não. Um
   * método só faria o service decidir por um booleano o que o fornecedor decide
   * por contrato — e o erro apareceria em produção, como mensagem não entregue.
   */
  enviarModelo(input: EnvioDeModelo): Promise<EnvioAceito>;

  /** Texto livre. Fora da janela de 24h, falha dizendo isso. */
  enviarTexto(input: EnvioDeTexto): Promise<EnvioAceito>;

  listarModelos(): Promise<ModeloRemoto[]>;
  criarModelo(modelo: ModeloDeMensagem): Promise<ModeloRemoto>;
  apagarModelo(nome: string): Promise<{ apagado: boolean }>;

  readonly recursos: RecursosDoCanal;
}

/**
 * Erros do canal, e não de domínio.
 *
 * Classes próprias, como em `storage/port.ts`, e pelo mesmo motivo: o canal não
 * sabe se "número inválido" vira 400 na tela ou linha de log num disparo em
 * massa. Quem traduz é o service do módulo consumidor.
 */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    /** `true` quando o problema é a configuração da escola, não uma falha nossa. */
    readonly daConfiguracao: boolean,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** 401/403: token errado, expirado ou sem o escopo `whatsapp_business_messaging`. */
export class CredencialRecusadaError extends WhatsAppError {
  constructor(message: string) {
    super(message, true);
  }
}

/** Destinatário fora do E.164, ou sem WhatsApp naquele número. */
export class NumeroInvalidoError extends WhatsAppError {
  constructor(message: string) {
    super(message, true);
  }
}

/**
 * Texto livre sem janela aberta.
 *
 * Erro próprio porque a saída é específica e a escola precisa ouvi-la: não é
 * "tente de novo", é "mande um modelo". Genérico, viraria suporte.
 */
export class ForaDaJanelaError extends WhatsAppError {
  constructor(message: string) {
    super(message, true);
  }
}

/** A Meta recusou o modelo — com o motivo dela, quando devolve um. */
export class ModeloInvalidoError extends WhatsAppError {
  constructor(message: string) {
    super(message, true);
  }
}

/** 5xx, prazo estourado, DNS. Não é com a escola. */
export class CanalIndisponivelError extends WhatsAppError {
  constructor(message: string) {
    super(message, false);
  }
}

/** O fornecedor não faz isso. Ver `recursos`. */
export class RecursoNaoSuportadoError extends WhatsAppError {
  constructor(message: string) {
    super(message, true);
  }
}

/**
 * E.164 como a Meta o quer.
 *
 * Validação na porta, e não em cada adaptador, pelo motivo de
 * `normalizeMetadata` no storage: sem ela o dublê aceitaria o que a Meta
 * recusa, e o teste que passa no CI quebraria em produção.
 */
const E164 = /^\+[1-9]\d{7,14}$/;

export function validarDestinatario(para: string): void {
  if (!E164.test(para)) {
    throw new NumeroInvalidoError(
      `O número ${JSON.stringify(para)} não está no formato internacional (+5586998122039).`,
    );
  }
}

/** Depois disso, quem clicou em "enviar" já foi ver outra coisa. */
export const PRAZO_MS = 20_000;
