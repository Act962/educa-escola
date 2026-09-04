import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Recursos e ações do sistema.
 *
 * `defaultStatements` traz o que o plugin organization já controla
 * (organization, member, invitation, team, ac). Só acrescentamos recursos
 * de domínio aqui — um recurso que não existe neste objeto é rejeitado
 * em tempo de compilação ao montar um papel.
 */
export const statement = {
  ...defaultStatements,
  classroom: ["create", "read", "update", "delete"],
  enrollment: ["create", "read", "update", "delete"],
} as const;

export const ac = createAccessControl(statement);

/** Diretor(a) / mantenedor(a) da escola. Único papel que pode excluir a escola. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  classroom: ["create", "read", "update", "delete"],
  enrollment: ["create", "read", "update", "delete"],
});

/** Secretaria / administrativo: opera a escola inteira, menos excluí-la. */
export const admin = ac.newRole({
  ...adminAc.statements,
  classroom: ["create", "read", "update", "delete"],
  enrollment: ["create", "read", "update", "delete"],
});

/** Professor(a): enxerga turmas e matrículas, não administra a escola. */
export const teacher = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
  classroom: ["read"],
  enrollment: ["read"],
});

/** Estudante: apenas leitura da própria turma. */
export const student = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  classroom: ["read"],
  enrollment: [],
});

export const roles = { owner, admin, teacher, student };

export type AppRole = keyof typeof roles;

export const APP_ROLES = Object.keys(roles) as [AppRole, ...AppRole[]];
