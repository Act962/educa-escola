import { relations } from "drizzle-orm";
import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

import { student } from "./academic";
import { user } from "./auth";
import { school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const schoolId = () =>
  text("school_id")
    .notNull()
    .references(() => school.id, { onDelete: "cascade" });

/** Como a pessoa foi identificada na portaria. */
export const gateMethod = pgEnum("gate_method", ["rosto", "carteirinha", "manual"]);

export const gateDirection = pgEnum("gate_direction", ["entrada", "saida"]);

/**
 * Passagem na portaria. Um fato por leitura, append-only.
 *
 * **Isto não é chamada.** Entrar na escola não é estar na aula — matar aula é
 * justamente entrar e não subir. A chamada continua sendo do professor; esta
 * tabela só lhe diz a que horas o aluno cruzou o portão. Ligar as duas faria a
 * catraca mentir sobre frequência, que é o dado que decide reprovação por
 * falta (LDB, art. 24, VI).
 *
 * `method` fica gravado porque as três formas têm confiabilidade diferente:
 * `manual` é alguém da secretaria afirmando, e uma auditoria precisa saber
 * distinguir isso de uma leitura de equipamento.
 */
export const schoolEntry = pgTable(
  "school_entry",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    direction: gateDirection("direction").notNull(),
    method: gateMethod("method").notNull(),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    /**
     * Quem estava com o quiosque aberto. Nulo quando a sessão já não existe.
     *
     * Não é "quem autorizou": o quiosque não tem operador em cada passagem. É
     * de quem era a sessão no tablet, que é o que uma auditoria consegue
     * perguntar depois.
     */
    operatorUserId: text("operator_user_id").references(() => user.id, { onDelete: "set null" }),
    /** Identificador do tablet, digitado na abertura do quiosque. */
    deviceLabel: text("device_label"),
    /**
     * Exclusão é marca, não apagamento.
     *
     * A passagem diz a que horas uma criança entrou ou saiu da escola. Apagar
     * a linha destruiria a única resposta para "ela chegou?" num dia em que
     * alguém precise dela — e destruiria também o rastro de quem a apagou. A
     * linha sai da lista e continua no banco, com autor e instante.
     */
    deletedAt: timestamp("deleted_at"),
    deletedByUserId: text("deleted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("school_entry_school_at_idx").on(table.schoolId, table.occurredAt),
    index("school_entry_student_idx").on(table.schoolId, table.studentId, table.occurredAt),
  ],
);

/**
 * O molde facial do aluno — os "códigos do rosto".
 *
 * **Descritor não é anonimização.** São 128 números que descrevem o rosto, e
 * pela LGPD isso continua sendo dado biométrico: existe pesquisa que
 * reconstrói aproximações do rosto a partir deles. Por isso ele é cifrado como
 * a foto, com a mesma máquina e a mesma chave fora do banco.
 *
 * Existe só para quem tem consentimento de `biometria`, e some junto com a
 * foto na revogação — meia revogação, que apaga a imagem e deixa o molde,
 * seria pior que não revogar, porque a catraca continuaria reconhecendo.
 *
 * `dimensions` fica gravado porque descritor de biblioteca diferente tem
 * tamanho diferente, e comparar vetores de tamanhos distintos devolve número
 * sem significado em vez de erro. Trocar de biblioteca é recadastrar todo
 * mundo, e esta coluna é o que torna isso detectável em vez de silencioso.
 */
export const studentFaceTemplate = pgTable(
  "student_face_template",
  {
    id: id(),
    schoolId: schoolId(),
    studentId: text("student_id")
      .notNull()
      .references(() => student.id, { onDelete: "cascade" }),
    /** AES-256-GCM sobre o vetor serializado. Os três juntos, ou nenhum. */
    cipher: text("cipher").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    /** Quantos números tem o vetor. Ver a nota acima. */
    dimensions: integer("dimensions").notNull(),
    /** Qual extrator gerou — molde de extratores diferentes não se compara. */
    extractor: text("extractor").notNull(),
    enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
    enrolledByUserId: text("enrolled_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /** Um molde por aluno: recadastrar substitui. */
    uniqueIndex("student_face_template_student_uidx").on(table.studentId),
    index("student_face_template_school_idx").on(table.schoolId),
  ],
);

export const schoolEntryRelations = relations(schoolEntry, ({ one }) => ({
  student: one(student, { fields: [schoolEntry.studentId], references: [student.id] }),
}));

export const studentFaceTemplateRelations = relations(studentFaceTemplate, ({ one }) => ({
  student: one(student, { fields: [studentFaceTemplate.studentId], references: [student.id] }),
}));
