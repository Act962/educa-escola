/**
 * Código de turma: `6M` — série mais turno.
 *
 * **Derivado, nunca guardado.** É a diferença que importa: se este código
 * morasse numa coluna, ou dentro do número de matrícula, ele passaria a mentir
 * no dia em que o aluno avançasse de série ou trocasse de turno. Calculado a
 * partir da turma e do turno de verdade, ele acompanha o aluno sozinho.
 *
 * Serve de chave de agrupamento para o disparo em massa. Mas quem for filtrar
 * de fato deve consultar `classroomId` e `shift` no banco — este código é para
 * a pessoa ler na tela, não para o sistema interpretar de volta.
 */

const TURNO_INICIAL: Record<string, string> = {
  manha: "M",
  tarde: "T",
  noite: "N",
};

export interface ClassCode {
  /** "6M", ou null quando a turma ainda não foi definida. */
  code: string | null;
  /** "6º ano · manhã", para leitor de tela e para o título do agrupamento. */
  label: string;
  /** 6, 7, 8, 9 — extraído do nome da turma. */
  grade: number | null;
}

/**
 * A série sai do nome da turma. **Isto agora é o plano B.**
 *
 * `classroom.gradeLevel` existe desde a grade curricular, e é a fonte certa.
 * Esta leitura de texto continua aqui porque os chamadores em
 * `enrollment/service.ts` ainda não trazem a coluna nas suas consultas —
 * trocar exige mexer no repositório da matrícula, que é outro módulo.
 *
 * Enquanto isso não acontece, o resultado é o mesmo: a migration da grade
 * preencheu a coluna com exatamente esta regra. A diferença aparece no dia em
 * que alguém corrigir a série de uma turma na tela e o nome não acompanhar.
 *
 * É leitura frágil: turma chamada "Berçário II" não produz série. Devolve
 * `null` em vez de inventar — mostrar "0M" seria pior que não mostrar.
 */
export function classCodeOf(
  classroomName: string | null | undefined,
  shift: string | null | undefined,
): ClassCode {
  const turno = TURNO_INICIAL[shift ?? ""] ?? null;
  const serie = classroomName ? Number.parseInt(classroomName, 10) : Number.NaN;
  const grade = Number.isNaN(serie) ? null : serie;

  if (grade === null || turno === null) {
    return { code: null, label: classroomName ?? "Turma a definir", grade };
  }

  const nomeTurno = shift === "manha" ? "manhã" : shift === "tarde" ? "tarde" : "noite";
  return { code: `${grade}${turno}`, label: `${grade}º ano · ${nomeTurno}`, grade };
}
