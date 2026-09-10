import { createAccessControl } from "better-auth/plugins/access";
import { adminAc, defaultStatements, ownerAc } from "better-auth/plugins/organization/access";

/**
 * Recursos e ações do sistema.
 *
 * `defaultStatements` traz o que o plugin organization já controla
 * (organization, member, invitation, team, ac). Só acrescentamos recursos
 * de domínio aqui — um recurso que não existe neste objeto é rejeitado
 * em tempo de compilação ao montar um papel.
 *
 * O RBAC responde "este papel pode ler notas?", não "quais notas". O recorte
 * de escopo (as turmas deste professor, o boletim deste aluno) é regra de
 * negócio e vive no service — permissão grossa aqui, filtro fino lá.
 */
export const statement = {
  ...defaultStatements,
  classroom: ["create", "read", "update", "delete"],
  enrollment: ["create", "read", "update", "delete"],
  student: ["create", "read", "update", "delete"],
  lesson: ["create", "read", "update", "delete"],
  attendance: ["create", "read", "update"],
  assessment: ["create", "read", "update", "delete", "publish"],
  grade: ["create", "read", "update"],
} as const;

export const ac = createAccessControl(statement);

const fullAcademicAccess = {
  classroom: ["create", "read", "update", "delete"],
  enrollment: ["create", "read", "update", "delete"],
  student: ["create", "read", "update", "delete"],
  lesson: ["create", "read", "update", "delete"],
  attendance: ["create", "read", "update"],
  assessment: ["create", "read", "update", "delete", "publish"],
  grade: ["create", "read", "update"],
} as const;

/** Diretor(a) / mantenedor(a) da escola. Único papel que pode excluir a escola. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  ...fullAcademicAccess,
});

/** Secretaria / administrativo: opera a escola inteira, menos excluí-la. */
export const admin = ac.newRole({
  ...adminAc.statements,
  ...fullAcademicAccess,
});

/**
 * Professor(a): registra chamada e nota das próprias turmas, não administra a
 * escola. Não publica nem apaga aluno — o cadastro é da secretaria.
 */
export const teacher = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: ["read"],
  classroom: ["read"],
  enrollment: ["read"],
  student: ["read"],
  lesson: ["read", "update"],
  attendance: ["create", "read", "update"],
  assessment: ["create", "read", "update", "delete", "publish"],
  grade: ["create", "read", "update"],
});

/**
 * Estudante: só leitura, e só do que é seu — o service filtra pelo vínculo.
 * Sem `assessment: publish` e sem escrita em lugar nenhum.
 */
export const student = ac.newRole({
  organization: [],
  member: [],
  invitation: [],
  team: [],
  ac: [],
  classroom: ["read"],
  enrollment: [],
  student: ["read"],
  lesson: ["read"],
  attendance: ["read"],
  assessment: ["read"],
  grade: ["read"],
});

export const roles = { owner, admin, teacher, student };

export type AppRole = keyof typeof roles;

export const APP_ROLES = Object.keys(roles) as [AppRole, ...AppRole[]];
