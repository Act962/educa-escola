import { describe, expect, it } from "vitest";

import { NotFoundError } from "../../errors";
import type { ProfileRepository } from "./repository";
import { createProfileService } from "./service";

const IDENTIDADE = {
  userId: "u1",
  name: "Marina Duarte",
  email: "marina@escola.br",
  emailVerified: true,
  contaCriadaEm: new Date("2026-01-10T12:00:00Z"),
  role: "owner",
  naEscolaDesde: new Date("2026-02-01T12:00:00Z"),
  schoolId: "e1",
  schoolName: "Dom Pedro II",
};

function repositorioFalso(overrides: Partial<ProfileRepository> = {}): ProfileRepository {
  return {
    identity: async () => IDENTIDADE,
    studentBond: async () => null,
    teacherBond: async () => ({ turmas: 0, disciplinas: 0, aulas: 0 }),
    ...overrides,
  };
}

describe("createProfileService", () => {
  it("recusa quem não tem vínculo nesta escola", async () => {
    const service = createProfileService(repositorioFalso({ identity: async () => null }));

    await expect(service.me("u1", "owner", 2026)).rejects.toBeInstanceOf(NotFoundError);
  });

  /**
   * O papel vem do contexto da requisição, não da coluna lida.
   *
   * São dois caminhos até o mesmo dado: `member.role` no banco e o papel já
   * resolvido na sessão. Se divergirem, quem manda é a sessão — é ela que o
   * `permitted()` usa para autorizar, e mostrar na tela um papel diferente do
   * que o servidor aplica é a forma mais rápida de alguém confiar no errado.
   */
  it("mostra o papel do contexto, mesmo que o vínculo no banco diga outro", async () => {
    const service = createProfileService(
      repositorioFalso({ identity: async () => ({ ...IDENTIDADE, role: "student" }) }),
    );

    const perfil = await service.me("u1", "owner", 2026);

    expect(perfil.role).toBe("owner");
  });

  it("dá ao aluno matrícula e turma, e nada de carga docente", async () => {
    const service = createProfileService(
      repositorioFalso({
        studentBond: async () => ({
          studentId: "a1",
          registration: "2026-0042",
          status: "ativo",
          shift: "manha",
          classroomId: "t1",
          classroomName: "9º C",
        }),
      }),
    );

    const perfil = await service.me("u1", "student", 2026);

    expect(perfil.vinculo).toEqual({
      tipo: "aluno",
      matricula: "2026-0042",
      turma: "9º C",
      turno: "manha",
      situacao: "ativo",
    });
  });

  /**
   * Aluno sem ficha ligada à conta não é erro: o cadastro escolar vem antes do
   * acesso. A tela precisa desenhar a identificação e dizer "sem turma", em
   * vez de quebrar ou de inventar uma.
   */
  it("aceita aluno sem ficha ligada à conta", async () => {
    const service = createProfileService(repositorioFalso());

    const perfil = await service.me("u1", "student", 2026);

    expect(perfil.vinculo).toEqual({
      tipo: "aluno",
      matricula: null,
      turma: null,
      turno: null,
      situacao: null,
    });
  });

  it("dá ao professor a carga do ano pedido", async () => {
    const chamadas: number[] = [];
    const service = createProfileService(
      repositorioFalso({
        teacherBond: async (_userId, ano) => {
          chamadas.push(ano);
          return { turmas: 4, disciplinas: 2, aulas: 160 };
        },
      }),
    );

    const perfil = await service.me("u1", "teacher", 2025);

    expect(chamadas).toEqual([2025]);
    expect(perfil.vinculo).toEqual({ tipo: "professor", turmas: 4, disciplinas: 2, aulas: 160 });
  });

  /** Direção e secretaria não têm ficha de aluno nem carga: o vínculo é o papel. */
  it("não consulta ficha de aluno nem carga docente para a gestão", async () => {
    let consultou = false;
    const service = createProfileService(
      repositorioFalso({
        studentBond: async () => {
          consultou = true;
          return null;
        },
        teacherBond: async () => {
          consultou = true;
          return { turmas: 0, disciplinas: 0, aulas: 0 };
        },
      }),
    );

    const perfil = await service.me("u1", "admin", 2026);

    expect(consultou).toBe(false);
    expect(perfil.vinculo).toEqual({ tipo: "gestao" });
  });
});
