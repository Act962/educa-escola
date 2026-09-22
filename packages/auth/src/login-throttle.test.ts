import { closeTestDb, createTestDb, withRollback } from "@educa-escola/db/testing";
import { afterAll, describe, expect, it } from "vitest";

import {
  createLoginThrottle,
  LOGIN_LOCK_SECONDS,
  LOGIN_MAX_FAILURES,
  LOGIN_WINDOW_SECONDS,
} from "./login-throttle";

afterAll(async () => {
  await closeTestDb();
});

/** Relógio que o teste avança à mão: nada de esperar 15 minutos de verdade. */
function relogio(inicio = new Date("2026-09-22T07:30:00Z")) {
  let atual = inicio.getTime();
  return {
    now: () => new Date(atual),
    avancar: (segundos: number) => {
      atual += segundos * 1000;
    },
  };
}

const emailAleatorio = () => `aluno-${crypto.randomUUID().slice(0, 8)}@escola.br`;

describe("createLoginThrottle", () => {
  it("bloqueia no quinto erro, e só nele", async () => {
    await withRollback(async (tx) => {
      const { now } = relogio();
      const throttle = createLoginThrottle(tx, now);
      const email = emailAleatorio();

      for (let i = 1; i < LOGIN_MAX_FAILURES; i++) {
        const r = await throttle.registerFailure(email);
        expect(r).toEqual({ failures: i, lockedUntil: null });
      }
      expect(await throttle.lockedUntil(email)).toBeNull();

      const quinto = await throttle.registerFailure(email);
      expect(quinto.failures).toBe(LOGIN_MAX_FAILURES);
      expect(quinto.lockedUntil).toEqual(new Date(now().getTime() + LOGIN_LOCK_SECONDS * 1000));
      expect(await throttle.lockedUntil(email)).toEqual(quinto.lockedUntil);
    });
  });

  it("o bloqueio vence sozinho, e a contagem recomeça do zero", async () => {
    await withRollback(async (tx) => {
      const r = relogio();
      const throttle = createLoginThrottle(tx, r.now);
      const email = emailAleatorio();

      for (let i = 0; i < LOGIN_MAX_FAILURES; i++) await throttle.registerFailure(email);
      r.avancar(LOGIN_LOCK_SECONDS + 1);

      expect(await throttle.lockedUntil(email)).toBeNull();
      // Um erro depois do bloqueio não rebloqueia: é o primeiro de uma janela nova.
      expect(await throttle.registerFailure(email)).toEqual({ failures: 1, lockedUntil: null });
    });
  });

  it("erros espaçados além da janela não se acumulam", async () => {
    await withRollback(async (tx) => {
      const r = relogio();
      const throttle = createLoginThrottle(tx, r.now);
      const email = emailAleatorio();

      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) await throttle.registerFailure(email);
      r.avancar(LOGIN_WINDOW_SECONDS + 1);

      expect(await throttle.registerFailure(email)).toEqual({ failures: 1, lockedUntil: null });
    });
  });

  it("acertar a senha zera os erros", async () => {
    await withRollback(async (tx) => {
      const throttle = createLoginThrottle(tx, relogio().now);
      const email = emailAleatorio();

      for (let i = 0; i < LOGIN_MAX_FAILURES - 1; i++) await throttle.registerFailure(email);
      await throttle.reset(email);

      expect(await throttle.registerFailure(email)).toEqual({ failures: 1, lockedUntil: null });
    });
  });

  it("trata maiúsculas e espaços como a mesma conta", async () => {
    await withRollback(async (tx) => {
      const throttle = createLoginThrottle(tx, relogio().now);

      await throttle.registerFailure("Ana.Souza@Escola.br ");
      const segundo = await throttle.registerFailure("ana.souza@escola.br");

      expect(segundo.failures).toBe(2);
    });
  });

  it("erros simultâneos na mesma conta contam todos", async () => {
    // Fora de transação: dentro de uma, as chamadas seriam enfileiradas na
    // mesma conexão e o teste não provaria nada sobre concorrência.
    const db = createTestDb();
    const throttle = createLoginThrottle(db, relogio().now);
    const email = emailAleatorio();

    try {
      await Promise.all(
        Array.from({ length: LOGIN_MAX_FAILURES }, () => throttle.registerFailure(email)),
      );
      expect(await throttle.lockedUntil(email)).not.toBeNull();
    } finally {
      await throttle.reset(email);
    }
  });
});
