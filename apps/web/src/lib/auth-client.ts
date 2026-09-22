import { ac, roles } from "@educa-escola/auth/permissions";
import { organizationClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/**
 * Cliente do Better Auth.
 *
 * O plugin de organização entra aqui porque o nome da escola mora em
 * `organization`, que é tabela da auth: a tela de Configurações o altera por
 * `authClient.organization.update`, e não por uma procedure nossa. Escrever
 * nessa tabela a partir do domínio passaria ao largo da checagem de permissão
 * e dos hooks do próprio Better Auth.
 *
 * `ac` e `roles` vêm de `permissions.ts`, que é importável pelo cliente de
 * propósito — não puxa nada de servidor. São os mesmos objetos que o servidor
 * usa, então não há uma segunda definição de papel para divergir.
 */
export const authClient = createAuthClient({
  plugins: [organizationClient({ ac, roles })],
});
