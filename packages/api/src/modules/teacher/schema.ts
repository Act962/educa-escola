import { z } from "zod";

export const teacherFilters = z.object({
  /** Busca por nome ou e-mail. */
  search: z.string().trim().max(120).optional(),
  academicYear: z.number().int().min(2000).max(2100),
  /** Só quem está devendo chamada ou nota. */
  withPending: z.boolean().optional(),
});

export const teacherId = z.object({
  userId: z.string().min(1),
  academicYear: z.number().int().min(2000).max(2100),
});

export type TeacherFilters = z.infer<typeof teacherFilters>;

/**
 * O que a secretaria preenche ao cadastrar um professor.
 *
 * Nome, e-mail e disciplinas — o mínimo para ele aparecer na lista e poder
 * receber turmas. Sem disciplina nenhuma ele entra e não tem o que fazer, mas
 * o campo não é obrigatório: contratação que ainda não definiu a grade é caso
 * real, e travar o cadastro por isso empurraria a secretaria para o banco.
 */
export const convidarProfessorInput = z.object({
  name: z.string().trim().min(3, "Informe o nome completo").max(120),
  email: z.email("Informe um e-mail válido"),
  subjectIds: z.array(z.string().min(1)).max(30).default([]),
  expiryDays: z.number().int().min(1).max(30).default(7),
});

export const conviteToken = z.object({ token: z.string().trim().min(20).max(120) });

/**
 * O aceite: o professor escolhe a própria senha.
 *
 * Oito caracteres é o piso do Better Auth. A escola nunca vê este valor — ele
 * vai direto para o `signUpEmail`, e o que fica no banco é o hash dele.
 */
export const aceitarConviteInput = conviteToken.extend({
  password: z.string().min(8, "A senha tem no mínimo 8 caracteres").max(200),
});

export type ConvidarProfessorInput = z.infer<typeof convidarProfessorInput>;
export type AceitarConviteInput = z.infer<typeof aceitarConviteInput>;
