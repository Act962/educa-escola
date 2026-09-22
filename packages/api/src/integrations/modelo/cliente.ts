/**
 * O modelo de linguagem do Astro, atrás de uma interface.
 *
 * Mesmo padrão do `messenger` do WhatsApp e do `OrbitaCatalog`: o serviço não
 * conhece provedor nenhum, conhece esta forma. Trocar de fornecedor é outra
 * implementação, não uma mudança no domínio.
 */
export interface ModeloDeLinguagem {
  responder(input: {
    sistema: string;
    pergunta: string;
    maxTokens: number;
  }): Promise<{ texto: string; tokens: number | null }>;
}

export class ErroDoModelo extends Error {
  constructor(
    message: string,
    /** `true` quando o problema é a configuração da escola, não uma falha nossa. */
    readonly daConfiguracao: boolean,
  ) {
    super(message);
    this.name = "ErroDoModelo";
  }
}

/** Depois disso, a pessoa já desistiu de esperar por uma resposta. */
const PRAZO_MS = 30_000;

/**
 * Cliente para qualquer endpoint no formato `/chat/completions`.
 *
 * DECISÃO-JOÃO: qual provedor de modelo a escola usa.
 * Quebra se: este cliente assume o formato de requisição e resposta que a
 *   OpenAI popularizou. Vale para OpenAI, Azure OpenAI, Groq, Together,
 *   OpenRouter e Ollama — e **não** vale para a API nativa da Anthropic nem
 *   para a do Gemini, que têm outro corpo. Escola que apontar para uma dessas
 *   recebe erro de formato, não resposta.
 * Fiz assim: nenhuma dependência nova no `package.json`, nenhum provedor
 *   escolhido no código — quem escolhe é o endereço que a direção digita na
 *   tela. É o que mantém a decisão sua, e não minha.
 * Alternativas: um SDK por provedor (traz dependência e amarra a escolha) ·
 *   uma camada tipo Vercel AI SDK ou LiteLLM, que normaliza os formatos e
 *   custa uma dependência a mais.
 */
export function createClienteCompativel(config: {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** `org-…` da OpenAI. Vira o cabeçalho `OpenAI-Organization`. */
  organizationId?: string | null;
}): ModeloDeLinguagem {
  // Tolera o endereço com e sem barra no fim: os dois aparecem na
  // documentação dos provedores, e quem digita não deve pagar por isso.
  const endereco = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    async responder({ sistema, pergunta, maxTokens }) {
      let resposta: Response;

      try {
        resposta = await fetch(endereco, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${config.apiKey}`,
            // Só quando existe: provedor que não conhece o cabeçalho ignora,
            // mas mandar `OpenAI-Organization: null` é pedir 400 de graça.
            ...(config.organizationId ? { "openai-organization": config.organizationId } : {}),
          },
          body: JSON.stringify({
            model: config.model,
            max_tokens: maxTokens,
            // Baixa de propósito: o Astro responde sobre número de escola.
            // Criatividade aqui é sinônimo de inventar dado.
            temperature: 0.2,
            messages: [
              { role: "system", content: sistema },
              { role: "user", content: pergunta },
            ],
          }),
          signal: AbortSignal.timeout(PRAZO_MS),
        });
      } catch (erro) {
        // Endereço errado, DNS, servidor fora, prazo estourado: tudo isso é
        // configuração da escola, e a mensagem precisa dizer isso para a
        // direção saber que é com ela.
        throw new ErroDoModelo(
          erro instanceof Error && erro.name === "TimeoutError"
            ? "O modelo não respondeu em 30 segundos."
            : "Não foi possível falar com o modelo. Confira o endereço nas configurações.",
          true,
        );
      }

      if (!resposta.ok) {
        const corpo = await resposta.text().catch(() => "");
        throw new ErroDoModelo(mensagemDoStatus(resposta.status, corpo), resposta.status < 500);
      }

      const dados = (await resposta.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      } | null;

      const texto = dados?.choices?.[0]?.message?.content?.trim();
      if (!texto) {
        throw new ErroDoModelo("O modelo respondeu num formato que não reconheço.", true);
      }

      return { texto, tokens: dados?.usage?.total_tokens ?? null };
    },
  };
}

/**
 * Traduz o status para quem vai resolver o problema.
 *
 * "401" não diz nada para a secretaria; "a chave foi recusada" manda ela para
 * a tela certa. O corpo da resposta do provedor **não** entra na mensagem: ele
 * às vezes ecoa parte da requisição, e a requisição tem dado de aluno.
 */
function mensagemDoStatus(status: number, _corpo: string): string {
  if (status === 401 || status === 403) {
    return "O modelo recusou a credencial. Confira a chave nas configurações.";
  }
  if (status === 404) {
    return "O endereço ou o nome do modelo não existe. Confira as configurações.";
  }
  if (status === 429) {
    return "O provedor limitou o uso agora. Tente de novo em instantes.";
  }
  return status >= 500
    ? "O provedor do modelo está com problema. Tente de novo mais tarde."
    : `O provedor recusou a requisição (${status}).`;
}
