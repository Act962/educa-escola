import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { Context } from "./context";
import { ConflictError, NotFoundError, ValidationError, violaUnico } from "./errors";
import { publicProcedure, router, t } from "./index";

const testRouter = router({
  conflito: publicProcedure.query(() => {
    throw new ConflictError("já existe");
  }),
  ausente: publicProcedure.query(() => {
    throw new NotFoundError("não encontrado");
  }),
  invalido: publicProcedure.query(() => {
    throw new ValidationError("entrada ruim");
  }),
  inesperado: publicProcedure.query(() => {
    throw new Error("estourou");
  }),
});

const caller = t.createCallerFactory(testRouter)({} as Context);

async function codeOf(run: Promise<unknown>): Promise<string> {
  try {
    await run;
    throw new Error("esperava um erro, mas a chamada teve sucesso");
  } catch (error) {
    return error instanceof TRPCError ? error.code : "NAO_E_TRPC_ERROR";
  }
}

/**
 * Sem essa tradução um ConflictError sai como 500, e o cliente não consegue
 * distinguir "você tentou duplicar" de "o servidor quebrou".
 */
describe("erros de domínio viram código tRPC", () => {
  it("ConflictError -> CONFLICT", async () => {
    expect(await codeOf(caller.conflito())).toBe("CONFLICT");
  });

  it("NotFoundError -> NOT_FOUND", async () => {
    expect(await codeOf(caller.ausente())).toBe("NOT_FOUND");
  });

  it("ValidationError -> BAD_REQUEST", async () => {
    expect(await codeOf(caller.invalido())).toBe("BAD_REQUEST");
  });

  it("erro inesperado continua sendo INTERNAL_SERVER_ERROR", async () => {
    expect(await codeOf(caller.inesperado())).toBe("INTERNAL_SERVER_ERROR");
  });

  it("preserva a mensagem do domínio", async () => {
    await expect(caller.conflito()).rejects.toThrow("já existe");
  });
});

describe("violaUnico", () => {
  /**
   * O Drizzle embrulha o erro do Postgres: a mensagem de fora é "Failed
   * query: …" e o nome da constraint só existe no `cause`. Procurar na
   * mensagem compila, parece certo e nunca casa.
   */
  it("acha a constraint na causa, não na mensagem", () => {
    const doPostgres = Object.assign(new Error("duplicate key value"), {
      code: "23505",
      constraint: "referral_conversion_enrollment_uidx",
    });
    const doDrizzle = new Error("Failed query: insert into …", { cause: doPostgres });

    expect(violaUnico(doDrizzle, "referral_conversion_enrollment_uidx")).toBe(true);
    expect(violaUnico(doDrizzle, "outro_uidx")).toBe(false);
  });

  it("não confunde outro erro do banco com violação de único", () => {
    const naoNulo = Object.assign(new Error("null value"), {
      code: "23502",
      constraint: "referral_conversion_enrollment_uidx",
    });

    expect(
      violaUnico(new Error("x", { cause: naoNulo }), "referral_conversion_enrollment_uidx"),
    ).toBe(false);
  });

  it("aguenta erro sem causa, nulo e cadeia circular", () => {
    expect(violaUnico(new Error("solto"), "qualquer")).toBe(false);
    expect(violaUnico(null, "qualquer")).toBe(false);

    const circular: { cause?: unknown } = {};
    circular.cause = circular;
    expect(violaUnico(circular, "qualquer")).toBe(false);
  });
});
