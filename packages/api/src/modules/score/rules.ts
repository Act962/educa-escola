/**
 * O catálogo de regras de pontuação.
 *
 * Em código, e não em tabela, de propósito: é constante versionada, revisável
 * em PR e testável sem banco. Mudar quanto vale uma presença é mudar o
 * comportamento de todo mundo na escola — merece diff, não `UPDATE`.
 *
 * Toda regra aqui usa **dado que já existe**. O que ficou de fora por falta de
 * dado: entrega de atividade, leitura de comunicado, justificativa de falta,
 * ocorrência e pontualidade real. São módulos que ainda não foram construídos.
 */

export type SubjectKind = "aluno" | "professor" | "escola";

export interface ScoreRule {
  key: string;
  subjectKind: SubjectKind;
  /** O que a pessoa lê na tela, na primeira pessoa do fato. */
  label: string;
  points: number;
  /** Por que esta regra existe — e, quando couber, o que ela evita incentivar. */
  rationale: string;
}

/**
 * Regras do aluno.
 *
 * **Evolução, não nota absoluta.** Ponto por nota alta premia quem já chega na
 * frente e não move ninguém: o aluno que foi de 4,0 para 6,0 fez a coisa mais
 * difícil da escola inteira e não apareceria.
 */
export const STUDENT_RULES = [
  {
    key: "aluno.presenca",
    subjectKind: "aluno",
    label: "Presença em aula",
    points: 2,
    rationale: "A unidade mais básica de participação, e a que a escola mais precisa sustentar.",
  },
  {
    key: "aluno.atraso",
    subjectKind: "aluno",
    label: "Chegou atrasado, mas assistiu",
    points: 1,
    rationale:
      "Coerente com a frequência, onde atraso conta como presença. Vale menos que a presença " +
      "em dia, e vale mais que zero: quem veio atrasado escolheu vir.",
  },
  {
    key: "aluno.sequencia_10",
    subjectKind: "aluno",
    label: "Dez aulas seguidas sem faltar",
    points: 10,
    rationale: "Reconhece a constância, que é o que a presença isolada não consegue enxergar.",
  },
  {
    key: "aluno.frequencia_ano",
    subjectKind: "aluno",
    label: "Frequência do ano letivo acima de 90%",
    points: 20,
    rationale:
      "Acima do mínimo legal de 75%: é mérito, não obrigação cumprida. " +
      "Do ano e não do bimestre porque não existe calendário letivo no sistema — " +
      "`term` só existe como coluna que o professor escolhe na avaliação, e " +
      "`attendance` não tem período nenhum. Recortar o bimestre exigiria inventar " +
      "as datas de corte, e data de corte inventada dá ponto a quem não fez por " +
      "merecer e tira de quem fez. Vira regra de bimestre no dia em que o " +
      "calendário letivo existir (§32 do requisito).",
  },
  {
    key: "aluno.evolucao_bimestre",
    subjectKind: "aluno",
    label: "Média do bimestre maior que a do anterior",
    points: 15,
    rationale:
      "Premia a subida, não o patamar. Só conta com nota publicada nos dois bimestres — " +
      "comparar contra bimestre sem nota inventaria uma evolução que ninguém fez.",
  },
] as const satisfies readonly ScoreRule[];

/**
 * Regras do professor.
 *
 * Todas são sobre **o registro**, nunca sobre o conteúdo do registro. É o que
 * impede o incentivo cruzado: o professor ganha por lançar a chamada no prazo,
 * indiferente a quantos faltaram. Se ganhasse por frequência da turma, o
 * caminho mais curto para o ponto seria marcar presente quem faltou — e a
 * frequência é o dado mais crítico do sistema.
 *
 * **Fora de propósito:** média da turma e taxa de aprovação punem quem pega
 * turma difícil e incentivam inflar nota; contagem de alunos "em risco"
 * incentiva não sinalizar risco.
 */
export const TEACHER_RULES = [
  {
    key: "professor.chamada_no_prazo",
    subjectKind: "professor",
    label: "Chamada registrada no prazo",
    points: 5,
    rationale: "O prazo é o mesmo da tela de chamada: até o fim do dia da aula.",
  },
  {
    key: "professor.diario_preenchido",
    subjectKind: "professor",
    label: "Diário da aula preenchido",
    points: 3,
    rationale: "É o que permite a família e a coordenação saberem o que foi dado.",
  },
  {
    key: "professor.avaliacao_publicada",
    subjectKind: "professor",
    label: "Avaliação publicada sem pendência",
    points: 10,
    rationale:
      "Publicar com aluno sem lançamento deixa buraco no boletim. O ponto é por fechar, " +
      "não por publicar.",
  },
  {
    key: "professor.devolutiva_em_sete_dias",
    subjectKind: "professor",
    label: "Devolutiva em até sete dias da aplicação",
    points: 5,
    rationale: "Nota que chega depois do assunto ter passado não ensina ninguém.",
  },
] as const satisfies readonly ScoreRule[];

export const RULES = [...STUDENT_RULES, ...TEACHER_RULES] as const;

export type RuleKey = (typeof RULES)[number]["key"];

const PorChave = new Map<string, ScoreRule>(RULES.map((regra) => [regra.key, regra]));

export function ruleFor(key: string): ScoreRule | null {
  return PorChave.get(key) ?? null;
}

/** Quanto vale uma regra. Ponto de leitura único: a apuração não repete número. */
export function pointsFor(key: RuleKey): number {
  const regra = PorChave.get(key);
  if (!regra) throw new Error(`Regra de pontuação desconhecida: ${key}`);
  return regra.points;
}

export interface Level {
  ordem: number;
  name: string;
  /** Pontos necessários para entrar neste nível. */
  minimo: number;
}

/**
 * As faixas de nível.
 *
 * Nomes de órbita porque o ecossistema é o Órbita, e porque nível com nome de
 * metal ("bronze, prata, ouro") faz o último colocado ler "você é o pior" —
 * aqui o primeiro degrau é um lugar de onde se parte, não um castigo.
 */
export const LEVELS = [
  { ordem: 1, name: "Decolagem", minimo: 0 },
  { ordem: 2, name: "Órbita baixa", minimo: 150 },
  { ordem: 3, name: "Órbita alta", minimo: 400 },
  { ordem: 4, name: "Estação", minimo: 800 },
  { ordem: 5, name: "Espaço profundo", minimo: 1500 },
] as const satisfies readonly Level[];

/** O nível de quem tem estes pontos. Ponto negativo não existe, mas não quebra. */
export function levelOf(points: number): Level {
  let atual: Level = LEVELS[0];
  for (const level of LEVELS) {
    if (points >= level.minimo) atual = level;
  }
  return atual;
}

/** Quanto falta para o próximo nível, e qual é. `null` no último. */
export function nextLevel(points: number): { level: Level; faltam: number } | null {
  const seguinte = LEVELS.find((level) => level.minimo > points);
  return seguinte ? { level: seguinte, faltam: seguinte.minimo - points } : null;
}
