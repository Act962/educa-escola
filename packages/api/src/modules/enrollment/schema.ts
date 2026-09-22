import { z } from "zod";

/**
 * Espelho em Zod dos enums do banco.
 *
 * Duplicado de propósito: o teste de arquitetura proíbe este arquivo de
 * importar `@educa-escola/db/schema`, porque quem importa schema costuma
 * acabar montando query fora do repositório.
 */
export const ENROLLMENT_STATUSES = [
  "pendente",
  "ativa",
  "suspensa",
  "cancelada",
  "transferida",
  "concluida",
] as const;

export const ENROLLMENT_KINDS = ["matricula", "rematricula"] as const;

export const GUARDIAN_RELATIONSHIPS = ["mae", "pai", "avo", "responsavel_legal", "outro"] as const;

export const CONSENT_PURPOSES = ["termos_matricula", "uso_imagem", "comunicacao"] as const;

export const SHIFTS = ["manha", "tarde", "noite"] as const;

/** Versão do termo aceita hoje. Muda quando o texto do termo muda. */
export const CURRENT_TERM_VERSION = "2026.1";

/** Motivos fechados de cancelamento — é o que alimenta o indicador de evasão. */
export const CANCEL_REASONS = [
  "transferencia_outra_escola",
  "mudanca_de_cidade",
  "desistencia",
  "dados_incorretos",
  "outro",
] as const;

export const enrollmentId = z.object({ id: z.string().min(1) });

export const academicYear = z
  .number()
  .int()
  .min(2000, "Ano letivo fora do intervalo suportado")
  .max(2100, "Ano letivo fora do intervalo suportado");

/** Data civil no formato do banco. Aniversário não depende de fuso. */
export const civilDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use uma data no formato dd/mm/aaaa");

/**
 * Celular brasileiro normalizado para E.164.
 *
 * Aceita o que a secretaria digita — "(86) 99812-2039" — e guarda
 * "+5586998122039", que é o formato que a API de mensagem exige.
 */
export const phone = z
  .string()
  .trim()
  .min(1, "Informe o celular do responsável")
  .transform((value) => value.replace(/\D/g, ""))
  .refine((digits) => digits.length === 10 || digits.length === 11 || digits.length === 13, {
    message: "Celular inválido: informe DDD e número",
  })
  .transform((digits) => (digits.length === 13 ? `+${digits}` : `+55${digits}`));

export const guardianInput = z.object({
  name: z.string().trim().min(1, "Informe o nome do responsável").max(120),
  relationship: z.enum(GUARDIAN_RELATIONSHIPS).default("responsavel_legal"),
  phoneE164: phone,
  email: z.email("Informe um e-mail válido").nullish(),
  isLegal: z.boolean().default(true),
});

export const listEnrollmentsInput = z
  .object({
    search: z.string().trim().max(120).optional(),
    status: z.enum(ENROLLMENT_STATUSES).optional(),
    academicYear: academicYear.optional(),
    /**
     * Os dois recortes do disparo em massa: "todos os 6º" e "todos da manhã".
     *
     * Consulta sobre os campos reais, e não leitura do código `6M` de volta —
     * um filtro que interpreta texto erra no dia em que o texto mudar.
     */
    classroomId: z.string().min(1).optional(),
    shift: z.enum(SHIFTS).optional(),
    limit: z.number().int().min(1).max(200).default(50),
    offset: z.number().int().min(0).default(0),
  })
  .default({ limit: 50, offset: 0 });

export const createEnrollmentInput = z.object({
  student: z.object({
    /** Informado quando o aluno já existe; nulo cria um cadastro novo. */
    id: z.string().min(1).nullish(),
    name: z.string().trim().min(1, "Informe o nome do aluno").max(120),
    registration: z
      .string()
      .trim()
      .max(30)
      .transform((value) => value.toUpperCase().replace(/\s+/g, ""))
      .optional(),
    birthDate: civilDate,
    shift: z.enum(SHIFTS).default("manha"),
  }),
  guardian: guardianInput,
  /**
   * Obrigatória na criação.
   *
   * É dela que sai a série, e sem série não há código de turma nem
   * agrupamento para o disparo. O custo é que a pré-matrícula sem vaga
   * definida (§5.1) deixa de caber nesta tela.
   */
  classroomId: z.string().min(1, "Escolha a turma"),
  academicYear,
  expiryDays: z.number().int().min(1).max(60).default(7),
});

export const renewEnrollmentInput = z.object({
  id: z.string().min(1),
  academicYear,
  classroomId: z.string().min(1).nullish(),
  expiryDays: z.number().int().min(1).max(60).default(7),
});

/**
 * Cancelar exige motivo e data de efeito (RN-044).
 *
 * No Zod e não só na intenção: sem motivo registrado, o indicador de evasão
 * depois vira adivinhação.
 */
export const cancelEnrollmentInput = z.object({
  id: z.string().min(1),
  reason: z.enum(CANCEL_REASONS),
  note: z.string().trim().max(500).nullish(),
  effectiveOn: civilDate,
});

/**
 * Edição da matrícula pela secretaria.
 *
 * Tudo opcional: a tela manda só o que mudou, e o service registra campo,
 * valor anterior e valor novo na trilha — que é o que a §20.2 exige para
 * alteração de matrícula.
 */
export const updateEnrollmentInput = z.object({
  id: z.string().min(1),
  student: z
    .object({
      name: z.string().trim().min(1, "Informe o nome do aluno").max(120).optional(),
      birthDate: civilDate.optional(),
    })
    .optional(),
  classroomId: z.string().min(1).optional(),
  shift: z.enum(SHIFTS).optional(),
  guardian: z
    .object({
      id: z.string().min(1),
      name: z.string().trim().min(1, "Informe o nome do responsável").max(120).optional(),
      relationship: z.enum(GUARDIAN_RELATIONSHIPS).optional(),
      phoneE164: phone.optional(),
      email: z.email("Informe um e-mail válido").nullish(),
    })
    .optional(),
});

export const confirmEnrollmentInput = z.object({
  id: z.string().min(1),
  classroomId: z.string().min(1).nullish(),
});

export type ListEnrollmentsInput = z.infer<typeof listEnrollmentsInput>;
export type CreateEnrollmentInput = z.infer<typeof createEnrollmentInput>;
export type RenewEnrollmentInput = z.infer<typeof renewEnrollmentInput>;
export type CancelEnrollmentInput = z.infer<typeof cancelEnrollmentInput>;
export type ConfirmEnrollmentInput = z.infer<typeof confirmEnrollmentInput>;
export type UpdateEnrollmentInput = z.infer<typeof updateEnrollmentInput>;
export type GuardianInput = z.infer<typeof guardianInput>;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];
export type CancelReason = (typeof CANCEL_REASONS)[number];
export type ConsentPurpose = (typeof CONSENT_PURPOSES)[number];
