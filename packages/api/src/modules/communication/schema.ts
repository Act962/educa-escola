import { z } from "zod";

export const AUDIENCES = ["toda_a_escola", "professores", "alunos", "turma"] as const;
export const PRIORITIES = ["normal", "importante", "urgente"] as const;

export type Audience = (typeof AUDIENCES)[number];
export type Priority = (typeof PRIORITIES)[number];

export const AUDIENCE_LABEL: Record<Audience, string> = {
  toda_a_escola: "Toda a escola",
  professores: "Professores",
  alunos: "Alunos",
  turma: "Uma turma",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  normal: "Normal",
  importante: "Importante",
  urgente: "Urgente",
};

export const academicYear = z.number().int().min(2000).max(2100);

export const communicationYearInput = z.object({ academicYear });

export const saveDraftInput = z
  .object({
    academicYear,
    title: z.string().trim().min(3, "Informe o título do comunicado").max(120),
    body: z.string().trim().min(10, "Escreva o comunicado").max(5000),
    priority: z.enum(PRIORITIES).default("normal"),
    audience: z.enum(AUDIENCES).default("toda_a_escola"),
    classroomId: z.string().min(1).optional(),
    requiresAck: z.boolean().default(false),
  })
  .refine((v) => v.audience !== "turma" || Boolean(v.classroomId), {
    message: "Escolha a turma destinatária",
    path: ["classroomId"],
  });

export const publishInput = z.object({
  id: z.string().min(1),
  /**
   * Confirmação explícita para envio em massa (§8.3, regra 5).
   *
   * O cliente precisa dizer quantas pessoas ele **viu** no aviso. Se o público
   * tiver mudado desde então, a publicação é recusada em vez de mandar para
   * mais gente do que a pessoa aprovou.
   */
  publicoConfirmado: z.number().int().min(0).optional(),
});

export const communicationId = z.object({ id: z.string().min(1) });

export const rectifyInput = saveDraftInput.and(z.object({ replacesId: z.string().min(1) }));

export type SaveDraftInput = z.infer<typeof saveDraftInput>;
export type PublishInput = z.infer<typeof publishInput>;
