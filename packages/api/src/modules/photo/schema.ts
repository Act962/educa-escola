import { z } from "zod";

export const studentRef = z.object({ studentId: z.string().min(1) });

export const savePhotoInput = studentRef.extend({
  /** O `data:image/...;base64,...` que a câmera do tablet produz. */
  dataUrl: z.string().min(32).max(4_000_000),
});

export const revokePhotoInput = studentRef.extend({
  reason: z.enum(["pedido_do_responsavel", "erro_no_cadastro", "saida_do_aluno", "outro"]),
});

export type SavePhotoInput = z.infer<typeof savePhotoInput>;
export type RevokePhotoInput = z.infer<typeof revokePhotoInput>;
