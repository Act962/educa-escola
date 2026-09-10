import { z } from "zod";

export const ATTENDANCE_STATUSES = ["presente", "falta", "atraso"] as const;

export const lessonId = z.object({ id: z.string().min(1) });

export const attendanceEntry = z.object({
  studentId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES),
});

export const saveAttendanceInput = z.object({
  lessonId: z.string().min(1),
  /**
   * Só as exceções precisam vir: o service completa a turma com "presente".
   * Mandar a turma inteira também funciona.
   */
  entries: z.array(attendanceEntry).max(200),
  content: z.string().trim().max(2000).nullish(),
  homework: z.string().trim().max(2000).nullish(),
  justification: z.string().trim().max(500).nullish(),
});

export type SaveAttendanceInput = z.infer<typeof saveAttendanceInput>;
