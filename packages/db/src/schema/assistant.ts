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
   * O provedor escolhido, por id — "openai", "groq", "ollama", "outro".
   *
   * Texto e não enum de propósito: provedor novo não deve exigir migration, e
   * id desconhecido cai em "outro" na tela em vez de quebrar. Quem de fato
   * define para onde a requisição vai continua sendo `base_url`; isto aqui é
   * o que a tela usa para preencher o endereço e sugerir modelos.
   */
  providerLabel: text("provider_label"),
  /** Endpoint compatível com `/chat/completions`. É o que define o provedor. */
  baseUrl: text("base_url"),
  model: text("model"),
  /**
   * A organização, quando o provedor pede uma — o `org-…` da OpenAI.
   *
   * Em claro, e não cifrada como a credencial: é identificador de conta, não
   * segredo. Sozinho ele não autentica nada. Cifrá-lo daria a impressão de que
   * protege alguma coisa e só atrapalharia a direção a conferir se pôs o
   * certo.
   *
   * Existe porque conta com mais de uma organização precisa dizer em qual o
   * consumo é debitado: sem o cabeçalho, a OpenAI usa a padrão — e a fatura
   * chega no lugar errado.
   */
  organizationId: text("organization_id"),
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
  /**
   * Teto de tokens no mês. `null` é "a escola ainda não declarou".
   *
   * Anulável, e não um número padrão: qualquer valor que eu chutasse aqui
   * seria arbitrário — o que a escola pode gastar depende do que ela comprou,
   * e o Astro pararia de responder num limite que ninguém escolheu. Enquanto
   * for nulo, quem segura a conta é `daily_limit`, que tem padrão.
   *
   * O contador só enxerga o que o provedor informa: resposta sem `usage` não
   * avança o consumo. A tela diz quantas foram, porque um orçamento que
   * parece intacto e não está é pior que orçamento nenhum.
   */
  monthlyTokenBudget: integer("monthly_token_budget"),
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
