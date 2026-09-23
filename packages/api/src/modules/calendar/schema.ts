import { z } from "zod";

export const EVENT_TYPES = [
  "feriado",
  "recesso",
  "ferias",
  "evento",
  "reuniao",
  "conselho",
  "avaliacao",
  "reposicao",
  "prazo",
] as const;

export const DAY_EFFECTS = ["nenhum", "nao_letivo", "letivo_extra"] as const;
export const SCOPES = ["institucional", "segmento", "turma"] as const;

/**
 * Os escopos que a tela oferece hoje: a escola inteira, ou uma turma.
 *
 * `segmento` existe na coluna (§9.1) e fica de fora de propósito. Ele
 * dependeria de `classroom.stage`, que é nulável e está vazio na maior parte
 * das turmas — um evento "de segmento" simplesmente não alcançaria as turmas
 * sem série preenchida, e ninguém veria o buraco. Quando a turma tiver
 * segmento de verdade, é uma opção a mais neste array.
 */
export const EVENT_SCOPES = ["institucional", "turma"] as const;

export type EventScope = (typeof EVENT_SCOPES)[number];

export const EVENT_SCOPE_LABEL: Record<EventScope, string> = {
  institucional: "Toda a escola",
  turma: "Uma turma",
};

export type EventType = (typeof EVENT_TYPES)[number];
export type DayEffect = (typeof DAY_EFFECTS)[number];

export const EVENT_TYPE_LABEL: Record<EventType, string> = {
  feriado: "Feriado",
  recesso: "Recesso",
  ferias: "Férias",
  evento: "Evento escolar",
  reuniao: "Reunião",
  conselho: "Conselho de classe",
  avaliacao: "Avaliação",
  reposicao: "Reposição de aula",
  prazo: "Prazo administrativo",
};

/**
 * O efeito que cada tipo sugere. **Sugestão, não regra.**
 *
 * A coluna é livre porque feriado em sábado não tira dia letivo e feira de
 * ciências pode ou não tomar o dia. A tela usa isto para preencher o campo, e
 * quem cria pode mudar.
 */
export const SUGGESTED_EFFECT: Record<EventType, DayEffect> = {
  feriado: "nao_letivo",
  recesso: "nao_letivo",
  ferias: "nao_letivo",
  evento: "nenhum",
  reuniao: "nenhum",
  conselho: "nenhum",
  avaliacao: "nenhum",
  reposicao: "letivo_extra",
  prazo: "nenhum",
};

const dataCivil = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato AAAA-MM-DD");

export const academicYear = z.number().int().min(2000).max(2100);

export const calendarYearInput = z.object({ academicYear });

/**
 * A visão do ano, opcionalmente recortada por turma.
 *
 * Separada de `calendarYearInput` de propósito: `sugestoes` e `importar` usam
 * aquela, e o calendário brasileiro não tem turma — deixar o campo visível ali
 * seria oferecer um filtro que a procedure ignora.
 */
export const calendarViewInput = z.object({
  academicYear,
  /** `undefined` mostra o ano inteiro; um id recorta para a turma. */
  classroomId: z.string().min(1).optional(),
});

export const defineYearInput = z
  .object({
    academicYear,
    startsOn: dataCivil,
    endsOn: dataCivil,
    minimumSchoolDays: z.number().int().min(1).max(365).default(200),
  })
  .refine((v) => v.startsOn <= v.endsOn, {
    message: "O fim do ano letivo não pode ser antes do início",
    path: ["endsOn"],
  });

/**
 * A quem o evento pertence.
 *
 * As duas colunas andam juntas ou o dado fica sem sentido: evento de turma sem
 * `classroomId` não alcança ninguém, e evento institucional *com* turma mente
 * sobre o próprio alcance — some da tela quando a secretaria filtra por outra
 * turma, embora valha para a escola toda. Por isso a checagem é do par, e não
 * de cada campo.
 */
const eventTarget = {
  scope: z.enum(EVENT_SCOPES).default("institucional"),
  classroomId: z.string().min(1).nullable().optional(),
};

function alvoCoerente(v: { scope: EventScope; classroomId?: string | null }) {
  return v.scope === "turma" ? Boolean(v.classroomId) : !v.classroomId;
}

const MENSAGEM_DO_ALVO = "Escolha a turma do evento, ou marque-o para a escola inteira.";

export const createEventInput = z
  .object({
    academicYear,
    type: z.enum(EVENT_TYPES),
    dayEffect: z.enum(DAY_EFFECTS).default("nenhum"),
    title: z.string().trim().min(2, "Informe o título do evento").max(120),
    description: z.string().trim().max(500).optional(),
    startsOn: dataCivil,
    endsOn: dataCivil.optional(),
    ...eventTarget,
  })
  .refine((v) => !v.endsOn || v.startsOn <= v.endsOn, {
    message: "O fim do evento não pode ser antes do início",
    path: ["endsOn"],
  })
  .refine(alvoCoerente, { message: MENSAGEM_DO_ALVO, path: ["classroomId"] });

export const eventId = z.object({ id: z.string().min(1) });

/**
 * Edição de um evento já criado.
 *
 * O ano letivo **não** entra: mudar um evento de 2026 para 2027 não é editar,
 * é criar outro. Quem quer isso apaga e remarca, e o histórico fica honesto.
 */
export const updateEventInput = z
  .object({
    id: z.string().min(1),
    type: z.enum(EVENT_TYPES),
    dayEffect: z.enum(DAY_EFFECTS),
    title: z.string().trim().min(2, "Informe o título do evento").max(120),
    description: z.string().trim().max(500).nullable().optional(),
    startsOn: dataCivil,
    endsOn: dataCivil.optional(),
    ...eventTarget,
  })
  .refine((v) => !v.endsOn || v.startsOn <= v.endsOn, {
    message: "O fim do evento não pode ser antes do início",
    path: ["endsOn"],
  })
  .refine(alvoCoerente, { message: MENSAGEM_DO_ALVO, path: ["classroomId"] });

export type UpdateEventInput = z.infer<typeof updateEventInput>;

export type DefineYearInput = z.infer<typeof defineYearInput>;
export type CreateEventInput = z.infer<typeof createEventInput>;
export type CalendarViewInput = z.infer<typeof calendarViewInput>;
