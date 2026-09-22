import { createDb } from "@educa-escola/db";
import { member } from "@educa-escola/db/schema";
import * as schema from "@educa-escola/db/schema/auth";
import { env } from "@educa-escola/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oneTimeToken } from "better-auth/plugins/one-time-token";
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
      /*
       * Entrega da identidade para o Órbita.
       *
       * O Integra é dono das pessoas da escola — a secretaria provisiona as
       * contas e não há auto-cadastro. Então é ele quem emite, e o Órbita
       * aceita: o caminho inverso obrigaria um professor a ter conta lá para
       * usar o sistema da escola.
       *
       * DECISÃO-JOÃO: qual mecanismo de identidade entre os dois sistemas.
       * Quebra se: o token de uso único exige que o Órbita chame de volta
       *   `/api/auth/one-time-token/verify` a cada entrada. Se os dois não se
       *   enxergarem em rede, ou se a latência incomodar, nada disso funciona.
       * Fiz assim: `oneTimeToken` porque está no pacote dos dois lados
       *   (1.7.1 aqui, 1.6.5 lá), não exige migration — usa a tabela
       *   `verification`, que já existe — e não adiciona dependência.
       * Alternativas: `jwt` + JWKS, em que o Órbita verifica sem chamar de
       *   volta · OIDC completo, que exige o pacote separado de
       *   `oidc-provider` (saiu do core na 1.7).
       */
      oneTimeToken({
        // Curto: o token viaja na URL até o Órbita e não deve sobreviver a
        // um histórico de navegador.
        expiresIn: 3,
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
