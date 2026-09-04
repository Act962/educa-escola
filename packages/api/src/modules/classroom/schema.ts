import { z } from "zod";

export const classroomName = z.string().trim().min(1, "Informe o nome da turma").max(80);

export const academicYear = z
  .number()
  .int()
  .min(2000, "Ano letivo fora do intervalo suportado")
  .max(2100, "Ano letivo fora do intervalo suportado");

export const classroomId = z.object({ id: z.string().min(1) });

export const createClassroomInput = z.object({
  name: classroomName,
  academicYear,
});

export const renameClassroomInput = z.object({
  id: z.string().min(1),
  name: classroomName,
});

export type CreateClassroomInput = z.infer<typeof createClassroomInput>;
export type RenameClassroomInput = z.infer<typeof renameClassroomInput>;
