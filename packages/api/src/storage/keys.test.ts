import { describe, expect, it } from "vitest";

import { buildKey, entityPrefix, schoolPrefix, ulid, validateSegment } from "./keys";
import { StorageError, validateKey } from "./port";

describe("prefixo da escola", () => {
  it("termina em barra", () => {
    expect(schoolPrefix("abc")).toBe("escolas/abc/");
  });

  /**
   * A barra final é o que segura o isolamento entre duas escolas cujos ids
   * compartilham o começo. Sem ela, `escolas/abc` seria prefixo de
   * `escolas/abc2/...` e a segunda escola apareceria na listagem da primeira.
   */
  it("não é prefixo do id de outra escola que comece igual", () => {
    expect(`${schoolPrefix("abc2")}alunos/x`.startsWith(schoolPrefix("abc"))).toBe(false);
  });

  it("recusa id vazio", () => {
    expect(() => schoolPrefix("")).toThrow(StorageError);
  });
});

describe("montagem da chave", () => {
  it("monta escolas/{escola}/{domínio}/{entidade}/{ulid}", () => {
    const key = buildKey({
      schoolId: "escola1",
      domain: "alunos",
      entityId: "aluno1",
      suffix: "01JBQ8ZK3M4P5R6S7T8V9W0XYZ",
    });

    expect(key).toBe("escolas/escola1/alunos/aluno1/01JBQ8ZK3M4P5R6S7T8V9W0XYZ");
  });

  it("a chave montada é sempre uma chave válida", () => {
    const key = buildKey({ schoolId: "escola1", domain: "documentos", entityId: "doc1" });
    expect(() => validateKey(key)).not.toThrow();
  });

  it("o prefixo da entidade é prefixo da chave montada", () => {
    const key = buildKey({ schoolId: "e1", domain: "materiais", entityId: "m1" });
    expect(key.startsWith(entityPrefix("e1", "materiais", "m1"))).toBe(true);
  });

  it.each([
    ["barra no id", "aluno/1"],
    ["ponto-ponto", ".."],
    ["acento", "aluno-josé"],
    ["espaço", "aluno 1"],
    ["vazio", ""],
  ])("recusa %s no id da entidade", (_caso, entityId) => {
    expect(() => buildKey({ schoolId: "escola1", domain: "alunos", entityId })).toThrow(
      StorageError,
    );
  });

  it("recusa id de escola com barra — seria escapar para outra escola", () => {
    expect(() => validateSegment("escola1/../escola2", "schoolId")).toThrow(StorageError);
  });
});

describe("validação de chave", () => {
  it.each([
    "escolas/a/alunos/b/01JBQ",
    "escolas/a/documentos/b/arquivo-1.bin",
    "escolas/a/instituicao/b/logo_2026",
  ])("aceita %s", (key) => {
    expect(() => validateKey(key)).not.toThrow();
  });

  it.each([
    ["vazia", ""],
    ["com acento", "escolas/a/ação"],
    ["com espaço", "escolas/a/dois nomes"],
    ["barra dupla", "escolas/a//b"],
    ["ponto-ponto", "escolas/a/../b"],
    ["barra no fim", "escolas/a/b/"],
    ["barra no começo", "/escolas/a/b"],
    ["longa demais", `escolas/${"a".repeat(1100)}`],
  ])("recusa chave %s", (_caso, key) => {
    expect(() => validateKey(key)).toThrow(StorageError);
  });
});

describe("ulid", () => {
  it("tem 26 caracteres do alfabeto de Crockford", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  /** É o que faz `list` com prefixo devolver em ordem cronológica. */
  it("ordena por tempo como texto", () => {
    const before = ulid(new Date("2026-01-01T00:00:00Z"));
    const after = ulid(new Date("2026-06-01T00:00:00Z"));
    expect(before < after).toBe(true);
  });

  it("não repete em mil sorteios no mesmo milissegundo", () => {
    const now = new Date();
    const drawn = new Set(Array.from({ length: 1000 }, () => ulid(now)));
    expect(drawn.size).toBe(1000);
  });
});
