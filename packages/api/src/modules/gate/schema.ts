import { z } from "zod";

/**
 * O descritor do rosto: os "códigos" que o tablet extrai.
 *
 * O teto de 1024 existe porque isto vem do navegador: sem ele, um cliente
 * hostil manda um vetor gigante e a comparação varre a escola inteira contra
 * ele. O piso de 64 recusa o que não é descritor de extrator nenhum.
 */
export const descriptor = z.array(z.number().finite()).min(64).max(1024);

export const identifyInput = z.object({
  descriptor,
  extractor: z.string().trim().min(1).max(60),
});

/** O que a carteirinha entrega: o número de matrícula lido do QR. */
export const byRegistrationInput = z.object({
  registration: z.string().trim().min(1).max(40),
});

export const recordEntryInput = z.object({
  studentId: z.string().min(1),
  /**
   * Ausente quando o portão não declara sentido.
   *
   * Câmera de entrada e câmera de saída é o desenho certo, e aí cada uma manda
   * o seu sentido. Onde houver só uma, o serviço alterna a partir da última
   * passagem do dia — ninguém na portaria vai apertar botão.
   */
  direction: z.enum(["entrada", "saida"]).optional(),
  method: z.enum(["rosto", "carteirinha", "manual"]),
  /** Qual tablet. Texto livre porque quem nomeia é a escola. */
  deviceLabel: z.string().trim().max(60).nullable().optional(),
});

export const enrollTemplateInput = z.object({
  studentId: z.string().min(1),
  descriptor,
  extractor: z.string().trim().min(1).max(60),
});

export type IdentifyInput = z.infer<typeof identifyInput>;
export type ByRegistrationInput = z.infer<typeof byRegistrationInput>;
export type RecordEntryInput = z.infer<typeof recordEntryInput>;
export type EnrollTemplateInput = z.infer<typeof enrollTemplateInput>;

/**
 * O recorte da tela de passagens.
 *
 * `dia` é data civil, não instante: "22/09" é o dia da escola, e mandar um
 * `Date` faria o fuso do tablet decidir de que dia é a lista.
 */
export const entriesInput = z.object({
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD")
    .optional(),
  studentId: z.string().min(1).optional(),
  excluidas: z.boolean().optional(),
});

export const deleteEntryInput = z.object({ id: z.string().min(1) });

export type EntriesInput = z.infer<typeof entriesInput>;
export type DeleteEntryInput = z.infer<typeof deleteEntryInput>;
