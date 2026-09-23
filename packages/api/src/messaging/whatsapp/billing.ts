/**
 * A conta do WhatsApp: o que a Meta cobra, e o que ela dá de graça.
 *
 * Código puro — sem rede, sem banco, sem tela — porque é aritmética sobre uma
 * regra de fornecedor, e regra de fornecedor muda. Concentrá-la num arquivo
 * testável é o que permite ajustar a conta sem mexer em service, router ou
 * componente no dia em que a Meta mudar o teto.
 *
 * **O que está aqui é estimativa, e a tela precisa dizer isso.** A fatura é da
 * Meta; nós só sabemos o que mandamos. Três coisas nos escapam:
 *
 * 1. **A janela de atendimento abre quando a família escreve**, e sem o webhook
 *    de entrada nós não vemos essa mensagem. Usamos o nosso próprio último
 *    envio como âncora, que é uma aproximação — e que erra para mais, contando
 *    como conversa nova o que a Meta pode considerar conversa já aberta.
 * 2. **O que falhou não conta**, mas o que a Meta aceitou e não entregou conta
 *    para ela e não para nós até o webhook existir.
 * 3. **A cota é da conta comercial (WABA)**, não do número. Duas escolas na
 *    mesma WABA somariam consumo, e cada uma enxerga só o seu.
 *
 * Por isso o painel fala em "estimativa" e manda conferir no Gerenciador da
 * Meta. Número que se apresenta como fatura e não é vira discussão com a
 * direção sobre um valor que nunca foi nosso.
 */

/**
 * A cota mensal de conversas de serviço que a Meta não cobra.
 *
 * Mil por mês, por conta comercial. Vale para **conversa de serviço** — a que
 * acontece dentro da janela de 24 horas aberta por quem escreveu para a escola.
 * Mensagem por modelo é cobrada por mensagem e não sai desta cota.
 *
 * DECISÃO-JOÃO: manter o teto como constante, e não como coluna por escola.
 * Quebra se: a Meta mudar o número — e ela muda. Como constante, a mudança é
 *   uma linha aqui e vale para todas as escolas no deploy seguinte.
 * Fiz assim: constante como piso, e `freeTierLimit` na conta para quem tiver
 *   contrato diferente. Vazio na coluna significa "use o padrão".
 * Alternativas: só coluna (cada escola teria de saber o próprio teto) · só
 *   constante (escola com contrato negociado ficaria com o número errado).
 */
export const CONVERSAS_DE_SERVICO_GRATUITAS = 1000;

/** A janela de atendimento da Meta: 24 horas. */
export const JANELA_DE_ATENDIMENTO_MS = 24 * 60 * 60 * 1000;

/**
 * Como a mensagem entra na conta.
 *
 * `servico` é texto livre dentro da janela — é o que consome a cota gratuita.
 * `modelo` é mensagem por modelo aprovado, cobrada por mensagem, **fora** da
 * cota. Separá-las é o ponto: somar as duas num contador só faria o painel
 * dizer que a cota acabou quando o que acabou foi o dinheiro, ou o contrário.
 */
export type CategoriaDeCobranca = "servico" | "modelo";

/**
 * O primeiro instante do mês de cobrança, em UTC.
 *
 * UTC e não `America/Sao_Paulo` porque o mês que importa aqui é o da Meta, e o
 * dela vira à meia-noite UTC. Usar o fuso da escola faria a virada do painel
 * acontecer três horas depois da virada da fatura — e, nessas três horas, o
 * contador mostraria zero restante enquanto a cota nova já estava valendo.
 *
 * É a exceção declarada ao `toSchoolDate` de `dates.ts`: lá o assunto é dia
 * letivo, que é civil e local; aqui é mês de fornecedor.
 */
export function inicioDoMesDeCobranca(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), 1, 0, 0, 0, 0));
}

/** O primeiro instante do mês seguinte: é quando a cota volta a mil. */
export function proximaRenovacao(agora: Date): Date {
  return new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

/**
 * Esta mensagem abre uma conversa nova, ou pega carona numa aberta?
 *
 * É a pergunta que decide se a cota é consumida. Várias mensagens para a mesma
 * pessoa dentro de 24 horas são **uma** conversa para a Meta — contar mensagens
 * faria o painel acusar consumo de cinco onde houve um, e a escola pararia de
 * falar com a família por causa de um número inventado por nós.
 *
 * `null` em `ultimoEnvio` é "nunca mandamos nada para este número", e aí abre.
 */
export function abreConversa(ultimoEnvio: Date | null, agora: Date): boolean {
  if (!ultimoEnvio) return true;
  return agora.getTime() - ultimoEnvio.getTime() >= JANELA_DE_ATENDIMENTO_MS;
}

/** Quanto falta para a janela daquele número fechar. `0` quando já fechou. */
export function restaDaJanelaMs(ultimoEnvio: Date | null, agora: Date): number {
  if (!ultimoEnvio) return 0;
  return Math.max(0, ultimoEnvio.getTime() + JANELA_DE_ATENDIMENTO_MS - agora.getTime());
}

/**
 * O semáforo do painel.
 *
 * Quatro estados e não uma porcentagem crua porque o que a direção precisa
 * decidir é binário — dá para mandar o comunicado de amanhã ou não? — e um
 * "74,3%" não responde isso sem que alguém faça a conta de cabeça.
 */
export type EstadoDaCota = "tranquilo" | "atencao" | "critico" | "esgotado";

/** 75% acende o amarelo; 90%, o vermelho. */
export const LIMIAR_DE_ATENCAO = 0.75;
export const LIMIAR_CRITICO = 0.9;

export function estadoDaCota(usadas: number, teto: number): EstadoDaCota {
  if (teto <= 0) return "esgotado";
  const fracao = usadas / teto;
  if (fracao >= 1) return "esgotado";
  if (fracao >= LIMIAR_CRITICO) return "critico";
  if (fracao >= LIMIAR_DE_ATENCAO) return "atencao";
  return "tranquilo";
}

export interface ConsumoDoMes {
  /** Conversas de serviço abertas no mês, pelo que sabemos. */
  conversas: number;
  /** O teto gratuito em vigor para esta conta. */
  teto: number;
  /** Nunca negativo: passar do teto não deixa a tela mostrar "-12". */
  restantes: number;
  /** De 0 a 1, para a barra. Passa de 1 quando a escola estourou a cota. */
  fracao: number;
  estado: EstadoDaCota;
  /** Mensagens por modelo no mês. Cobradas por mensagem, fora da cota. */
  mensagensPorModelo: number;
  /** Quando a cota volta a zero. */
  renovaEm: Date;
  desde: Date;
  /**
   * A conta bloqueia o próximo envio de serviço?
   *
   * Só quando a escola pediu o bloqueio **e** a cota acabou. Mensagem por
   * modelo nunca é bloqueada por aqui: ela é paga de qualquer jeito, e travá-la
   * por causa de uma cota que não a cobre seria inventar uma regra que a Meta
   * não tem.
   */
  bloqueado: boolean;
}

export function consumoDoMes(input: {
  conversas: number;
  mensagensPorModelo: number;
  /** `null` usa o padrão da Meta. */
  teto: number | null;
  bloquearAoEsgotar: boolean;
  agora: Date;
}): ConsumoDoMes {
  const teto = input.teto ?? CONVERSAS_DE_SERVICO_GRATUITAS;
  const conversas = Math.max(0, input.conversas);
  const estado = estadoDaCota(conversas, teto);

  return {
    conversas,
    teto,
    restantes: Math.max(0, teto - conversas),
    fracao: teto > 0 ? conversas / teto : 1,
    estado,
    mensagensPorModelo: Math.max(0, input.mensagensPorModelo),
    renovaEm: proximaRenovacao(input.agora),
    desde: inicioDoMesDeCobranca(input.agora),
    bloqueado: input.bloquearAoEsgotar && estado === "esgotado",
  };
}

/**
 * Milhar com ponto, como o resto do produto escreve número.
 *
 * Existe porque a frase e a barra vivem no mesmo cartão: com `1000` no texto e
 * `1.000` ao lado, o leitor para para conferir se são o mesmo número.
 */
const numero = (valor: number) => valor.toLocaleString("pt-BR");

/**
 * A frase que a tela mostra, montada aqui e não no componente.
 *
 * Fica junto da conta porque é a conta dita em português: se o limiar mudar
 * acima, a frase muda junto, sem depender de alguém lembrar de editar o JSX.
 */
export function recadoDaCota(consumo: ConsumoDoMes): string {
  switch (consumo.estado) {
    case "esgotado":
      return consumo.bloqueado
        ? "A cota gratuita do mês acabou. Novas conversas estão bloqueadas até a virada do mês — ou desligue o bloqueio e assuma o custo."
        : "A cota gratuita do mês acabou. A partir daqui a Meta cobra por conversa.";
    case "critico":
      return `Restam ${numero(consumo.restantes)} conversas gratuitas. Segure o que puder esperar a virada do mês.`;
    case "atencao":
      return `Já foram ${numero(consumo.conversas)} das ${numero(consumo.teto)} conversas gratuitas do mês.`;
    default:
      return `${numero(consumo.restantes)} das ${numero(consumo.teto)} conversas gratuitas ainda disponíveis neste mês.`;
  }
}
