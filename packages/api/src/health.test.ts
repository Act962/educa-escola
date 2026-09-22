import { describe, expect, it, vi } from "vitest";

import { checkHealth } from "./health";

describe("checkHealth", () => {
  it("reporta ok quando o banco responde", async () => {
    const report = await checkHealth(async () => {});

    expect(report).toEqual({ status: "ok", checks: { database: "ok" } });
  });

  it("reporta indisponível quando o banco falha, sem vazar o erro", async () => {
    const log = vi.fn();
    const erro = new Error("connect ECONNREFUSED postgres://admin@db-interno:5432/integra");

    const report = await checkHealth(async () => {
      throw erro;
    }, log);

    expect(report).toEqual({ status: "indisponivel", checks: { database: "falhou" } });
    expect(JSON.stringify(report)).not.toContain("db-interno");
    // O detalhe não some: vai para o log, onde quem opera consegue ler.
    expect(log).toHaveBeenCalledWith(expect.any(String), erro);
  });
});
