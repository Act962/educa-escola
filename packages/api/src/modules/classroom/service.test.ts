import type { classroom } from "@educa-escola/db/schema";
import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError } from "../../errors";
import type { ClassroomRepository, CreateClassroomData } from "./repository";
import { createClassroomService, normalizeClassroomName } from "./service";

type Row = typeof classroom.$inferSelect;

/**
 * Repositório em memória: a regra de negócio é testada sem banco.
 *
 * Tipado como `ClassroomRepository` de propósito (sem cast): se a interface do
 * repositório real mudar, este duplo para de compilar em vez de mentir.
 */
function fakeRepository(seed: Row[] = []): ClassroomRepository {
  const rows: Row[] = [...seed];

  const row = (data: CreateClassroomData): Row => ({
    id: crypto.randomUUID(),
    schoolId: "escola-1",
    name: data.name,
    academicYear: data.academicYear,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  return {
    list: async () => rows,

    findById: async (id) => rows.find((r) => r.id === id) ?? null,

    findByNameAndYear: async (name, year) =>
      rows.find((r) => r.name === name && r.academicYear === year) ?? null,

    create: async (data) => {
      const created = row(data);
      rows.push(created);
      return created;
    },

    rename: async (id, name) => {
      const found = rows.find((r) => r.id === id);
      if (!found) return null;
      found.name = name;
      return found;
    },

    remove: async (id) => {
      const index = rows.findIndex((r) => r.id === id);
      if (index < 0) return null;
      const [removed] = rows.splice(index, 1);
      return removed ? { id: removed.id } : null;
    },
  };
}

describe("normalizeClassroomName", () => {
  it("apara e colapsa espaços internos", () => {
    expect(normalizeClassroomName("  3º  ano   B ")).toBe("3º ano B");
  });
});

describe("createClassroomService", () => {
  it("normaliza o nome ao criar", async () => {
    const service = createClassroomService(fakeRepository());
    const created = await service.create({ name: "  3º  ano B ", academicYear: 2026 });
    expect(created.name).toBe("3º ano B");
  });

  it("recusa turma duplicada no mesmo ano letivo", async () => {
    const service = createClassroomService(fakeRepository());
    await service.create({ name: "3º ano B", academicYear: 2026 });

    await expect(service.create({ name: "3º  ano  B", academicYear: 2026 })).rejects.toBeInstanceOf(
      ConflictError,
    );
  });

  it("permite o mesmo nome em anos letivos diferentes", async () => {
    const service = createClassroomService(fakeRepository());
    await service.create({ name: "3º ano B", academicYear: 2026 });

    await expect(service.create({ name: "3º ano B", academicYear: 2027 })).resolves.toMatchObject({
      academicYear: 2027,
    });
  });

  it("renomear para o mesmo nome é no-op e não acusa conflito", async () => {
    const service = createClassroomService(fakeRepository());
    const created = await service.create({ name: "3º ano B", academicYear: 2026 });

    await expect(service.rename(created.id, " 3º ano  B ")).resolves.toMatchObject({
      id: created.id,
      name: "3º ano B",
    });
  });

  it("recusa renomear para um nome já usado no mesmo ano", async () => {
    const service = createClassroomService(fakeRepository());
    await service.create({ name: "3º ano A", academicYear: 2026 });
    const b = await service.create({ name: "3º ano B", academicYear: 2026 });

    await expect(service.rename(b.id, "3º ano A")).rejects.toBeInstanceOf(ConflictError);
  });

  it("sinaliza turma inexistente", async () => {
    const service = createClassroomService(fakeRepository());

    await expect(service.get("nao-existe")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.rename("nao-existe", "X")).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.remove("nao-existe")).rejects.toBeInstanceOf(NotFoundError);
  });
});
