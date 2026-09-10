import type { AppRole } from "@educa-escola/auth";

/**
 * Escopo do tenant de uma requisição já autenticada.
 *
 * Todo repositório exige um `TenantContext` para ser construído: é isso que
 * torna o isolamento entre escolas estrutural, e não uma lembrança de quem
 * escreve a query.
 */
export interface TenantContext {
  readonly schoolId: string;
}

export interface Membership extends TenantContext {
  readonly userId: string;
  readonly role: AppRole;
  /** Nome da escola ativa. A casca do app mostra em toda tela (ContextBar). */
  readonly schoolName: string;
}
