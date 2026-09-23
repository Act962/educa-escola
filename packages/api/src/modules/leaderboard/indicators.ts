/**
 * Como uma escola pontua no placar entre escolas.
 *
 * **Taxas, nunca totais.** Somar os pontos das pessoas faria o placar medir
 * matrícula: a escola de 2.000 alunos ganharia da escola de 200 sem fazer nada
 * melhor, e a menor não teria caminho nenhum para subir. Os três indicadores
 * são proporções, então uma escola pequena e organizada bate uma grande e
 * desleixada — que é a única versão deste placar que significa alguma coisa.
 *
 * **Nenhum indicador olha para pessoa.** São contagens agregadas da própria
 * escola, calculadas dentro do tenant dela. O que atravessa a fronteira é um
 * número por escola, e é por isso que a tabela publicada não tem para onde
 * vazar aluno nem professor.
 */

export interface SchoolCounts {
  /** Aulas cuja chamada foi registrada, e quantas dessas ficaram no prazo. */
  lessonsWithAttendance: number;
  lessonsOnTime: number;
  /** Avaliações publicadas, e quantas saíram sem aluno sem lançamento. */
  publishedAssessments: number;
  assessmentsWithoutPending: number;
  /** Presenças (com atraso) e o total de registros de chamada. */
  comparecimentos: number;
  registrosDeChamada: number;
}

export interface SchoolIndicators {
  attendanceOnTime: number;
  gradesWithoutPending: number;
  averageAttendance: number;
  points: number;
}

/** Quanto vale cada indicador. Três de cem: o total é legível sem tabela. */
export const POINTS_PER_INDICATOR = 100;

/**
 * Proporção em escala de 0 a 100.
 *
 * Denominador zero devolve **zero, não cem**. Escola que não registrou
 * nenhuma chamada não tem 100% de chamadas no prazo — ela não tem chamada. O
 * contrário premiaria justamente quem não usa o sistema.
 */
export function ratio(parte: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((Math.min(parte, total) / total) * POINTS_PER_INDICATOR);
}

export function indicatorsFor(contagens: SchoolCounts): SchoolIndicators {
  const attendanceOnTime = ratio(contagens.lessonsOnTime, contagens.lessonsWithAttendance);
  const gradesWithoutPending = ratio(
    contagens.assessmentsWithoutPending,
    contagens.publishedAssessments,
  );
  const averageAttendance = ratio(contagens.comparecimentos, contagens.registrosDeChamada);

  return {
    attendanceOnTime,
    gradesWithoutPending,
    averageAttendance,
    points: attendanceOnTime + gradesWithoutPending + averageAttendance,
  };
}

export const MAXIMUM_SCORE = POINTS_PER_INDICATOR * 3;
