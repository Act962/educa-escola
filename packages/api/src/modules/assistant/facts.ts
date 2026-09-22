import type { OverviewService } from "../overview/service";

/**
 * Os fatos que o Astro enxerga, por papel.
 *
 * **Esta é a fronteira de permissão do assistente**, e ela é de subtração: o
 * modelo não consulta nada, só recebe este texto. O que não entra aqui não
 * existe para ele. Por isso cada papel tem a sua função, e cada uma parte do
 * painel que aquele papel **já abre** — o assistente não sabe mais que a tela
 * de quem pergunta, por construção e não por instrução.
 *
 * Números formatados em português e com a unidade na frente, porque é o texto
 * que o modelo vai repetir: "0.937" ele lê como número solto, "93,7% de
 * frequência" ele devolve inteiro.
 */

const percentual = (taxa: number | null | undefined) =>
  taxa === null || taxa === undefined
    ? "sem dado"
    : `${(taxa * 100).toFixed(1).replace(".", ",")}%`;

const nota = (valor: number | null | undefined) =>
  valor === null || valor === undefined ? "sem nota publicada" : valor.toFixed(1).replace(".", ",");

/** Quantos professores da fila entram no texto. A lista inteira estoura o contexto. */
const PENDENTES_NO_TEXTO = 8;

export async function managementFacts(overview: OverviewService, term: number, agora: Date) {
  const painel = await overview.gestao(term, agora);

  const fila = painel.pending
    .slice(0, PENDENTES_NO_TEXTO)
    .map(
      (linha) =>
        `- ${linha.teacherName}: ${linha.pendingCalls} chamada(s) e ${linha.pendingGrades} nota(s) em aberto`,
    );

  return [
    `Bimestre corrente: ${term}º.`,
    `Alunos ativos: ${painel.students.active}. Com documentação pendente: ${painel.students.pendingDocuments}. Transferidos: ${painel.students.transferred}.`,
    `Turmas: ${painel.classrooms}. Professores: ${painel.teachers}.`,
    `Frequência média da escola: ${percentual(painel.attendanceRate)} (mínimo legal ${percentual(painel.minimumAttendanceRate)}).`,
    `Alunos em risco: ${painel.risk.total} (${painel.risk.belowAttendance} por frequência, ${painel.risk.belowAverage} por média).`,
    painel.pending.length === 0
      ? "Nenhum professor com pendência de lançamento."
      : `Professores com pendência (${painel.pending.length} no total, ${fila.length} listados):\n${fila.join("\n")}`,
  ].join("\n");
}

export async function teacherFacts(overview: OverviewService, teacherId: string, term: number) {
  const painel = await overview.professor(teacherId, term);

  const turmas = painel.classroomAverages.map(
    (turma) =>
      `- ${turma.classroomName}: média ${nota(turma.average)}${
        turma.previousAverage !== null ? ` (bimestre anterior ${nota(turma.previousAverage)})` : ""
      }${turma.belowPassing ? ", abaixo da média de aprovação" : ""}`,
  );

  return [
    `Bimestre corrente: ${term}º.`,
    turmas.length === 0
      ? "Nenhuma turma com nota publicada neste bimestre."
      : `Suas turmas:\n${turmas.join("\n")}`,
    `Notas suas em aberto: ${painel.pendingGrades}.`,
    `Alunos das suas turmas que precisam de atenção por frequência: ${painel.needsAttention}.`,
    // Dito ao modelo, não só a nós: sem isto ele tenta responder "quem são" a
    // partir do nada, e nome de aluno inventado numa tela de escola é grave.
    "Você não tem o nome desses alunos. Para saber quem são, a pessoa abre a tela Frequência.",
  ].join("\n");
}

export async function studentFacts(
  overview: OverviewService,
  input: { studentId: string; classroomId: string | null; term: number },
) {
  const painel = await overview.aluno(input);

  const disciplinas = painel.subjects.map(
    (materia) => `- ${materia.subjectName}: média da turma ${nota(materia.classAverage)}`,
  );

  return [
    `Bimestre corrente: ${input.term}º.`,
    painel.attendance
      ? `Sua frequência: ${percentual(painel.attendance.rate)}, com ${painel.attendance.absences} falta(s).${
          painel.attendance.belowMinimum ? " Está abaixo do mínimo de 75% exigido por lei." : ""
        }`
      : "Ainda não há aula registrada para calcular sua frequência.",
    disciplinas.length === 0
      ? "Nenhuma média de turma publicada neste bimestre."
      : `Médias da sua turma por disciplina:\n${disciplinas.join("\n")}`,
    // O §7.5 do requisito dito em linguagem de instrução: sem isto, o modelo
    // preenche a lacuna com nome de colega inventado.
    "Você não tem a nota de nenhum colega, e não pode citar nome de outro aluno.",
  ].join("\n");
}
