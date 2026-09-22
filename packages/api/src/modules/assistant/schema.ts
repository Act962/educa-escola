import { z } from "zod";

/**
 * O que a direção configura. **A chave é campo de escrita, nunca de leitura.**
 *
 * `apiKey` opcional de propósito: salvar a tela sem mexer na chave mantém a
 * que está lá. Mandar string vazia é o que apaga. Sem isso, editar o nome do
 * modelo obrigaria a redigitar a credencial toda vez — e quem redigita
 * credencial toda hora acaba guardando ela num bloco de notas.
 */
export const updateSettingsInput = z.object({
  enabled: z.boolean(),
  providerLabel: z.string().trim().max(60).nullable().optional(),
  baseUrl: z
    .string()
    .trim()
    .max(300)
    .refine((v) => v === "" || /^https?:\/\/.+/.test(v), "Informe um endereço http(s) válido")
    .nullable()
    .optional(),
  model: z.string().trim().max(120).nullable().optional(),
  /** `org-…` da OpenAI. Identificador, não segredo: vai em claro. */
  organizationId: z.string().trim().max(120).nullable().optional(),
  /** `undefined` mantém a chave atual; `""` apaga; texto substitui. */
  apiKey: z.string().max(400).optional(),
  maxTokens: z.number().int().min(64).max(4000),
  dailyLimit: z.number().int().min(1).max(10_000),
  /**
   * Teto de tokens no mês. `null` é "sem orçamento declarado".
   *
   * O mínimo é alto de propósito: orçamento menor que umas poucas respostas
   * esgotaria no primeiro uso, e a direção leria isso como defeito do Astro
   * em vez de como o número que ela digitou.
   */
  monthlyTokenBudget: z.number().int().min(1_000).max(100_000_000).nullable().optional(),
  allowTeachers: z.boolean(),
  allowStudents: z.boolean(),
});

export const askInput = z.object({
  pergunta: z.string().trim().min(3, "Escreva a pergunta").max(500),
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsInput>;
export type AskInput = z.infer<typeof askInput>;
