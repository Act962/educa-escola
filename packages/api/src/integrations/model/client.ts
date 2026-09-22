/**
 * O modelo de linguagem do Astro, atrás de uma interface.
 *
 * Mesmo padrão do `messenger` do WhatsApp e do `OrbitaCatalog`: o serviço não
 * conhece provedor nenhum, conhece esta forma. Trocar de fornecedor é outra
 * implementação, não uma mudança no domínio.
 */
export interface LanguageModel {
  responder(input: {
    sistema: string;
    pergunta: string;
    maxTokens: number;
  }): Promise<{ texto: string; tokens: number | null }>;
  /**
   * Os modelos que o provedor oferece agora.
   *
   * Existe porque nome de modelo envelhece: provedor lança e aposenta o tempo
   * todo, e uma lista escrita no código estaria errada em três meses. Perguntar
   * a ele devolve o que existe hoje.
   */
  listarModelos(): Promise<string[]>;
}

export class ModelError extends Error {
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
export function createCompatibleClient(config: {
  baseUrl: string;
  apiKey: string;
  model: string;
  /** `org-…` da OpenAI. Vira o cabeçalho `OpenAI-Organization`. */
  organizationId?: string | null;
}): LanguageModel {
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
      } catch (error) {
        // Endereço errado, DNS, servidor fora, prazo estourado: tudo isso é
        // configuração da escola, e a mensagem precisa dizer isso para a
        // direção saber que é com ela.
        throw new ModelError(
          error instanceof Error && error.name === "TimeoutError"
            ? "O modelo não respondeu em 30 segundos."
            : "Não foi possível falar com o modelo. Confira o endereço nas configurações.",
          true,
        );
      }

      if (!resposta.ok) {
        throw new ModelError(
          mensagemDoStatus(resposta.status, await codigoDoProvedor(resposta)),
          resposta.status < 500,
        );
      }

      const data = (await resposta.json().catch(() => null)) as {
        choices?: { message?: { content?: string } }[];
        usage?: { total_tokens?: number };
      } | null;

      const texto = data?.choices?.[0]?.message?.content?.trim();
      if (!texto) {
        throw new ModelError("O modelo respondeu num formato que não reconheço.", true);
      }

      return { texto, tokens: data?.usage?.total_tokens ?? null };
    },

    async listarModelos() {
      const list = `${config.baseUrl.replace(/\/+$/, "")}/models`;
      let resposta: Response;

      try {
        resposta = await fetch(list, {
          headers: {
            authorization: `Bearer ${config.apiKey}`,
            ...(config.organizationId ? { "openai-organization": config.organizationId } : {}),
          },
          signal: AbortSignal.timeout(PRAZO_MS),
        });
      } catch {
        throw new ModelError(
          "Não foi possível falar com o modelo. Confira o endereço nas configurações.",
          true,
        );
      }

      if (!resposta.ok) {
        throw new ModelError(
          mensagemDoStatus(resposta.status, await codigoDoProvedor(resposta)),
          resposta.status < 500,
        );
      }

      const data = (await resposta.json().catch(() => null)) as {
        data?: { id?: string }[];
      } | null;

      const ids = (data?.data ?? [])
        .map((linha) => linha.id)
        .filter((id): id is string => typeof id === "string" && id.length > 0);

      if (ids.length === 0) {
        // Endpoint que existe mas devolve vazio (ou noutro formato) não é
        // falha nossa: a escola digita o nome e segue.
        throw new ModelError(
          "O provedor não devolveu nenhum modelo. Digite o nome do modelo à mão.",
          true,
        );
      }

      return ids.sort((a, b) => a.localeCompare(b));
    },
  };
}

/**
 * O `error.code` que o provedor devolveu — `invalid_api_key`,
 * `insufficient_quota`, `model_not_found`.
 *
 * Só o código, **nunca a mensagem**: a mensagem às vezes ecoa parte da
 * requisição, e a requisição carrega os fatos da escola. O código é um token
 * curto e fixo do provedor, e é justamente ele que distingue chave inválida de
 * chave sem saldo — duas coisas que a direção resolve em lugares diferentes.
 */
async function codigoDoProvedor(resposta: Response): Promise<string | null> {
  try {
    const corpo = (await resposta.json()) as { error?: { code?: string } };
    const code = corpo?.error?.code;
    // Limita o tamanho porque quem garante que aquilo é código somos nós, não
    // o provedor: campo grande ali não é código, é texto, e texto não passa.
    return typeof code === "string" && code.length > 0 && code.length <= 40 ? code : null;
  } catch {
    return null;
  }
}

/**
 * Traduz o status para quem vai resolver o problema.
 *
 * "401" não diz nada para a secretaria; "a chave foi recusada" manda ela para
 * a tela certa. O corpo da resposta do provedor **não** entra na mensagem: ele
 * às vezes ecoa parte da requisição, e a requisição tem dado de aluno. Só o
 * `error.code` passa, e passa porque sem ele a escola não sabe se troca a
 * chave ou se põe saldo.
 */
function mensagemDoStatus(status: number, code: string | null): string {
  const sufixo = code ? ` (o provedor respondeu "${code}")` : "";

  if (status === 401 || status === 403) {
    return `O modelo recusou a credencial. Confira a chave nas configurações${sufixo}.`;
  }
  if (status === 404) {
    return `O endereço ou o nome do modelo não existe. Confira as configurações${sufixo}.`;
  }
  if (status === 429) {
    // 429 é tanto "muitas requisições" quanto "acabou o saldo", e só o código
    // separa as duas — uma se resolve esperando, a outra no cartão.
    return `O provedor limitou o uso agora${sufixo}. Tente de novo em instantes.`;
  }
  return status >= 500
    ? "O provedor do modelo está com problema. Tente de novo mais tarde."
    : `O provedor recusou a requisição (${status})${sufixo}.`;
}
