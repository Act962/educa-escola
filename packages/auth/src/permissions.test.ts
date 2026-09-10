import { describe, expect, it } from "vitest";

import { APP_ROLES, roles } from "./permissions";

const can = (
  role: keyof typeof roles,
  request: Parameters<(typeof roles)["owner"]["authorize"]>[0],
) => roles[role].authorize(request).success;

describe("papéis da escola", () => {
  it("expõe exatamente os quatro papéis do produto", () => {
    expect([...APP_ROLES].sort()).toEqual(["admin", "owner", "student", "teacher"]);
  });

  it("só o owner pode excluir a escola", () => {
    expect(can("owner", { organization: ["delete"] })).toBe(true);
    expect(can("admin", { organization: ["delete"] })).toBe(false);
    expect(can("teacher", { organization: ["delete"] })).toBe(false);
    expect(can("student", { organization: ["delete"] })).toBe(false);
  });

  it("administrativo opera turmas e convites", () => {
    expect(can("admin", { classroom: ["create", "update", "delete"] })).toBe(true);
    expect(can("admin", { invitation: ["create"] })).toBe(true);
    expect(can("admin", { organization: ["update"] })).toBe(true);
  });

  it("professor lê turmas mas não administra", () => {
    expect(can("teacher", { classroom: ["read"] })).toBe(true);
    expect(can("teacher", { enrollment: ["read"] })).toBe(true);
    expect(can("teacher", { classroom: ["create"] })).toBe(false);
    expect(can("teacher", { member: ["create"] })).toBe(false);
    expect(can("teacher", { invitation: ["create"] })).toBe(false);
  });

  it("estudante só lê a própria turma", () => {
    expect(can("student", { classroom: ["read"] })).toBe(true);
    expect(can("student", { classroom: ["update"] })).toBe(false);
    expect(can("student", { enrollment: ["read"] })).toBe(false);
    expect(can("student", { member: ["create"] })).toBe(false);
  });

  it("professor registra chamada e nota, mas não cadastra aluno", () => {
    expect(can("teacher", { attendance: ["create", "update"] })).toBe(true);
    expect(can("teacher", { grade: ["create", "update"] })).toBe(true);
    expect(can("teacher", { assessment: ["publish"] })).toBe(true);
    expect(can("teacher", { student: ["read"] })).toBe(true);
    expect(can("teacher", { student: ["create"] })).toBe(false);
    expect(can("teacher", { student: ["delete"] })).toBe(false);
  });

  /**
   * O aluno é o papel em que um deslize custa caro: qualquer escrita aqui
   * significaria alguém alterando a própria nota ou a própria frequência.
   */
  it("estudante só lê, e nunca publica nem escreve", () => {
    expect(can("student", { grade: ["read"] })).toBe(true);
    expect(can("student", { assessment: ["read"] })).toBe(true);
    expect(can("student", { attendance: ["read"] })).toBe(true);

    expect(can("student", { grade: ["create"] })).toBe(false);
    expect(can("student", { grade: ["update"] })).toBe(false);
    expect(can("student", { attendance: ["create"] })).toBe(false);
    expect(can("student", { assessment: ["publish"] })).toBe(false);
    expect(can("student", { lesson: ["update"] })).toBe(false);
  });

  it("só direção e secretaria cadastram aluno", () => {
    for (const role of APP_ROLES) {
      const expected = role === "owner" || role === "admin";
      expect(can(role, { student: ["create"] })).toBe(expected);
      expect(can(role, { student: ["delete"] })).toBe(expected);
    }
  });

  it("nenhum papel além do owner/admin escreve matrícula", () => {
    for (const role of APP_ROLES) {
      const expected = role === "owner" || role === "admin";
      expect(can(role, { enrollment: ["create"] })).toBe(expected);
    }
  });
});
