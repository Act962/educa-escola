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
  /**
   * Apps do ecossistema Órbita, mostrados por dentro do Integra.
   *
   * `install` é separado de `read` de propósito: instalar é contratar — cria a
   * organização no Órbita e debita Stars da escola. Quem abre não é quem
   * assina.
   */
  app: ["read", "install", "remove"],
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
  // Só a direção instala: instalar app gera custo em Stars na conta da escola.
  app: ["read", "install", "remove"],
});

/** Secretaria / administrativo: opera a escola inteira, menos excluí-la. */
export const admin = ac.newRole({
  ...adminAc.statements,
  ...fullAcademicAccess,
  app: ["read"],
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
  app: ["read"],
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
  app: [],
});

export const roles = { owner, admin, teacher, student };

export type AppRole = keyof typeof roles;

export const APP_ROLES = Object.keys(roles) as [AppRole, ...AppRole[]];
