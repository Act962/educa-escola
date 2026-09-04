import { APP_ROLES, type AppRole, auth } from "@educa-escola/auth";
import { db } from "@educa-escola/db";

import type { Membership } from "./trpc/tenant";

function isAppRole(value: string): value is AppRole {
  return (APP_ROLES as readonly string[]).includes(value);
}

/**
 * O Better Auth guarda `role` como texto e admite mais de um papel separado
 * por vírgula. Ficamos com o primeiro papel conhecido; um valor desconhecido
 * não vira papel nenhum (nega por padrão, em vez de assumir privilégio).
 */
export function parseRole(raw: string | null | undefined): AppRole | null {
  if (!raw) return null;
  for (const candidate of raw.split(",")) {
    const role = candidate.trim();
    if (isAppRole(role)) return role;
  }
  return null;
}

async function resolveMembership(headers: Headers): Promise<Membership | null> {
  try {
    const member = await auth.api.getActiveMember({ headers });
    if (!member) return null;

    const role = parseRole(member.role);
    if (!role) return null;

    return { schoolId: member.organizationId, userId: member.userId, role };
  } catch {
    // Sem escola ativa na sessão o endpoint lança; para nós é só "sem vínculo".
    return null;
  }
}

export async function createContext({ req }: { req: Request }) {
  const session = await auth.api.getSession({ headers: req.headers });

  let membership: Promise<Membership | null> | undefined;

  return {
    db,
    session,
    /** Resolvido sob demanda: procedures públicas não pagam essa consulta. */
    getMembership: () => (membership ??= resolveMembership(req.headers)),
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
