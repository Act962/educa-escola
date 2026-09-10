import { createDb } from "@educa-escola/db";
import { member } from "@educa-escola/db/schema";
import * as schema from "@educa-escola/db/schema/auth";
import { env } from "@educa-escola/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins/organization";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { asc, eq } from "drizzle-orm";

import { ac, roles } from "./permissions";

type Database = ReturnType<typeof createDb>;

/**
 * A escola é a `organization` do Better Auth: ela é a raiz do tenant.
 * O vínculo pessoa <-> escola e o papel (owner/admin/teacher/student) vivem
 * em `member`. Atributos escolares ricos ficam na tabela de domínio `school`,
 * que compartilha o id da organization.
 *
 * Recebe o `db` por parâmetro para que os testes injetem a conexão da
 * transação em vez de abrir um pool novo.
 */
export function createAuth(db: Database = createDb()) {
  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.BETTER_AUTH_URL],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    databaseHooks: {
      session: {
        create: {
          /**
           * Ativa a escola do vínculo já no login.
           *
           * Sem isto a sessão nasce sem `activeOrganizationId` e toda
           * `schoolProcedure` responde "nenhuma escola ativa" — o app subiria
           * autenticado e inútil. Quem tem mais de um vínculo entra no
           * primeiro e troca depois pela barra de contexto.
           */
          before: async (session) => {
            const [first] = await db
              .select({ organizationId: member.organizationId })
              .from(member)
              .where(eq(member.userId, session.userId))
              .orderBy(asc(member.createdAt))
              .limit(1);

            return {
              data: { ...session, activeOrganizationId: first?.organizationId ?? null },
            };
          },
        },
      },
    },
    plugins: [
      organization({
        ac,
        roles,
        // Quem cria a escola vira owner (diretoria/mantenedora).
        creatorRole: "owner",
        // Escolas são provisionadas pela plataforma, não por auto-cadastro.
        // Criação passa por `auth.api.createOrganization` no servidor.
        allowUserToCreateOrganization: false,
      }),
      // Precisa ser o último: cuida da escrita dos cookies na resposta.
      tanstackStartCookies(),
    ],
  });
}

export const auth = createAuth();

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth["$Infer"]["Session"];

export type { AppRole } from "./permissions";
export { APP_ROLES, ac, roles, statement } from "./permissions";
