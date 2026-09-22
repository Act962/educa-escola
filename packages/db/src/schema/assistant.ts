import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { school } from "./school";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

/**
 * O que a escola configurou do Astro. Uma linha por escola.
 *
 * A credencial do modelo **não fica em claro**. Vai cifrada em AES-256-GCM com
 * `ASSISTANT_ENCRYPTION_KEY`, que vive fora do banco — a mesma ameaça da foto
 * do aluno: a `DATABASE_URL` mora num `.env`, e um dump sem a chave precisa
 * devolver ruído. Aqui o custo de vazar é dinheiro de verdade, porque chave de
 * modelo é chave de cartão de crédito com outro nome.
 */
export const assistantSettings = pgTable("assistant_settings", {
  schoolId: text("school_id")
    .primaryKey()
    .references(() => school.id, { onDelete: "cascade" }),
  enabled: boolean("enabled").default(false).notNull(),
  /**
   * Rótulo livre do provedor — "OpenAI", "Azure", "Ollama no servidor".
   *
   * Texto e não enum de propósito: quem escolhe o provedor é a escola, pelo
   * endereço que ela põe em `base_url`. Uma lista fechada aqui viraria uma
   * migration toda vez que aparecesse um provedor novo.
   */
  providerLabel: text("provider_label"),
  /** Endpoint compatível com `/chat/completions`. É o que define o provedor. */
  baseUrl: text("base_url"),
  model: text("model"),
  /** AES-256-GCM. Os três juntos, ou nenhum: sem a etiqueta não há como abrir. */
  apiKeyCipher: text("api_key_cipher"),
  apiKeyIv: text("api_key_iv"),
  apiKeyTag: text("api_key_tag"),
  /**
   * Os últimos quatro caracteres da chave, em claro.
   *
   * É o que a tela mostra para a direção confirmar *qual* chave está lá sem
   * nunca receber a chave de volta. Quatro caracteres não reconstroem nada.
   */
  apiKeyHint: text("api_key_hint"),
  maxTokens: integer("max_tokens").default(600).notNull(),
  /**
   * Teto de perguntas por dia, na escola inteira.
   *
   * Chave de modelo sem teto é conta aberta: um laço num script, ou uma turma
   * inteira brincando, vira fatura no fim do mês. O teto é da escola e não por
   * pessoa porque quem paga é a escola.
   */
  dailyLimit: integer("daily_limit").default(200).notNull(),
  allowTeachers: boolean("allow_teachers").default(true).notNull(),
  allowStudents: boolean("allow_students").default(false).notNull(),
  updatedByUserId: text("updated_by_user_id").references(() => user.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/**
 * Uma linha por pergunta feita. **Sem a pergunta.**
 *
 * Guardar o que um aluno perguntou ao assistente é guardar conteúdo de criança
 * — outra finalidade, outro consentimento, outra conversa com a escola. O que
 * fica aqui é contagem: quem perguntou, quando, e quanto custou. É o bastante
 * para o teto diário e para a escola saber o que está gastando.
 */
export const assistantUsage = pgTable(
  "assistant_usage",
  {
    id: id(),
    schoolId: text("school_id")
      .notNull()
      .references(() => school.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    role: text("role").notNull(),
    /** `null` quando o provedor não informa. Nem todos informam. */
    tokens: integer("tokens"),
    askedAt: timestamp("asked_at").defaultNow().notNull(),
  },
  (table) => [index("assistant_usage_school_at_idx").on(table.schoolId, table.askedAt)],
);
