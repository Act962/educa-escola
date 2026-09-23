import type { AppRole } from "@educa-escola/auth";

import { NotFoundError } from "../../errors";
import type { ProfileRepository } from "./repository";

/**
 * O vínculo desta pessoa com a escola, na forma que o papel dela tem.
 *
 * É união discriminada, e não um objeto com tudo nulo, porque a tela precisa
 * decidir *o que desenhar* e não *o que esconder*: "turmas: 0" no perfil de um
 * aluno é um campo que nunca deveria existir ali.
 */
export type Affiliation =
  | {
      tipo: "aluno";
      matricula: string | null;
      turma: string | null;
      turno: string | null;
      situation: string | null;
    }
  | { tipo: "professor"; classrooms: number; subjects: number; lessons: number }
  | { tipo: "gestao" };

export interface Profile {
  userId: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: AppRole;
  schoolId: string;
  schoolName: string;
  atSchoolSince: Date;
  contaCriadaEm: Date;
  affiliation: Affiliation;
}

export function createProfileService(repo: ProfileRepository) {
  return {
    /**
     * O perfil de quem está pedindo — e de mais ninguém.
     *
     * Não existe `byId` neste módulo de propósito. A ficha de um colega é dado
     * de pessoal e mora em `teacher`, atrás de `faculty: ["read"]`; expor um
     * "perfil de qualquer um" aqui seria abrir a mesma porta sem a mesma
     * fechadura.
     */
    async me(userId: string, role: AppRole, academicYear: number): Promise<Profile> {
      const identidade = await repo.identity(userId);
      if (!identidade) {
        throw new NotFoundError("Sua conta não tem vínculo ativo nesta escola.");
      }

      return {
        userId: identidade.userId,
        name: identidade.name,
        email: identidade.email,
        emailVerified: identidade.emailVerified,
        role,
        schoolId: identidade.schoolId,
        schoolName: identidade.schoolName,
        atSchoolSince: identidade.atSchoolSince,
        contaCriadaEm: identidade.contaCriadaEm,
        affiliation: await vinculoDe(repo, userId, role, academicYear),
      };
    },
  };
}

async function vinculoDe(
  repo: ProfileRepository,
  userId: string,
  role: AppRole,
  academicYear: number,
): Promise<Affiliation> {
  if (role === "student") {
    const ficha = await repo.studentBond(userId);
    return {
      tipo: "aluno",
      matricula: ficha?.registration ?? null,
      turma: ficha?.classroomName ?? null,
      turno: ficha?.shift ?? null,
      situation: ficha?.status ?? null,
    };
  }

  if (role === "teacher") {
    const carga = await repo.teacherBond(userId, academicYear);
    return {
      tipo: "professor",
      classrooms: carga.classrooms,
      subjects: carga.subjects,
      lessons: carga.lessons,
    };
  }

  return { tipo: "gestao" };
}

export type ProfileService = ReturnType<typeof createProfileService>;
