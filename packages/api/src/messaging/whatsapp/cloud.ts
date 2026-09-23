/**
 * O adaptador da API oficial da Meta — a WhatsApp Cloud API.
 *
 * **Único arquivo do sistema que conhece `graph.facebook.com`**, e há um teste
 * de arquitetura que reprova quem o contrariar. Mesma regra do `@aws-sdk` em
 * `storage/r2.ts`: o dia de trocar de fornecedor precisa ser o dia de escrever
 * um irmão deste arquivo, não o de caçar URL pelo código.
 *
 * Sem SDK. A `whatsapp-business` oficial não acrescenta nada que estes quatro
 * `fetch` não façam, e traria uma dependência que envelhece junto com a versão
 * da Graph API — que já é parâmetro aqui, para subir de v21 sem tocar em
 * `package.json`.
 */

import {
  CanalIndisponivelError,
  CredencialRecusadaError,
  type EnvioAceito,
  type EnvioDeModelo,
  type EnvioDeTexto,
  ForaDaJanelaError,
  ModeloInvalidoError,
  type ModeloRemoto,
  NumeroInvalidoError,
  type NumeroVerificado,
  PRAZO_MS,
  type RecursosDoCanal,
  type StatusRemoto,
  validarDestinatario,
  type WhatsAppChannel,
} from "./port";
import { garantirModelo, type ModeloDeMensagem, paraMeta } from "./template";

export interface CloudConfig {
  /** O id do número, não o número. Vem do painel da Meta. */
  phoneNumberId: string;
  /** O WhatsApp Business Account: a conta dona dos modelos. */
  wabaId: string;
  token: string;
  /** `v21.0` por padrão. Parâmetro para subir de versão sem mexer no código. */
  apiVersion?: string;
}

const VERSAO_PADRAO = "v21.0";

const RECURSOS: RecursosDoCanal = {
  modelos: true,
  textoLivre: true,
  gestaoDeModelos: true,
};

export function createCloudChannel(config: CloudConfig): WhatsAppChannel {
  const base = `https://graph.facebook.com/${config.apiVersion ?? VERSAO_PADRAO}`;

  async function chamar(
    caminho: string,
    init: { method: "GET" | "POST" | "DELETE"; body?: unknown },
  ): Promise<Record<string, unknown>> {
    let resposta: Response;

    try {
      resposta = await fetch(`${base}/${caminho}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${config.token}`,
          ...(init.body ? { "content-type": "application/json" } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(PRAZO_MS),
      });
    } catch (error) {
      throw new CanalIndisponivelError(
        error instanceof Error && error.name === "TimeoutError"
          ? "O WhatsApp não respondeu em 20 segundos. Tente de novo."
          : "Não foi possível falar com o WhatsApp agora.",
      );
    }

    const corpo = (await resposta.json().catch(() => null)) as Record<string, unknown> | null;

    if (!resposta.ok) throw traduzir(resposta.status, corpo);
    return corpo ?? {};
  }

  return {
    recursos: RECURSOS,

    async verificar() {
      const dados = await chamar(
        `${config.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`,
        { method: "GET" },
      );

      return {
        numero: texto(dados.display_phone_number) ?? "",
        nomeVerificado: texto(dados.verified_name),
        qualidade: texto(dados.quality_rating),
      } satisfies NumeroVerificado;
    },

    async enviarModelo(input: EnvioDeModelo): Promise<EnvioAceito> {
      validarDestinatario(input.para);

      const componentes: unknown[] = [];
      if (input.variaveisDoCabecalho?.length) {
        componentes.push({
          type: "header",
          parameters: input.variaveisDoCabecalho.map((text) => ({ type: "text", text })),
        });
      }
      if (input.variaveis.length > 0) {
        componentes.push({
          type: "body",
          parameters: input.variaveis.map((text) => ({ type: "text", text })),
        });
      }

      const dados = await chamar(`${config.phoneNumberId}/messages`, {
        method: "POST",
        body: {
          messaging_product: "whatsapp",
          // `individual` e não `group`: a Cloud API não manda para grupo, e
          // deixar implícito faria a diferença aparecer só na fase do webhook.
          recipient_type: "individual",
          to: input.para,
          type: "template",
          template: {
            name: input.nome,
            language: { code: input.idioma },
            ...(componentes.length > 0 ? { components: componentes } : {}),
          },
        },
      });

      return { providerMessageId: primeiroIdDeMensagem(dados) };
    },

    async enviarTexto(input: EnvioDeTexto): Promise<EnvioAceito> {
      validarDestinatario(input.para);

      const dados = await chamar(`${config.phoneNumberId}/messages`, {
        method: "POST",
        body: {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: input.para,
          type: "text",
          // Desligado de propósito: prévia de link busca a página no servidor
          // da Meta e muda a cara da mensagem sem a escola ter pedido.
          text: { body: input.texto, preview_url: false },
        },
      });

      return { providerMessageId: primeiroIdDeMensagem(dados) };
    },

    async listarModelos() {
      const dados = await chamar(
        `${config.wabaId}/message_templates?limit=100&fields=id,name,language,status,category,rejected_reason`,
        { method: "GET" },
      );

      const linhas = Array.isArray(dados.data) ? (dados.data as Record<string, unknown>[]) : [];

      return linhas.map(
        (linha) =>
          ({
            id: texto(linha.id),
            nome: texto(linha.name) ?? "",
            idioma: texto(linha.language) ?? "",
            status: statusDaMeta(texto(linha.status)),
            categoria: texto(linha.category) ?? "UTILITY",
            motivo: motivoDaRecusa(texto(linha.rejected_reason)),
          }) satisfies ModeloRemoto,
      );
    },

    async criarModelo(modelo: ModeloDeMensagem) {
      // Antes de gastar uma ida à Meta e horas de revisão: o que ela recusaria
      // depois é recusado aqui, com a frase em português. É a mesma checagem
      // que o dublê faz, e é o que mantém o contrato compartilhado honesto.
      garantirModelo(modelo);

      const dados = await chamar(`${config.wabaId}/message_templates`, {
        method: "POST",
        body: {
          name: modelo.nome,
          language: modelo.idioma,
          category: modelo.categoria,
          components: paraMeta(modelo),
        },
      });

      return {
        id: texto(dados.id),
        nome: modelo.nome,
        idioma: modelo.idioma,
        // A Meta devolve `PENDING` na criação; quem responde de fato é a
        // revisão dela, horas depois. Por isso existe o botão de sincronizar.
        status: statusDaMeta(texto(dados.status)),
        categoria: texto(dados.category) ?? modelo.categoria,
        motivo: null,
      } satisfies ModeloRemoto;
    },

    async apagarModelo(nome: string) {
      await chamar(`${config.wabaId}/message_templates?name=${encodeURIComponent(nome)}`, {
        method: "DELETE",
      });
      return { apagado: true };
    },
  };
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.length > 0 ? valor : null;
}

/** `{ messages: [{ id }] }` — a Cloud API devolve uma lista de uma posição. */
function primeiroIdDeMensagem(dados: Record<string, unknown>): string | null {
  const mensagens = Array.isArray(dados.messages)
    ? (dados.messages as Record<string, unknown>[])
    : [];
  return texto(mensagens[0]?.id);
}

/**
 * O vocabulário da Meta, traduzido.
 *
 * `PENDING` e `IN_APPEAL` viram `enviado` porque, para a escola, são a mesma
 * situação: mandou, está esperando. Distinguir os dois na tela pediria um
 * glossário que ninguém vai ler.
 */
function statusDaMeta(status: string | null): StatusRemoto {
  switch (status) {
    case "APPROVED":
      return "aprovado";
    case "REJECTED":
      return "recusado";
    case "PAUSED":
    case "DISABLED":
      return "pausado";
    default:
      return "enviado";
  }
}

/** `INVALID_FORMAT` → uma frase que a secretaria entende. */
function motivoDaRecusa(motivo: string | null): string | null {
  if (!motivo || motivo === "NONE") return null;

  const conhecidos: Record<string, string> = {
    INVALID_FORMAT: "A Meta considerou o formato inválido — revise variáveis e exemplos.",
    ABUSIVE_CONTENT: "A Meta considerou o conteúdo abusivo.",
    PROMOTIONAL: "A Meta entendeu o texto como promoção numa categoria de utilidade.",
    TAGGED_CONTENT: "A Meta pediu outra categoria para este conteúdo.",
    SCAM: "A Meta suspeitou de golpe no conteúdo.",
  };

  return conhecidos[motivo] ?? `A Meta recusou: ${motivo}.`;
}

/**
 * O erro da Graph API, traduzido para quem vai resolver o problema.
 *
 * "400" não diz nada para a secretaria. A mensagem da Meta **não** entra no
 * texto que a escola lê: ela às vezes ecoa parte da requisição, e a requisição
 * carrega o número da família. O que passa é o código, que é curto, fixo, e é
 * justamente ele que separa token vencido de janela fechada — duas coisas que
 * se resolvem em lugares diferentes.
 */
function traduzir(status: number, corpo: Record<string, unknown> | null): Error {
  const erro = (corpo?.error ?? {}) as Record<string, unknown>;
  const code = typeof erro.code === "number" ? erro.code : null;
  const sufixo = code ? ` (código ${code})` : "";

  // 131047: "re-engagement message" — a janela de 24h fechou. É o erro mais
  // comum de quem tenta texto livre, e o único cuja saída é outro caminho.
  if (code === 131047 || code === 131051) {
    return new ForaDaJanelaError(
      "Faz mais de 24 horas desde a última mensagem dessa pessoa. " +
        "Para recomeçar a conversa, use um modelo aprovado.",
    );
  }

  if (code === 131026 || code === 131052) {
    return new NumeroInvalidoError(
      "Esse número não recebe mensagem no WhatsApp. Confira com a família.",
    );
  }

  if (status === 401 || status === 403 || code === 190 || code === 200) {
    return new CredencialRecusadaError(
      "O WhatsApp recusou a credencial. O token pode ter expirado — " +
        `gere um token permanente de System User no Business Manager${sufixo}.`,
    );
  }

  if (status === 429 || code === 80007 || code === 130429) {
    return new CanalIndisponivelError(
      "O WhatsApp limitou os envios agora. Tente de novo em alguns minutos.",
    );
  }

  if (status >= 500) {
    return new CanalIndisponivelError("O WhatsApp está com problema. Tente de novo mais tarde.");
  }

  // 400 com detalhe de modelo: a criação foi recusada, e o motivo é acionável.
  const detalhe = (erro.error_user_msg ?? erro.error_data) as unknown;
  if (typeof detalhe === "string" && detalhe.length <= 200) {
    return new ModeloInvalidoError(`O WhatsApp recusou: ${detalhe}`);
  }

  return new ModeloInvalidoError(`O WhatsApp recusou a requisição${sufixo}.`);
}
