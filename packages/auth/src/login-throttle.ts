import { loginThrottle } from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, eq, gt, sql } from "drizzle-orm";

/**
 * Limite de tentativas de login por conta.
 *
 * DECISÃO-JOÃO: opção C — limite por IP folgado e limite por conta.
 * Quebra se: alguém souber o e-mail de uma pessoa e errar a senha de
 *   propósito cinco vezes — a conta fica bloqueada por 15 minutos. É o preço
 *   de qualquer bloqueio por conta; ele é temporário justamente para que isso
 *   seja um incômodo, e não um jeito de tirar alguém do sistema.
 * Fiz assim: 5 erros em 15 minutos bloqueiam por 15 minutos, a partir da
 *   sexta tentativa; acertar zera.
 * Alternativas: só por IP (bloqueia a escola inteira atrás do roteador) ·
 *   CAPTCHA depois de N erros · atraso progressivo em vez de bloqueio.
 */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_WINDOW_SECONDS = 15 * 60;
export const LOGIN_LOCK_SECONDS = 15 * 60;

/** O e-mail como a pessoa digitou não é chave: "Ana@X.br " e "ana@x.br" são a mesma conta. */
export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createLoginThrottle(db: DbHandle, now: () => Date = () => new Date()) {
  return {
    /** Até quando a conta está bloqueada, ou `null` se pode tentar. */
    async lockedUntil(email: string): Promise<Date | null> {
      const [row] = await db
        .select({ lockedUntil: loginThrottle.lockedUntil })
        .from(loginThrottle)
        .where(
          and(
            eq(loginThrottle.email, normalizeLoginEmail(email)),
            gt(loginThrottle.lockedUntil, now()),
          ),
        );
      return row?.lockedUntil ?? null;
    },

    /**
     * Conta um erro e bloqueia ao chegar no limite.
     *
     * Um `upsert` só, e não ler-somar-gravar: dois erros simultâneos na mesma
     * conta leriam o mesmo valor e contariam um. Janela vencida recomeça do 1.
     */
    async registerFailure(email: string): Promise<{ failures: number; lockedUntil: Date | null }> {
      const agora = now();
      const janelaVencida = sql`${loginThrottle.windowStartedAt} <= ${agora}::timestamptz - make_interval(secs => ${LOGIN_WINDOW_SECONDS})`;
      const proximaContagem = sql`case when ${janelaVencida} then 1 else ${loginThrottle.failures} + 1 end`;

      const [row] = await db
        .insert(loginThrottle)
        .values({
          email: normalizeLoginEmail(email),
          failures: 1,
          windowStartedAt: agora,
          lockedUntil: null,
        })
        .onConflictDoUpdate({
          target: loginThrottle.email,
          set: {
            failures: proximaContagem,
            windowStartedAt: sql`case when ${janelaVencida} then ${agora}::timestamptz else ${loginThrottle.windowStartedAt} end`,
            // Janela nova limpa o bloqueio vencido: sem isso o primeiro erro
            // depois do bloqueio devolvia o `locked_until` antigo, e quem lê o
            // retorno trataria a conta como bloqueada por um erro só.
            lockedUntil: sql`case
              when ${proximaContagem} >= ${LOGIN_MAX_FAILURES}
                then ${agora}::timestamptz + make_interval(secs => ${LOGIN_LOCK_SECONDS})
              when ${janelaVencida} then null
              else ${loginThrottle.lockedUntil} end`,
          },
        })
        .returning({ failures: loginThrottle.failures, lockedUntil: loginThrottle.lockedUntil });

      if (!row) throw new Error("login_throttle: o upsert não devolveu a linha");
      return row;
    },

    /** Acertou a senha: o histórico de erros deixa de valer. */
    async reset(email: string): Promise<void> {
      await db.delete(loginThrottle).where(eq(loginThrottle.email, normalizeLoginEmail(email)));
    },
  };
}

export type LoginThrottle = ReturnType<typeof createLoginThrottle>;
