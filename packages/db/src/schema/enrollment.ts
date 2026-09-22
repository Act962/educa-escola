import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { student } from "./academic";
import { user } from "./auth";
import { classroom, school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/**
 * Ciclo de vida da matrícula, conforme a §25.2 do requisito.
 *
 * Não confundir com `student_status`, que é a projeção do aluno para a chamada
 * e a grade de notas. Aqui mora o vínculo datado; lá, o estado corrente.
 */
export const enrollmentStatus = pgEnum("enrollment_status", [
  "pendente",
  "ativa",
  "suspensa",
  "cancelada",
  "transferida",
  "concluida",
]);

/** Rematrícula carrega a ficha do ano anterior; matrícula começa em branco. */
export const enrollmentKind = pgEnum("enrollment_kind", ["matricula", "rematricula"]);

export const guardianRelationship = pgEnum("guardian_relationship", [
  "mae",
  "pai",
  "avo",
  "responsavel_legal",
  "outro",
]);

/**
 * O que aconteceu com a matrícula, em ordem.
 *
 * É a trilha que a §20.2 exige para criar, alterar e cancelar matrícula. Os
 * eventos de link cobrem o que hoje é envio manual e amanhã será WhatsApp.
 */
export const enrollmentEventType = pgEnum("enrollment_event_type", [
  "criada",
  "editada",
  "link_gerado",
  "link_enviado",
  "link_revogado",
  "conferencia_ok",
  "conferencia_falha",
  "ficha_enviada",
  "confirmada",
  "cancelada",
  "renovada",
  "expirada",
  "foto_cadastrada",
  "foto_revogada",
  /** Cada abertura da foto fica registrada (§13.3). */
  "foto_aberta",
  /** A escola pediu à família a autorização da identificação facial. */
  "autorizacao_solicitada",
  /** A família respondeu — autorizando ou recusando. Os dois são resposta. */
  "consentimento_atualizado",
]);

/** Quem agiu. `responsavel` é anônimo: não tem conta, só o token. */
export const enrollmentActor = pgEnum("enrollment_actor", ["gestao", "responsavel", "sistema"]);

/**
 * Para que serve o convite.
 *
 * `ficha` é o link de confirmação da matrícula, com todo o formulário.
 * `biometria` é o link curto que pergunta uma coisa só: a família autoriza a
 * identificação facial? Existe porque o consentimento de biometria só era
 * capturado dentro da ficha, e a ficha só existe enquanto a matrícula está
 * pendente — depois de confirmada não havia caminho nenhum para autorizar, e
 * família decide depois o tempo todo.
 *
 * Reabrir a ficha inteira para marcar uma caixa seria pior: cada
 * reconfirmação é uma chance de sobrescrever dado certo por dado velho.
 */
/**
 * Por onde o consentimento chegou.
 *
 * `link` é a família respondendo ela mesma, com a posse do token e a
 * conferência da data de nascimento. `presencial` é a secretaria registrando
 * que o responsável declarou no balcão — e a distinção precisa estar gravada,
 * porque as duas têm força probatória diferente. Uma conferência que não
 * consiga separá-las não consegue auditar nada.
 */
export const consentOrigin = pgEnum("consent_origin", ["link", "presencial"]);

export const enrollmentInvitePurpose = pgEnum("enrollment_invite_purpose", ["ficha", "biometria"]);

/**
 * Finalidade do consentimento, para registrar a base legal separadamente.
 *
 * `termos_matricula` é execução de contrato; os outros dois são consentimento
 * do responsável, porque o titular é menor (LGPD, art. 14).
 */
export const consentPurpose = pgEnum("consent_purpose", [
  "termos_matricula",
  "uso_imagem",
  "comunicacao",
  /**
   * Autorização para identificação facial na catraca.
   *
   * Separada de `uso_imagem` de propósito: autorizar foto no mural da escola
   * não é autorizar reconhecimento facial na entrada. Consentimento genérico
   * demais não é consentimento.
   */
  "biometria",
]);

export const enrollment = pgTable(
  "enrollment",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    academicYear: integer("academic_year").notNull(),
    /** Turma pretendida enquanto pendente; efetiva depois de confirmada. */
    classroomId: text("classroom_id").references(() => classroom.id, { onDelete: "set null" }),
    shift: text("shift").default("manha").notNull(),
    status: enrollmentStatus("status").default("pendente").notNull(),
    kind: enrollmentKind("kind").default("matricula").notNull(),
    /** Encadeia a renovação com a matrícula de origem (RN-048). */
    previousEnrollmentId: text("previous_enrollment_id"),
    /** Prazo da pré-matrícula. Vencido sem confirmação, expira (RN-043). */
    expiresAt: timestamp("expires_at"),
    confirmedAt: timestamp("confirmed_at"),
    /** Data civil a partir da qual o cancelamento vale (RN-044). */
    effectiveOn: date("effective_on", { mode: "string" }),
    cancelReason: text("cancel_reason"),
    cancelledOn: date("cancelled_on", { mode: "string" }),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUserId: text("updated_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("enrollment_school_year_idx").on(table.schoolId, table.academicYear),
    index("enrollment_student_idx").on(table.studentId),
    index("enrollment_school_status_idx").on(table.schoolId, table.status),
    /**
     * RN-040: um aluno não tem duas matrículas principais ativas no mesmo ano.
     *
     * Índice **parcial** de propósito. Cancelar e rematricular no mesmo ano é
     * rotina, então pendentes e canceladas precisam coexistir; só `ativa` é
     * exclusiva. O service checa antes para dar mensagem boa — isto aqui é a
     * rede, para o caso de duas confirmações simultâneas.
     */
    uniqueIndex("enrollment_student_year_active_uidx")
      .on(table.schoolId, table.studentId, table.academicYear)
      .where(sql`status = 'ativa'`),
  ],
);

/**
 * Responsável pelo aluno naquela matrícula (RN-050).
 *
 * Pende do vínculo e não do aluno porque muda de um ano para o outro, e porque
 * é o vínculo que carrega o telefone para onde o link vai. Minimização da
 * §24.4: sem CPF, sem RG e sem endereço — nada que a confirmação não exija.
 */
export const enrollmentGuardian = pgTable(
  "enrollment_guardian",
  {
    id: id(),
    schoolId: schoolId(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    relationship: guardianRelationship("relationship").default("responsavel_legal").notNull(),
    /** E.164, que é o formato que a API de mensagem aceita. */
    phoneE164: text("phone_e164").notNull(),
    email: text("email"),
    isLegal: boolean("is_legal").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("enrollment_guardian_enrollment_idx").on(table.enrollmentId),
    index("enrollment_guardian_school_phone_idx").on(table.schoolId, table.phoneE164),
  ],
);

/**
 * O convite que vira link público.
 *
 * Guarda só o hash do token: um dump do banco não produz um link funcionando.
 * `attempts` e `lockedAt` são a defesa contra quem tenta adivinhar a data de
 * nascimento; `consumedAt` garante uso único; `revokedAt` mata o link antigo
 * quando a secretaria reemite.
 */
export const enrollmentInvite = pgTable(
  "enrollment_invite",
  {
    id: id(),
    schoolId: schoolId(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    purpose: enrollmentInvitePurpose("purpose").default("ficha").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    verifiedAt: timestamp("verified_at"),
    consumedAt: timestamp("consumed_at"),
    revokedAt: timestamp("revoked_at"),
    attempts: integer("attempts").default(0).notNull(),
    lastAttemptAt: timestamp("last_attempt_at"),
    lockedAt: timestamp("locked_at"),
    recipientPhone: text("recipient_phone").notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /**
     * Único **global**, não por escola.
     *
     * É a chave de busca do fluxo público, onde ainda não se sabe de que escola
     * é a requisição. Um token que casasse em duas escolas seria falha de
     * isolamento, não conveniência.
     */
    uniqueIndex("enrollment_invite_token_hash_uidx").on(table.tokenHash),
    index("enrollment_invite_enrollment_idx").on(table.enrollmentId),
    index("enrollment_invite_school_idx").on(table.schoolId),
    index("enrollment_invite_expires_idx").on(table.expiresAt),
  ],
);

/**
 * Consentimento registrado (§24.4): versionado, datado e revogável.
 *
 * Append-only — revogar é gravar `revokedAt`, nunca apagar a linha, senão não
 * sobra prova de que houve consentimento no passado. `ipHash` em vez de IP:
 * dá para demonstrar "veio do mesmo aparelho" sem guardar endereço de rede.
 */
export const enrollmentConsent = pgTable(
  "enrollment_consent",
  {
    id: id(),
    schoolId: schoolId(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    purpose: consentPurpose("purpose").notNull(),
    termVersion: text("term_version").notNull(),
    granted: boolean("granted").notNull(),
    grantedAt: timestamp("granted_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
    /** Nome digitado por quem aceitou, que nem sempre é o do cadastro. */
    actorName: text("actor_name").notNull(),
    /**
     * Qual convite trouxe este aceite.
     *
     * Sem isso, dois aceites de biometria da mesma matrícula — o da ficha e o
     * do link curto — ficam indistinguíveis numa conferência. A coluna diz
     * qual ato gerou qual linha.
     */
    inviteId: text("invite_id").references(() => enrollmentInvite.id, { onDelete: "set null" }),
    origin: consentOrigin("origin").default("link").notNull(),
    /**
     * Quem **na escola** registrou, quando a origem é presencial.
     *
     * `actorName` é quem declarou — a mãe, o pai. Esta coluna é a outra
     * metade: a pessoa da secretaria que digitou. Sem as duas, "a escola
     * marcou sozinha" e "a mãe declarou no balcão" ficam idênticos no banco.
     */
    registeredByUserId: text("registered_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("enrollment_consent_enrollment_idx").on(table.enrollmentId, table.purpose)],
);

/**
 * Histórico da matrícula, append-only.
 *
 * O repositório expõe só `append` e `listByEnrollment` — não há update nem
 * delete. É por isso que não existe tabela de submissão: a correção feita pelo
 * responsável é um evento `ficha_enviada`, com campo, valor anterior e novo no
 * payload. `conferencia_falha` guarda o contador, nunca a data digitada.
 */
export const enrollmentEvent = pgTable(
  "enrollment_event",
  {
    id: id(),
    schoolId: schoolId(),
    enrollmentId: text("enrollment_id")
      .notNull()
      .references(() => enrollment.id, { onDelete: "cascade" }),
    type: enrollmentEventType("type").notNull(),
    actor: enrollmentActor("actor").notNull(),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    index("enrollment_event_enrollment_idx").on(
      table.schoolId,
      table.enrollmentId,
      table.occurredAt,
    ),
  ],
);

/**
 * Foto do aluno, cifrada na aplicação.
 *
 * `bytea` cifrado com AES-256-GCM e chave que vive no ambiente, não no banco.
 * O motivo é concreto: a ameaça realista não é invadirem o datacenter — é a
 * `DATABASE_URL` vazar. Cifragem do provedor não protege contra isso; esta
 * protege, porque um dump sem a chave é ruído.
 *
 * O molde facial **não** mora aqui: ele é proprietário do algoritmo que o
 * gerou, não é portátil entre fornecedores, e fica no equipamento. A foto é o
 * que permite recadastrar em outro fornecedor sem trazer criança de volta.
 */
export const studentPhoto = pgTable(
  "student_photo",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    /** Texto cifrado; sozinho não abre. */
    cipher: text("cipher").notNull(),
    /** Vetor de inicialização, único por foto. Reusar IV quebra o GCM. */
    iv: text("iv").notNull(),
    /** Etiqueta de autenticação: detecta adulteração do texto cifrado. */
    authTag: text("auth_tag").notNull(),
    contentType: text("content_type").default("image/jpeg").notNull(),
    capturedAt: timestamp("captured_at").defaultNow().notNull(),
    capturedByUserId: text("captured_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    /** Quando o equipamento confirmou o cadastro do molde. */
    syncedAt: timestamp("synced_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /** Uma foto por aluno: recapturar substitui, não acumula. */
    uniqueIndex("student_photo_student_uidx").on(table.studentId),
    index("student_photo_school_idx").on(table.schoolId),
  ],
);

export const studentPhotoRelations = relations(studentPhoto, ({ one }) => ({
  student: one(student, { fields: [studentPhoto.studentId], references: [student.id] }),
}));

export const enrollmentRelations = relations(enrollment, ({ one, many }) => ({
  school: one(school, { fields: [enrollment.schoolId], references: [school.id] }),
  student: one(student, { fields: [enrollment.studentId], references: [student.id] }),
  classroom: one(classroom, { fields: [enrollment.classroomId], references: [classroom.id] }),
  guardians: many(enrollmentGuardian),
  invites: many(enrollmentInvite),
  consents: many(enrollmentConsent),
  events: many(enrollmentEvent),
}));

export const enrollmentGuardianRelations = relations(enrollmentGuardian, ({ one }) => ({
  enrollment: one(enrollment, {
    fields: [enrollmentGuardian.enrollmentId],
    references: [enrollment.id],
  }),
}));

export const enrollmentInviteRelations = relations(enrollmentInvite, ({ one }) => ({
  enrollment: one(enrollment, {
    fields: [enrollmentInvite.enrollmentId],
    references: [enrollment.id],
  }),
}));

export const enrollmentConsentRelations = relations(enrollmentConsent, ({ one }) => ({
  enrollment: one(enrollment, {
    fields: [enrollmentConsent.enrollmentId],
    references: [enrollment.id],
  }),
}));

export const enrollmentEventRelations = relations(enrollmentEvent, ({ one }) => ({
  enrollment: one(enrollment, {
    fields: [enrollmentEvent.enrollmentId],
    references: [enrollment.id],
  }),
}));
