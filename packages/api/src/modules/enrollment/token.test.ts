import { describe, expect, it } from "vitest";

import {
  birthDateMatches,
  expiryFrom,
  generateToken,
  hashToken,
  type InviteState,
  inviteVerdict,
  MAX_VERIFICATION_ATTEMPTS,
  protocolFor,
  VERIFICATION_WINDOW_MS,
  verificationIsFresh,
} from "./token";

const AGORA = new Date("2026-09-21T12:00:00Z");

function convite(overrides: Partial<InviteState> = {}): InviteState {
  return {
    expiresAt: new Date("2026-09-28T12:00:00Z"),
    consumedAt: null,
    revokedAt: null,
    lockedAt: null,
    verifiedAt: null,
    attempts: 0,
    ...overrides,
  };
}

describe("token do link de matrícula", () => {
  it("gera valor de 256 bits, diferente a cada chamada", () => {
    const a = generateToken();
    const b = generateToken();

    expect(a).not.toBe(b);
    // base64url de 32 bytes: 43 caracteres, sem "=" de preenchimento.
    expect(a).toHaveLength(43);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("o hash é estável e não devolve o token", () => {
    const token = generateToken();

    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
    expect(hashToken(token)).toHaveLength(64);
  });

  it("compara data de nascimento sem aceitar ausência de cadastro", () => {
    expect(birthDateMatches("2015-03-14", "2015-03-14")).toBe(true);
    expect(birthDateMatches("2015-03-14", "2015-03-15")).toBe(false);
    // Aluno sem data cadastrada não pode ser "conferido" por string vazia.
    expect(birthDateMatches(null, "")).toBe(false);
    expect(birthDateMatches(null, "2015-03-14")).toBe(false);
  });
});

describe("inviteVerdict", () => {
  it("aceita convite dentro do prazo", () => {
    expect(inviteVerdict(convite(), AGORA)).toBe("valido");
  });

  it("recusa convite vencido", () => {
    expect(inviteVerdict(convite({ expiresAt: new Date("2026-09-20T12:00:00Z") }), AGORA)).toBe(
      "vencido",
    );
  });

  it("uso único: convite consumido não volta a valer", () => {
    expect(inviteVerdict(convite({ consumedAt: AGORA }), AGORA)).toBe("consumido");
  });

  it("bloqueia ao esgotar as tentativas, mesmo sem lockedAt gravado", () => {
    expect(inviteVerdict(convite({ attempts: MAX_VERIFICATION_ATTEMPTS }), AGORA)).toBe(
      "bloqueado",
    );
    expect(inviteVerdict(convite({ attempts: MAX_VERIFICATION_ATTEMPTS - 1 }), AGORA)).toBe(
      "valido",
    );
  });

  /**
   * Revogado tem precedência sobre vencido e consumido: reemitir o link mata o
   * anterior, e é esse o motivo que a secretaria precisa ver no histórico.
   */
  it("revogado vence os demais motivos", () => {
    const morto = convite({
      revokedAt: AGORA,
      consumedAt: AGORA,
      expiresAt: new Date("2026-09-01T12:00:00Z"),
    });
    expect(inviteVerdict(morto, AGORA)).toBe("revogado");
  });
});

describe("janela da conferência", () => {
  it("vale logo após conferir e caduca depois da janela", () => {
    const conferidoAgora = new Date(AGORA.getTime() - 1000);
    const conferidoHaMuito = new Date(AGORA.getTime() - VERIFICATION_WINDOW_MS - 1000);

    expect(verificationIsFresh(conferidoAgora, AGORA)).toBe(true);
    expect(verificationIsFresh(conferidoHaMuito, AGORA)).toBe(false);
    expect(verificationIsFresh(null, AGORA)).toBe(false);
  });
});

describe("expiryFrom", () => {
  it("soma dias inteiros a partir do instante informado", () => {
    expect(expiryFrom(AGORA, 7).toISOString()).toBe("2026-09-28T12:00:00.000Z");
    expect(expiryFrom(AGORA, 1).toISOString()).toBe("2026-09-22T12:00:00.000Z");
  });
});

describe("protocolFor", () => {
  it("é estável para a mesma matrícula", () => {
    const id = "4f7a1b2c-0000-4000-8000-000000000000";

    expect(protocolFor(id, 2026)).toBe(protocolFor(id, 2026));
    expect(protocolFor(id, 2026)).toMatch(/^2026-[0-9A-F]{4}-[0-9A-F]{4}$/);
  });
});
