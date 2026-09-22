/**
 * Os indicadores-chave do §15.4 — e os que o sistema ainda não sabe calcular.
 *
 * **A parte que importa é a segunda.** Um painel que mostra dez números, dos
 * quais quatro são chute, é pior que um painel com seis números e quatro
 * linhas dizendo "não dá para medir ainda, porque falta X". O primeiro faz a
 * direção tomar decisão sobre dado inventado; o segundo diz o que construir.
 *
 * Por isso cada indicador carrega ou um valor, ou o motivo de não ter — nunca
 * um zero de fachada.
 */

export type ChaveDeIndicador =
  | "alunos_ativos"
  | "taxa_ocupacao"
  | "taxa_frequencia"
  | "alunos_em_risco"
  | "taxa_aprovacao"
  | "evasao"
  | "pendencias_lancamento"
  | "leitura_comunicados"
  | "inadimplencia"
  | "rematricula";

export interface Indicador {
  chave: ChaveDeIndicador;
  rotulo: string;
  /** Como a §15.4 define a conta. Fica na tela: número sem fórmula é fé. */
  formula: string;
  /** `null` quando o sistema ainda não sabe calcular. */
  valor: number | null;
  formato: "inteiro" | "percentual";
  /** Preenchido só quando `valor` é nulo. Diz o que falta para existir. */
  indisponivel?: string;
}

/**
 * O que ainda não dá para medir, e por quê.
 *
 * Cada linha aqui é uma dívida conhecida, não um esquecimento. Sai da lista no
 * dia em que o módulo que falta existir.
 */
export const SEM_DADO: Record<string, string> = {
  taxa_ocupacao:
    "A turma não guarda capacidade de vagas (§3.1). Sem o denominador, qualquer taxa seria inventada.",
  taxa_aprovacao:
    "Depende do fechamento de período (§10.4), que ainda não existe: hoje há nota publicada, não resultado final.",
  evasao:
    "Exige distinguir saída com transferência de saída sem, e `student.status` não guarda o motivo.",
  leitura_comunicados: "O módulo de comunicados (§8) ainda não foi construído.",
  inadimplencia: "O financeiro é o app Payment do Órbita: o dado não mora neste banco.",
  rematricula:
    "Precisa comparar matrículas de dois anos letivos, e a escola ainda não tem histórico de dois anos aqui.",
};

export interface DadosDosIndicadores {
  alunosNaSala: number;
  /** Frequência geral da escola, de 0 a 1. `null` sem aula registrada. */
  frequenciaGeral: number | null;
  alunosEmRisco: number;
  pendenciasDeLancamento: number;
}

/** Frequência mínima da LDB, repetida aqui só como rótulo de fórmula. */
export const MINIMO_DE_FREQUENCIA = 0.75;

export function montarIndicadores(dados: DadosDosIndicadores): Indicador[] {
  const disponivel = (
    chave: ChaveDeIndicador,
    rotulo: string,
    formula: string,
    valor: number | null,
    formato: Indicador["formato"],
  ): Indicador => ({ chave, rotulo, formula, valor, formato });

  const faltando = (
    chave: ChaveDeIndicador,
    rotulo: string,
    formula: string,
    formato: Indicador["formato"],
  ): Indicador => ({
    chave,
    rotulo,
    formula,
    valor: null,
    formato,
    indisponivel: SEM_DADO[chave],
  });

  return [
    disponivel(
      "alunos_ativos",
      "Alunos ativos",
      "Matrículas ativas, incluindo documentação pendente e quem ainda não tem turma",
      dados.alunosNaSala,
      "inteiro",
    ),
    faltando(
      "taxa_ocupacao",
      "Taxa de ocupação",
      "Matrículas ÷ capacidade das turmas",
      "percentual",
    ),
    disponivel(
      "taxa_frequencia",
      "Taxa de frequência",
      "Presenças ÷ registros de chamada",
      dados.frequenciaGeral,
      "percentual",
    ),
    disponivel(
      "alunos_em_risco",
      "Alunos em risco",
      `Frequência abaixo de ${MINIMO_DE_FREQUENCIA * 100}% (LDB, art. 24, VI)`,
      dados.alunosEmRisco,
      "inteiro",
    ),
    faltando("taxa_aprovacao", "Taxa de aprovação", "Aprovados ÷ concluintes do ano", "percentual"),
    faltando("evasao", "Evasão", "Saídas sem transferência ÷ matrículas iniciais", "percentual"),
    disponivel(
      "pendencias_lancamento",
      "Pendências de lançamento",
      "Aulas encerradas sem chamada registrada",
      dados.pendenciasDeLancamento,
      "inteiro",
    ),
    faltando(
      "leitura_comunicados",
      "Leitura de comunicados",
      "Leituras ÷ destinatários",
      "percentual",
    ),
    faltando(
      "inadimplencia",
      "Inadimplência",
      "Valor vencido em aberto ÷ total devido",
      "percentual",
    ),
    faltando("rematricula", "Rematrícula", "Rematriculados ÷ elegíveis", "percentual"),
  ];
}

/** Taxa de 0 a 1. `null` sem denominador — nunca zero. */
export function taxa(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return parte / total;
}
