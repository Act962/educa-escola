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
export const EFEITO_SUGERIDO: Record<EventType, DayEffect> = {
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

export const createEventInput = z
  .object({
    academicYear,
    type: z.enum(EVENT_TYPES),
    dayEffect: z.enum(DAY_EFFECTS).default("nenhum"),
    title: z.string().trim().min(2, "Informe o título do evento").max(120),
    description: z.string().trim().max(500).optional(),
    startsOn: dataCivil,
    endsOn: dataCivil.optional(),
  })
  .refine((v) => !v.endsOn || v.startsOn <= v.endsOn, {
    message: "O fim do evento não pode ser antes do início",
    path: ["endsOn"],
  });

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
  })
  .refine((v) => !v.endsOn || v.startsOn <= v.endsOn, {
    message: "O fim do evento não pode ser antes do início",
    path: ["endsOn"],
  });

export type UpdateEventInput = z.infer<typeof updateEventInput>;

export type DefineYearInput = z.infer<typeof defineYearInput>;
export type CreateEventInput = z.infer<typeof createEventInput>;
