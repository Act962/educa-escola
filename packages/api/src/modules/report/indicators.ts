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

export type IndicatorKey =
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

export interface Indicator {
  key: IndicatorKey;
  label: string;
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
export const NO_DATA: Record<string, string> = {
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

export interface IndicatorData {
  studentsInRoom: number;
  /** Frequência geral da escola, de 0 a 1. `null` sem aula registrada. */
  overallAttendance: number | null;
  studentsAtRisk: number;
  pendingGradeEntries: number;
}

/** Frequência mínima da LDB, repetida aqui só como rótulo de fórmula. */
export const MINIMUM_ATTENDANCE = 0.75;

export function buildIndicators(data: IndicatorData): Indicator[] {
  const available = (
    key: IndicatorKey,
    label: string,
    formula: string,
    valor: number | null,
    formato: Indicator["formato"],
  ): Indicator => ({ key, label, formula, valor, formato });

  const faltando = (
    key: IndicatorKey,
    label: string,
    formula: string,
    formato: Indicator["formato"],
  ): Indicator => ({
    key,
    label,
    formula,
    valor: null,
    formato,
    indisponivel: NO_DATA[key],
  });

  return [
    available(
      "alunos_ativos",
      "Alunos ativos",
      "Matrículas ativas, incluindo documentação pendente e quem ainda não tem turma",
      data.studentsInRoom,
      "inteiro",
    ),
    faltando(
      "taxa_ocupacao",
      "Taxa de ocupação",
      "Matrículas ÷ capacidade das turmas",
      "percentual",
    ),
    available(
      "taxa_frequencia",
      "Taxa de frequência",
      "Presenças ÷ registros de chamada",
      data.overallAttendance,
      "percentual",
    ),
    available(
      "alunos_em_risco",
      "Alunos em risco",
      `Frequência abaixo de ${MINIMUM_ATTENDANCE * 100}% (LDB, art. 24, VI)`,
      data.studentsAtRisk,
      "inteiro",
    ),
    faltando("taxa_aprovacao", "Taxa de aprovação", "Aprovados ÷ concluintes do ano", "percentual"),
    faltando("evasao", "Evasão", "Saídas sem transferência ÷ matrículas iniciais", "percentual"),
    available(
      "pendencias_lancamento",
      "Pendências de lançamento",
      "Aulas encerradas sem chamada registrada",
      data.pendingGradeEntries,
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
export function rate(parte: number, total: number): number | null {
  if (total <= 0) return null;
  return parte / total;
}
