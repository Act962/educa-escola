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
  /**
   * Pontuação. `apurar` é escrita em massa: reprocessa o ano inteiro da
   * escola, então fica com quem responde pela escola, não com quem dá aula.
   */
  score: ["read", "apurar"],
  /**
   * Placar nominal. Fora de `fullAcademicAccess` de propósito: ver quem está
   * em que posição é decisão da direção, e `read_cross_school` é a porta que
   * a PR do placar entre escolas vai usar — nenhum papel a tem ainda.
   */
  ranking: ["read", "read_cross_school", "opt_in"],
  /**
   * Corpo docente. Recurso próprio, e não `student`, porque é dado de pessoal:
   * quem enxerga a ficha de um aluno não enxerga por isso a de um colega de
   * trabalho, com pendências e carga horária.
   */
  faculty: ["read", "manage"],
  /**
   * Calendário. `read` para todos: é o que diz quando tem aula, e esconder
   * isso de aluno ou professor não protege nada. Quem monta é a gestão.
   */
  calendar: ["read", "manage"],
  /**
   * Comunicados. `read` é o mural — todo papel recebe. `manage` é escrever
   * para a escola inteira, e isso é da gestão: um comunicado institucional
   * não se desfaz depois de lido (§8.3).
   */
  communication: ["read", "manage"],
  /**
   * Programa de indicações. `manage` é desenhar a regra de desconto, que é
   * decisão comercial da direção; `read` é ver quem indicou quem, que é lista
   * nominal de família. Quem divulga o próprio link não precisa de nenhum dos
   * dois — a tela dele resolve por identidade, como "Meu perfil".
   */
  referral: ["read", "manage"],
  /**
   * O Astro. `manage` é a credencial do modelo, que é chave de gasto — quem
   * assina é quem responde pela escola. Não existe ação de "usar": quem pode
   * perguntar é decidido pela configuração da própria escola, não pelo RBAC,
   * porque a escola precisa poder abrir para o aluno sem mexer em papel.
   */
  assistant: ["manage"],
  /**
   * Portaria. `operate` é deixar o quiosque aberto no tablet e registrar
   * passagem; `enroll_face` é cadastrar o molde biométrico do aluno.
   *
   * São ações separadas porque têm pesos diferentes: operar a portaria é rotina
   * de recepção, cadastrar biometria de menor é ato que exige consentimento
   * conferido e não se desfaz sozinho. `read` é a lista de quem entrou — o
   * professor a enxerga, porque é ela que responde "o aluno chegou?" na aula.
   */
  gate: ["read", "operate", "enroll_face", "delete_entry"],
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
  score: ["read", "apurar"],
  faculty: ["read", "manage"],
  calendar: ["read", "manage"],
  communication: ["read", "manage"],
  referral: ["read", "manage"],
} as const;

/** Diretor(a) / mantenedor(a) da escola. Único papel que pode excluir a escola. */
export const owner = ac.newRole({
  ...ownerAc.statements,
  ...fullAcademicAccess,
  // Só a direção instala: instalar app gera custo em Stars na conta da escola.
  app: ["read", "install", "remove"],
  // Sem `read_cross_school`: ler dado de outra escola é a única coisa que a
  // arquitetura inteira existe para impedir, e entra na PR do placar entre
  // escolas — com o aval do João, não por herança de papel.
  ranking: ["read", "opt_in"],
  assistant: ["manage"],
  gate: ["read", "operate", "enroll_face", "delete_entry"],
});

/** Secretaria / administrativo: opera a escola inteira, menos excluí-la. */
export const admin = ac.newRole({
  ...adminAc.statements,
  ...fullAcademicAccess,
  app: ["read"],
  /** Secretaria enxerga o placar; aderir a placar externo é da direção. */
  ranking: ["read"],
  /** A secretaria configura o Astro; ela é quem opera o dia a dia da escola. */
  assistant: ["manage"],
  /** A recepção é a secretaria: ela abre o quiosque e cadastra o molde. */
  gate: ["read", "operate", "enroll_face", "delete_entry"],
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
  /** Vê os próprios pontos; não reprocessa o ano da escola. */
  score: ["read"],
  ranking: [],
  /** Lê o calendário da escola; quem o monta é a gestão. */
  calendar: ["read"],
  /** Recebe comunicados; escrever para a escola é da gestão. */
  communication: ["read"],
  /** Professor não entra no programa: ele não tem mensalidade para descontar. */
  referral: [],
  /** Usa o Astro se a escola liberar; a credencial é da direção. */
  assistant: [],
  /**
   * Lê quem entrou, e só. É o que responde "o aluno chegou?" antes da chamada
   * — mas quem marca presença continua sendo ele, olhando a sala.
   */
  gate: ["read"],
  /**
   * Vazio: a lista de docentes carrega pendência de colega, que é dado de
   * pessoal. O professor vê o que ele mesmo deve no próprio painel.
   */
  faculty: [],
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
  /**
   * Vê os próprios pontos. `ranking: []` é a tradução do §7.5 em permissão:
   * aluno não vê classificação nominal de colega. A tela dele devolve posição
   * e total, e quem garante isso é a forma do retorno em `score/service.ts`.
   */
  score: ["read"],
  ranking: [],
  faculty: [],
  calendar: ["read"],
  communication: ["read"],
  /**
   * Vazio, e mesmo assim o aluno vê o próprio link.
   *
   * `referral: read` é a lista de quem indicou quem — nome de família e de
   * quem se matriculou. A tela do aluno não passa por ela: resolve por
   * identidade, como "Meu perfil", e devolve só o que é dele.
   */
  referral: [],
  assistant: [],
  /**
   * Vazio: a lista de quem entrou na escola hoje é frequência nominal de
   * colega. O aluno não precisa dela, e a portaria não é tela dele.
   */
  gate: [],
});

export const roles = { owner, admin, teacher, student };

export type AppRole = keyof typeof roles;

export const APP_ROLES = Object.keys(roles) as [AppRole, ...AppRole[]];
