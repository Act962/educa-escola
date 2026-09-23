/**
 * O modelo de mensagem como dado puro.
 *
 * Sem rede, sem banco, sem tela — porque é aqui que mora a regra que a Meta
 * cobra e que a escola não conhece. A aprovação de um modelo leva de minutos a
 * horas; recusar na tela o que seria recusado lá é a única coisa que o código
 * pode fazer pelo tempo de quem escreve.
 *
 * **As variáveis são nomeadas aqui e posicionais na saída.** Quem escreve
 * digita `{{nome_do_aluno}}`; o que vai para a Meta é `{{1}}`. Expor `{{1}}`
 * para a secretaria é o erro que todo produto que tentou já cometeu: numa
 * mensagem com quatro variáveis ninguém lembra qual é a 3.
 */

export const CATEGORIAS = ["UTILITY", "MARKETING", "AUTHENTICATION"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const CATEGORIA_LABEL: Record<Categoria, string> = {
  UTILITY: "Utilidade — aviso, lembrete, confirmação",
  MARKETING: "Divulgação — campanha, convite, promoção",
  AUTHENTICATION: "Autenticação — código de verificação",
};

export type TipoDeBotao = "resposta" | "link" | "telefone";

export interface Botao {
  tipo: TipoDeBotao;
  texto: string;
  /** Só em `link`. */
  url?: string;
  /** Só em `telefone`, em E.164. */
  telefone?: string;
}

export interface ModeloDeMensagem {
  /** `snake_case`, único na conta da Meta. É a chave do envio. */
  nome: string;
  categoria: Categoria;
  idioma: string;
  /** Cabeçalho de texto. Mídia fica para a fase seguinte. */
  cabecalho?: string | null;
  corpo: string;
  rodape?: string | null;
  botoes?: Botao[];
  /**
   * Um exemplo por variável, na ordem de `variaveisDoModelo` — cabeçalho
   * primeiro, corpo depois.
   *
   * A Meta **exige** exemplo para aprovar: ela revisa a mensagem preenchida,
   * não o esqueleto. Sem isto o modelo volta recusado horas depois, com um
   * motivo que ninguém liga ao campo que faltou.
   */
  exemplos: string[];
}

export const LIMITE_CORPO = 1024;
export const LIMITE_CABECALHO = 60;
export const LIMITE_RODAPE = 60;
export const LIMITE_TEXTO_DO_BOTAO = 25;
export const MAX_BOTOES_DE_RESPOSTA = 3;
export const MAX_BOTOES_DE_LINK = 2;
export const MAX_BOTOES_DE_TELEFONE = 1;

const NOME_VALIDO = /^[a-z][a-z0-9_]{2,511}$/;
const VARIAVEL = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

/** As variáveis de um texto, únicas e na ordem em que aparecem. */
export function variaveisDe(texto: string): string[] {
  const vistas: string[] = [];
  for (const [, nome] of texto.matchAll(VARIAVEL)) {
    if (nome && !vistas.includes(nome)) vistas.push(nome);
  }
  return vistas;
}

/**
 * Todas as variáveis do modelo: cabeçalho primeiro, corpo depois.
 *
 * A ordem é o contrato com `exemplos` — e com a tela, que preenche os campos
 * de teste nessa mesma sequência. Trocar a ordem aqui desalinha exemplo de
 * variável em todo modelo já gravado.
 */
export function variaveisDoModelo(modelo: ModeloDeMensagem): string[] {
  const doCabecalho = variaveisDe(modelo.cabecalho ?? "");
  const doCorpo = variaveisDe(modelo.corpo);
  return [...doCabecalho, ...doCorpo.filter((v) => !doCabecalho.includes(v))];
}

/**
 * O que está errado no modelo, em português, tudo de uma vez.
 *
 * Lista e não exceção: a tela mostra os problemas enquanto a pessoa digita, e
 * parar no primeiro faria o editor revelar um defeito por vez. Quem precisa de
 * exceção — o service, antes de mandar para a Meta — usa `garantirModelo`.
 */
export function problemasDoModelo(modelo: ModeloDeMensagem): string[] {
  const problemas: string[] = [];

  if (!NOME_VALIDO.test(modelo.nome)) {
    problemas.push(
      "O nome do modelo só aceita letras minúsculas, números e sublinhado, " +
        "começa por letra e tem ao menos 3 caracteres — por exemplo, aviso_de_reuniao.",
    );
  }

  const corpo = modelo.corpo.trim();
  if (corpo.length === 0) {
    problemas.push("Escreva o corpo da mensagem.");
  } else if (modelo.corpo.length > LIMITE_CORPO) {
    problemas.push(
      `O corpo tem ${modelo.corpo.length} caracteres e o limite da Meta é ${LIMITE_CORPO}.`,
    );
  }

  /**
   * A Meta recusa variável encostada na borda do corpo e duas variáveis
   * coladas. É regra dela, não nossa: uma mensagem que começa por `{{1}}` não
   * diz nada a quem recebe se o valor vier vazio.
   */
  if (/^\s*\{\{/.test(corpo)) {
    problemas.push("O corpo não pode começar com uma variável. Escreva algo antes dela.");
  }
  if (/\}\}\s*$/.test(corpo)) {
    problemas.push("O corpo não pode terminar com uma variável. Escreva algo depois dela.");
  }
  if (/\}\}\s*\{\{/.test(corpo)) {
    problemas.push("Duas variáveis não podem ficar coladas. Separe-as com texto.");
  }

  if (modelo.cabecalho && modelo.cabecalho.length > LIMITE_CABECALHO) {
    problemas.push(`O cabeçalho passa de ${LIMITE_CABECALHO} caracteres.`);
  }
  if (variaveisDe(modelo.cabecalho ?? "").length > 1) {
    problemas.push("O cabeçalho aceita no máximo uma variável.");
  }

  if (modelo.rodape && modelo.rodape.length > LIMITE_RODAPE) {
    problemas.push(`O rodapé passa de ${LIMITE_RODAPE} caracteres.`);
  }
  if (variaveisDe(modelo.rodape ?? "").length > 0) {
    problemas.push("O rodapé não aceita variáveis.");
  }

  const variaveis = variaveisDoModelo(modelo);
  const exemplos = modelo.exemplos ?? [];
  if (variaveis.length > 0) {
    const faltando = variaveis.filter((_, i) => !exemplos[i]?.trim());
    if (faltando.length > 0) {
      problemas.push(
        `A Meta revisa a mensagem preenchida: dê um exemplo para ${faltando
          .map((v) => `{{${v}}}`)
          .join(", ")}.`,
      );
    }
  }

  problemas.push(...problemasDosBotoes(modelo.botoes ?? []));

  return problemas;
}

function problemasDosBotoes(botoes: Botao[]): string[] {
  const problemas: string[] = [];
  const conta = (tipo: TipoDeBotao) => botoes.filter((b) => b.tipo === tipo).length;

  if (conta("resposta") > MAX_BOTOES_DE_RESPOSTA) {
    problemas.push(`No máximo ${MAX_BOTOES_DE_RESPOSTA} botões de resposta rápida.`);
  }
  if (conta("link") > MAX_BOTOES_DE_LINK) {
    problemas.push(`No máximo ${MAX_BOTOES_DE_LINK} botões de link.`);
  }
  if (conta("telefone") > MAX_BOTOES_DE_TELEFONE) {
    problemas.push(`No máximo ${MAX_BOTOES_DE_TELEFONE} botão de telefone.`);
  }

  for (const botao of botoes) {
    if (!botao.texto.trim()) {
      problemas.push("Todo botão precisa de um rótulo.");
    } else if (botao.texto.length > LIMITE_TEXTO_DO_BOTAO) {
      problemas.push(`O rótulo "${botao.texto}" passa de ${LIMITE_TEXTO_DO_BOTAO} caracteres.`);
    }
    if (botao.tipo === "link" && !/^https?:\/\/.+/.test(botao.url ?? "")) {
      problemas.push(`O botão "${botao.texto}" precisa de um endereço http(s).`);
    }
    if (botao.tipo === "telefone" && !/^\+[1-9]\d{7,14}$/.test(botao.telefone ?? "")) {
      problemas.push(
        `O botão "${botao.texto}" precisa de um telefone internacional (+5586998122039).`,
      );
    }
  }

  return problemas;
}

/** Como o service pergunta: lança com o primeiro problema. */
export class ModeloMalFormadoError extends Error {
  constructor(readonly problemas: string[]) {
    super(problemas[0] ?? "Modelo inválido.");
    this.name = "ModeloMalFormadoError";
  }
}

export function garantirModelo(modelo: ModeloDeMensagem): void {
  const problemas = problemasDoModelo(modelo);
  if (problemas.length > 0) throw new ModeloMalFormadoError(problemas);
}

/**
 * Troca os nomes das variáveis pelos números que a Meta espera.
 *
 * Cabeçalho e corpo numeram separado, porque para a Meta são componentes
 * diferentes: o `{{1}}` do cabeçalho não é o `{{1}}` do corpo.
 */
function numerar(texto: string, ordem: string[]): string {
  return texto.replace(VARIAVEL, (inteiro, nome: string) => {
    const posicao = ordem.indexOf(nome);
    return posicao >= 0 ? `{{${posicao + 1}}}` : inteiro;
  });
}

/** Um componente da API da Meta. Forma crua, montada aqui e enviada em `cloud.ts`. */
export interface ComponenteDaMeta {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  format?: "TEXT";
  text?: string;
  example?: { header_text?: string[]; body_text?: string[][] };
  buttons?: {
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }[];
}

/**
 * O modelo no formato que a Graph API recebe.
 *
 * Mora aqui, e não em `cloud.ts`, porque é tradução de dado — testável sem
 * rede. O adaptador fica com o que só ele pode fazer: falar HTTP.
 */
export function paraMeta(modelo: ModeloDeMensagem): ComponenteDaMeta[] {
  const componentes: ComponenteDaMeta[] = [];
  const doCabecalho = variaveisDe(modelo.cabecalho ?? "");
  const doCorpo = variaveisDe(modelo.corpo);
  const todas = variaveisDoModelo(modelo);
  const exemploDe = (nome: string) => modelo.exemplos[todas.indexOf(nome)] ?? "";

  if (modelo.cabecalho?.trim()) {
    componentes.push({
      type: "HEADER",
      format: "TEXT",
      text: numerar(modelo.cabecalho, doCabecalho),
      ...(doCabecalho.length > 0 ? { example: { header_text: doCabecalho.map(exemploDe) } } : {}),
    });
  }

  componentes.push({
    type: "BODY",
    text: numerar(modelo.corpo, doCorpo),
    // `body_text` é lista de listas: a Meta aceita mais de um conjunto de
    // exemplos por modelo. Mandamos um, que é o que a tela coleta.
    ...(doCorpo.length > 0 ? { example: { body_text: [doCorpo.map(exemploDe)] } } : {}),
  });

  if (modelo.rodape?.trim()) {
    componentes.push({ type: "FOOTER", text: modelo.rodape });
  }

  const botoes = modelo.botoes ?? [];
  if (botoes.length > 0) {
    componentes.push({
      type: "BUTTONS",
      buttons: botoes.map((botao) =>
        botao.tipo === "link"
          ? { type: "URL" as const, text: botao.texto, url: botao.url ?? "" }
          : botao.tipo === "telefone"
            ? {
                type: "PHONE_NUMBER" as const,
                text: botao.texto,
                phone_number: botao.telefone ?? "",
              }
            : { type: "QUICK_REPLY" as const, text: botao.texto },
      ),
    });
  }

  return componentes;
}

export interface Previa {
  cabecalho: string | null;
  corpo: string;
  rodape: string | null;
  botoes: Botao[];
}

/**
 * A mensagem preenchida.
 *
 * **A mesma função alimenta a prévia da tela e o texto gravado no log.** Duas
 * implementações fariam a direção aprovar uma coisa e o histórico guardar
 * outra — e a divergência só apareceria numa reclamação, que é quando ninguém
 * quer descobrir que a prévia mentia.
 *
 * Variável sem valor fica visível como `{{nome}}`, e não vazia: buraco silencioso
 * numa mensagem que já saiu é pior que um marcador que alguém vê na prévia.
 */
export function renderizar(modelo: ModeloDeMensagem, valores: Record<string, string>): Previa {
  const preencher = (texto: string) =>
    texto.replace(VARIAVEL, (inteiro, nome: string) => valores[nome]?.trim() || inteiro);

  return {
    cabecalho: modelo.cabecalho?.trim() ? preencher(modelo.cabecalho) : null,
    corpo: preencher(modelo.corpo),
    rodape: modelo.rodape?.trim() ? modelo.rodape : null,
    botoes: modelo.botoes ?? [],
  };
}

/** A prévia como uma string só — é o que vai para o log do envio. */
export function textoRenderizado(previa: Previa): string {
  return [previa.cabecalho, previa.corpo, previa.rodape].filter(Boolean).join("\n\n");
}

/**
 * Os valores de exemplo, por nome.
 *
 * É o que a prévia usa enquanto ninguém digitou nada, e o que o envio de teste
 * pré-preenche. Reusa os exemplos que a Meta já exige, em vez de inventar um
 * segundo conjunto de valores de mentira.
 */
export function valoresDeExemplo(modelo: ModeloDeMensagem): Record<string, string> {
  const valores: Record<string, string> = {};
  variaveisDoModelo(modelo).forEach((nome, i) => {
    const exemplo = modelo.exemplos[i]?.trim();
    if (exemplo) valores[nome] = exemplo;
  });
  return valores;
}
