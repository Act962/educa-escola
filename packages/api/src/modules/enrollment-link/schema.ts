import { z } from "zod";

import { civilDate, GUARDIAN_RELATIONSHIPS, phone } from "../enrollment/schema";

/**
 * O token vem da URL. Só o formato é validado aqui — se ele existe, se venceu
 * ou se já foi usado é decisão do service, que precisa do banco para saber.
 */
export const linkToken = z.object({
  token: z.string().trim().min(20).max(120),
});

export const verifyLinkInput = linkToken.extend({
  birthDate: civilDate,
});

/**
 * A ficha que o responsável devolve.
 *
 * É deliberadamente curta: nome, contato e turno. Nada de documento, nada de
 * dado de saúde — a página pública é a superfície menos confiável do sistema,
 * e a §24.3 classifica laudo e saúde como sensíveis.
 */
export const submitLinkInput = linkToken.extend({
  student: z.object({
    name: z.string().trim().min(1, "Informe o nome do aluno").max(120),
  }),
  guardian: z.object({
    name: z.string().trim().min(1, "Informe o nome do responsável").max(120),
    relationship: z.enum(GUARDIAN_RELATIONSHIPS),
    phoneE164: phone,
    email: z.email("Informe um e-mail válido").nullish(),
  }),
  consents: z.object({
    termos_matricula: z.literal(true, "É preciso aceitar os termos da matrícula"),
    uso_imagem: z.boolean(),
    comunicacao: z.boolean(),
    /**
     * Identificação facial na catraca. Opcional de verdade: quem recusar entra
     * pela carteirinha com QR, e recusar não pode barrar criança na escola.
     */
    biometria: z.boolean(),
  }),
  /** Nome de quem está aceitando, que nem sempre é o do cadastro. */
  acceptedBy: z.string().trim().min(1, "Informe seu nome").max(120),
});

export type VerifyLinkInput = z.infer<typeof verifyLinkInput>;
export type SubmitLinkInput = z.infer<typeof submitLinkInput>;

/**
 * A resposta ao link curto de autorização.
 *
 * `autoriza` é booleano, e recusar é resposta legítima: quem não autoriza
 * entra pela carteirinha, e recusar não pode barrar criança na escola. Por
 * isso não é `z.literal(true)` como os termos da matrícula.
 */
export const autorizarBiometriaInput = z.object({
  token: linkToken.shape.token,
  autoriza: z.boolean(),
  /** Nome de quem está respondendo, que nem sempre é o do cadastro. */
  acceptedBy: z.string().trim().min(1, "Informe seu nome").max(120),
});

export type AutorizarBiometriaInput = z.infer<typeof autorizarBiometriaInput>;
