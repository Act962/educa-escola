/**
 * Os provedores que a tela oferece, com o endereço e alguns modelos.
 *
 * **A lista não escolhe nada por você.** Ela preenche o endereço para poupar
 * uma digitação e evitar erro de barra; o campo continua editável, e "Outro"
 * existe justamente para o provedor que não estiver aqui. Quem decide continua
 * sendo a direção — a lista é conveniência, não contrato.
 *
 * **Os nomes de modelo envelhecem.** Provedor lança e aposenta modelo o tempo
 * todo, e esta lista foi escrita num dia específico. Por isso o caminho
 * principal da tela é o botão que consulta `/models` no próprio provedor: ele
 * devolve o que existe hoje, não o que existia quando este arquivo foi
 * escrito. O que está aqui é o ponto de partida de quem ainda não salvou
 * credencial nenhuma.
 */
export interface Provider {
  id: string;
  name: string;
  /** Vazio quando o endereço é próprio da instalação (Azure, Ollama remoto). */
  baseUrl: string;
  modelos: string[];
  nota?: string;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    modelos: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1", "o4-mini"],
    nota: "O mais barato da lista costuma bastar: o Astro responde sobre números que já vêm prontos.",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    modelos: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
  },
  {
    id: "together",
    name: "Together",
    baseUrl: "https://api.together.xyz/v1",
    modelos: ["meta-llama/Llama-3.3-70B-Instruct-Turbo"],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    modelos: ["openai/gpt-4o-mini", "meta-llama/llama-3.3-70b-instruct"],
  },
  {
    id: "ollama",
    name: "Ollama (no seu servidor)",
    baseUrl: "http://localhost:11434/v1",
    modelos: ["llama3.1", "qwen2.5", "mistral"],
    nota: "Roda na máquina da escola: não sai dado para fora e não há fatura. Exige servidor com GPU.",
  },
  {
    id: "azure",
    name: "Azure OpenAI",
    baseUrl: "",
    modelos: [],
    nota: "O endereço é o do seu recurso, e o modelo é o nome do deployment que você criou.",
  },
  {
    id: "outro",
    name: "Outro",
    baseUrl: "",
    modelos: [],
    nota: "Precisa aceitar o formato /chat/completions.",
  },
];

/** Cai em "outro" quando a escola gravou um provedor que não está na lista. */
export function providerFor(id: string | null | undefined): Provider {
  return (
    PROVIDERS.find((p) => p.id === id) ?? (PROVIDERS.find((p) => p.id === "outro") as Provider)
  );
}

/**
 * O que os outros campos viram quando a direção troca de provedor.
 *
 * Função pura, e não uma linha solta dentro do `onChange`, porque a regra tem
 * uma armadilha: **manter o endereço do provedor anterior**. Escolher Ollama e
 * ficar com `api.openai.com` é a configuração que parece certa, salva sem
 * reclamar e só falha na primeira pergunta — com uma mensagem sobre
 * credencial, que manda a pessoa procurar no lugar errado.
 *
 * Por isso endereço e modelo são zerados juntos: são do provedor que saiu.
 */
export function fieldsOnProviderChange(id: string): {
  providerLabel: string;
  baseUrl: string;
  model: string;
  /** `true` quando não há lista para escolher e o campo vira texto. */
  modeloDigitado: boolean;
} {
  const escolhido = providerFor(id);

  return {
    providerLabel: escolhido.id,
    baseUrl: escolhido.baseUrl,
    /*
     * Já escolhe o primeiro sugerido, e **não** deixa vazio.
     *
     * O `Select` precisa de um valor para mostrar. Deixar o estado vazio e
     * exibir o primeiro item como se fosse o escolhido cria o pior tipo de
     * defeito: a tela diz `gpt-4o-mini`, o formulário manda vazio, e o
     * servidor recusa dizendo para preencher um campo que a pessoa está
     * vendo preenchido.
     */
    model: escolhido.modelos[0] ?? "",
    modeloDigitado: escolhido.modelos.length === 0,
  };
}
