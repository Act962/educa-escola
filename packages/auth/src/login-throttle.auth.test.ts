import { user } from "@educa-escola/db/schema";
import { closeTestDb, createTestDb } from "@educa-escola/db/testing";
import { env } from "@educa-escola/env/server";
import { inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { createAuth } from "./index";
import { createLoginThrottle, LOGIN_MAX_FAILURES } from "./login-throttle";

/**
 * O limite por conta visto de fora, por requisição HTTP ao Better Auth.
 *
 * Pelo `handler`, e não por `auth.api.*`: é por ele que o navegador chega, e
 * só nele o erro lançado no hook `before` vira resposta 429 — pela API
 * interna ele sobe como exceção.
 *
 * Fora de `withRollback`: o Better Auth abre transação própria no cadastro, e
 * isso não se aninha na transação revertida. Os e-mails são aleatórios e
 * limpos no fim, como os de qualquer fixture.
 */
const db = createTestDb();
const auth = createAuth(db);
const throttle = createLoginThrottle(db);

const SENHA = "senha-correta-123";
const usados: string[] = [];

afterAll(async () => {
  for (const email of usados) await throttle.reset(email);
  if (usados.length > 0) await db.delete(user).where(inArray(user.email, usados));
  await closeTestDb();
});

async function contaNova(): Promise<string> {
  const email = `login-${crypto.randomUUID().slice(0, 8)}@escola.br`;
  usados.push(email);
  await auth.api.signUpEmail({ body: { email, password: SENHA, name: "Aluno de Teste" } });
  return email;
}

function entrar(email: string, password: string): Promise<Response> {
  usados.push(email);
  return auth.handler(
    new Request(`${env.BETTER_AUTH_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: env.BETTER_AUTH_URL },
      body: JSON.stringify({ email, password }),
    }),
  );
}

describe("login com limite por conta", () => {
  it("depois de cinco senhas erradas recusa até a senha certa", async () => {
    const email = await contaNova();

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await entrar(email, "senha-errada")).status).toBe(401);
    }

    // Bloqueada, a senha certa nem é conferida.
    const certa = await entrar(email, SENHA);
    expect(certa.status).toBe(429);
    expect(Number(certa.headers.get("retry-after"))).toBeGreaterThan(890);
    expect(await certa.json()).toMatchObject({
      code: "LOGIN_TEMPORARIAMENTE_BLOQUEADO",
      message: expect.stringContaining("15 minutos"),
    });
  });

  it("e-mail sem cadastro bloqueia igual, para não denunciar quem tem conta", async () => {
    const email = `ninguem-${crypto.randomUUID().slice(0, 8)}@escola.br`;

    for (let i = 0; i < LOGIN_MAX_FAILURES; i++) {
      expect((await entrar(email, "qualquer-senha")).status).toBe(401);
    }
    expect((await entrar(email, "qualquer-senha")).status).toBe(429);
  });

  it("acertar a senha antes do limite zera a contagem", async () => {
    const email = await contaNova();

    for (let i = 1; i < LOGIN_MAX_FAILURES; i++) await entrar(email, "senha-errada");
    expect((await entrar(email, SENHA)).status).toBe(200);

    // Sem o zero, este seria o quinto erro e a próxima tentativa já bloquearia.
    expect((await entrar(email, "senha-errada")).status).toBe(401);
    expect((await entrar(email, SENHA)).status).toBe(200);
  });

  it("entrada inválida não conta como tentativa", async () => {
    const invalido = `nao-e-email-${crypto.randomUUID().slice(0, 8)}`;

    for (let i = 0; i < LOGIN_MAX_FAILURES + 1; i++) {
      expect((await entrar(invalido, "qualquer-senha")).status).toBe(400);
    }
    // Nenhuma das seis ficou registrada: o próximo erro é o primeiro.
    expect(await throttle.registerFailure(invalido)).toEqual({ failures: 1, lockedUntil: null });
  });
});
