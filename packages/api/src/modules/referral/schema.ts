import { z } from "zod";

export const REWARD_KINDS = ["percentual", "valor"] as const;
export const REFERER_KINDS = ["responsavel", "aluno", "ambos"] as const;

export type RewardKind = (typeof REWARD_KINDS)[number];
export type RefererKind = (typeof REFERER_KINDS)[number];

export const REWARD_KIND_LABEL: Record<RewardKind, string> = {
  percentual: "Percentual da mensalidade",
  valor: "Valor fixo",
};

export const REFERER_KIND_LABEL: Record<RefererKind, string> = {
  responsavel: "Só o responsável",
  aluno: "Só o aluno",
  ambos: "Responsável e aluno",
};

/**
 * O que cada escolha de divulgador significa na prática.
 *
 * Vive aqui, e não na tela, porque é a consequência jurídica da opção — e a
 * tela precisa mostrá-la ao lado do campo, no momento em que a direção
 * escolhe, não num documento que ninguém abre.
 */
export const REFERER_KIND_GRADE: Record<RefererKind, string> = {
  responsavel:
    "Quem divulga é um adulto. É a opção que não encosta na Resolução 163/2014 do CONANDA, que trata como abusiva a publicidade dirigida a criança e adolescente.",
  aluno:
    "O aluno passa a captar matrícula para a escola. Em escola de educação básica isso é publicidade dirigida a criança — verifique com a assessoria jurídica antes de ligar.",
  ambos:
    "Inclui o aluno na divulgação, com a mesma ressalva: parte do seu público é criança e adolescente.",
};

/** Percentual de 1 a 100; valor em centavos, para não somar em ponto flutuante. */
const rewardValue = z.number().int().min(1).max(1_000_000);

export const updateProgramInput = z
  .object({
    enabled: z.boolean(),
    headline: z.string().trim().min(3, "Informe o título do programa").max(80),
    description: z.string().trim().max(400).nullable().optional(),
    terms: z.string().trim().max(4000).nullable().optional(),
    rewardKind: z.enum(REWARD_KINDS),
    rewardValue,
    rewardCapPerYear: z.number().int().min(1).max(50),
    linkExpiresInDays: z.number().int().min(0).max(730),
    whoCanRefer: z.enum(REFERER_KINDS),
  })
  .refine((v) => v.rewardKind !== "percentual" || v.rewardValue <= 100, {
    message: "Um desconto percentual não passa de 100%.",
    path: ["rewardValue"],
  });

export const studentId = z.object({ studentId: z.string().min(1) });

/**
 * Código digitado por quem atende.
 *
 * Aceita minúscula e espaço porque ele chega ditado por telefone e copiado do
 * papel; a normalização é do service, não de quem digita.
 */
export const registerConversionInput = z.object({
  enrollmentId: z.string().min(1),
  code: z.string().trim().min(4, "O código de indicação tem ao menos 4 caracteres").max(24),
  note: z.string().trim().max(200).optional(),
});

export const conversionId = z.object({ id: z.string().min(1) });

export const academicYear = z.number().int().min(2000).max(2100);
export const referralYearInput = z.object({ academicYear });

export type UpdateProgramInput = z.infer<typeof updateProgramInput>;
export type RegisterConversionInput = z.infer<typeof registerConversionInput>;
