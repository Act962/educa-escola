import { TRPCError } from "@trpc/server";
import { describe, expect, it } from "vitest";

import type { Context } from "./context";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
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
