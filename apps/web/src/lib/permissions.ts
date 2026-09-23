import type { AppRole } from "@educa-escola/auth";
import { roles } from "@educa-escola/auth/permissions";

type PermissionRequest = Parameters<(typeof roles)[AppRole]["authorize"]>[0];

/**
 * O papel permite isto?
 *
 * Os mesmos objetos que o servidor usa em `permitted()` — `permissions.ts` é
 * importável pelo cliente de propósito. Escrever `role === "owner" || role ===
 * "admin"` na tela funciona hoje e passa a mentir no dia em que um papel novo
 * ganhar a permissão: haveria duas definições de quem pode, e só uma seria
 * corrigida.
 *
 * **Isto esconde, não protege.** A barreira de verdade continua no servidor;
 * aqui é para não oferecer à pessoa uma aba que vai responder 403.
 */
export function podeNoPapel(role: AppRole | undefined, request: PermissionRequest): boolean {
  return role ? roles[role].authorize(request).success : false;
}
