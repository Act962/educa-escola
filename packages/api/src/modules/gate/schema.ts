import { z } from "zod";

/**
 * O descritor do rosto: os "códigos" que o tablet extrai.
 *
 * O teto de 1024 existe porque isto vem do navegador: sem ele, um cliente
 * hostil manda um vetor gigante e a comparação varre a escola inteira contra
 * ele. O piso de 64 recusa o que não é descritor de extrator nenhum.
 */
export const descritor = z.array(z.number().finite()).min(64).max(1024);

export const identificarInput = z.object({
  descritor,
  extractor: z.string().trim().min(1).max(60),
});

/** O que a carteirinha entrega: o número de matrícula lido do QR. */
export const porMatriculaInput = z.object({
  registration: z.string().trim().min(1).max(40),
});

export const registrarInput = z.object({
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

export const cadastrarMoldeInput = z.object({
  studentId: z.string().min(1),
  descritor,
  extractor: z.string().trim().min(1).max(60),
});

export type IdentificarInput = z.infer<typeof identificarInput>;
export type PorMatriculaInput = z.infer<typeof porMatriculaInput>;
export type RegistrarInput = z.infer<typeof registrarInput>;
export type CadastrarMoldeInput = z.infer<typeof cadastrarMoldeInput>;
