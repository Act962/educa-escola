import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Tentativas de login erradas, por conta.
 *
 * O limite do Better Auth é por IP, e uma escola inteira sai para a internet
 * por um IP só: 30 alunos no laboratório são uma pessoa para ele. Por isso o
 * limite por IP é folgado, e quem protege cada conta contra adivinhação de
 * senha é esta tabela.
 *
 * Chave pelo e-mail digitado, normalizado — e não pelo `user.id`: conta que
 * não existe precisa bloquear igual, senão o bloqueio denuncia quais e-mails
 * têm cadastro.
 *
 * Sem `schoolId` de propósito: é infraestrutura de autenticação, como
 * `session`. A mesma pessoa entra em várias escolas com a mesma senha.
 */
export const loginThrottle = pgTable("login_throttle", {
  email: text("email").primaryKey(),
  failures: integer("failures").notNull(),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).notNull(),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
});
