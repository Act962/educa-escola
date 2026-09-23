import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

/**
 * O fornecedor por trás do número.
 *
 * `cloud` é a API oficial da Meta; `memoria` é o dublê, que aceita tudo e não
 * manda nada — é o que sustenta demonstração e teste sem número de verdade.
 *
 * Enum e não texto livre, ao contrário de `assistant_settings.provider_label`:
 * lá o provedor é só rótulo, e quem define para onde a requisição vai é a URL
 * que a escola digita. Aqui o valor **escolhe o adaptador**, e um id
 * desconhecido não teria para onde cair. Fornecedor novo entra com migration,
 * que é o passo certo: ele traz código junto.
 */
export const whatsappProvider = pgEnum("whatsapp_provider", ["cloud", "memoria"]);

/** O que o último "Testar conexão" descobriu. Cópia, não verdade. */
export const whatsappAccountStatus = pgEnum("whatsapp_account_status", [
  "rascunho",
  "conectado",
  "erro",
]);

/**
 * O número de WhatsApp da escola.
 *
 * Uma linha por número, e **mais de uma por escola é permitido de propósito**:
 * escola com duas unidades vai querer dois números, e descobrir isso com uma
 * tabela de linha única por escola custaria migração de dado. A tela mostra o
 * principal; o modelo já aguenta o resto.
 *
 * O token e o app secret vão cifrados em AES-256-GCM com
 * `WHATSAPP_ENCRYPTION_KEY`, que vive fora do banco — mesma ameaça da foto do
 * aluno e da credencial do Astro: a `DATABASE_URL` mora num `.env`, e um dump
 * sem a chave precisa devolver ruído. Aqui o custo de vazar não é só dinheiro:
 * um token de WhatsApp Business manda mensagem **em nome da escola** para a
 * lista de famílias dela.
 */
export const whatsappAccount = pgTable(
  "whatsapp_account",
  {
    id: id(),
    schoolId: schoolId(),
    provider: whatsappProvider("provider").default("cloud").notNull(),
    /** Como a escola chama este número: "Secretaria", "Unidade Centro". */
    label: text("label").notNull(),
    /**
     * Identificadores da conta, **em claro**.
     *
     * São identificadores, não segredos: sozinhos não autenticam nada. Cifrá-los
     * daria a impressão de proteger alguma coisa e só atrapalharia a direção a
     * conferir se pôs o certo — que é a checagem que ela mais vai fazer.
     */
    phoneNumberId: text("phone_number_id"),
    wabaId: text("waba_id"),
    appId: text("app_id"),
    /** O que a Meta devolveu no último teste: número formatado e nome verificado. */
    displayPhoneNumber: text("display_phone_number"),
    verifiedName: text("verified_name"),
    /** `GREEN`, `YELLOW`, `RED` — a qualidade que a Meta reporta. */
    qualityRating: text("quality_rating"),
    /** AES-256-GCM. Os três juntos, ou nenhum: sem a etiqueta não há como abrir. */
    tokenCipher: text("token_cipher"),
    tokenIv: text("token_iv"),
    tokenTag: text("token_tag"),
    /** Últimos quatro caracteres, para a tela dizer *qual* token está gravado. */
    tokenHint: text("token_hint"),
    /**
     * O app secret, também cifrado.
     *
     * Opcional porque o envio não precisa dele: ele serve para conferir a
     * assinatura do webhook de entrada, que é a fase seguinte. Guardar desde já
     * evita pedir à direção que volte ao painel da Meta depois.
     */
    appSecretCipher: text("app_secret_cipher"),
    appSecretIv: text("app_secret_iv"),
    appSecretTag: text("app_secret_tag"),
    status: whatsappAccountStatus("status").default("rascunho").notNull(),
    /** A mensagem do último teste que falhou. Em português, para a direção. */
    lastError: text("last_error"),
    checkedAt: timestamp("checked_at"),
    /**
     * O número que o resto do sistema usa quando ninguém escolhe.
     *
     * Não é "o único": é o padrão. O índice parcial abaixo garante um por
     * escola — dois principais é o tipo de estado que ninguém percebe até a
     * mensagem sair pelo número errado.
     */
    isDefault: boolean("is_default").default(false).notNull(),
    /**
     * O teto de conversas gratuitas do mês. `null` usa o padrão da Meta.
     *
     * Coluna anulável, e não um `1000` gravado: o número é da Meta e ela o
     * muda. Com `null` significando "use a constante", mudar o padrão é uma
     * linha em `billing.ts` e vale para toda escola no deploy seguinte — só
     * quem tem contrato diferente carrega valor próprio aqui.
     */
    freeTierLimit: integer("free_tier_limit"),
    /**
     * Esgotada a cota, o sistema recusa abrir conversa nova.
     *
     * Ligado por padrão, e é a escolha conservadora de propósito: a conta é da
     * escola, e uma escola que descobre o estouro na fatura descobre tarde.
     * Quem quiser passar do teto desliga aqui, conscientemente — que é
     * diferente de passar sem perceber.
     *
     * **Não vale para mensagem por modelo**: ela é cobrada por mensagem e não
     * sai desta cota. Bloqueá-la aqui inventaria uma regra que a Meta não tem.
     */
    blockWhenExhausted: boolean("block_when_exhausted").default(true).notNull(),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("whatsapp_account_school_idx").on(table.schoolId),
    uniqueIndex("whatsapp_account_default_idx").on(table.schoolId).where(sql`is_default`),
  ],
);

/**
 * O estado do modelo. **Cópia do que a Meta diz**, com data.
 *
 * `rascunho` é só nosso: o modelo existe aqui e a Meta nunca o viu. Os outros
 * quatro são o vocabulário dela, traduzido. A verdade é remota, e é por isso
 * que `syncedAt` anda junto — tela que mostra "aprovado" sem dizer quando
 * conferiu mente devagar.
 */
export const whatsappTemplateStatus = pgEnum("whatsapp_template_status", [
  "rascunho",
  "enviado",
  "aprovado",
  "recusado",
  "pausado",
]);

export const whatsappTemplateCategory = pgEnum("whatsapp_template_category", [
  "UTILITY",
  "MARKETING",
  "AUTHENTICATION",
]);

/**
 * Um modelo de mensagem, como a escola o escreveu.
 *
 * `body`, `header`, `footer` e `buttons` guardam o texto **com os nomes das
 * variáveis** — `{{nome_do_aluno}}` —, não com os números que a Meta recebe.
 * A tradução para `{{1}}` acontece na saída, em `template.ts`. Guardar
 * numerado tornaria o modelo ilegível no banco e impossível de editar sem
 * decorar a ordem.
 */
export const whatsappTemplate = pgTable(
  "whatsapp_template",
  {
    id: id(),
    schoolId: schoolId(),
    accountId: text("account_id").references(() => whatsappAccount.id, { onDelete: "set null" }),
    /** `snake_case`, único na conta da Meta. É a chave do envio. */
    name: text("name").notNull(),
    category: whatsappTemplateCategory("category").default("UTILITY").notNull(),
    language: text("language").default("pt_BR").notNull(),
    headerText: text("header_text"),
    body: text("body").notNull(),
    footerText: text("footer_text"),
    /** Lista de botões, na forma de `template.ts`. Vazio quando não há. */
    buttons: jsonb("buttons").$type<unknown[]>().default([]).notNull(),
    /**
     * Um exemplo por variável, na ordem em que aparecem.
     *
     * A Meta **exige** exemplo para aprovar: ela revisa a mensagem preenchida,
     * não o esqueleto. Sem isto o modelo volta recusado horas depois, com um
     * motivo que ninguém liga ao campo que faltou.
     */
    examples: jsonb("examples").$type<string[]>().default([]).notNull(),
    status: whatsappTemplateStatus("status").default("rascunho").notNull(),
    /** O id do modelo na Meta, quando já foi enviado. */
    providerTemplateId: text("provider_template_id"),
    /** O motivo da recusa, como a Meta o devolveu. */
    rejectionReason: text("rejection_reason"),
    syncedAt: timestamp("synced_at"),
    createdByUserId: text("created_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index("whatsapp_template_school_idx").on(table.schoolId),
    /** Nome único por escola: é o que a Meta cobra na conta, espelhado aqui. */
    uniqueIndex("whatsapp_template_school_name_idx").on(table.schoolId, table.name, table.language),
  ],
);

/**
 * O que a mensagem virou.
 *
 * Para no `enviado` de propósito neste MVP: entrega e leitura chegam por
 * webhook, que ainda não existe. Os estados já estão no enum porque acrescentar
 * valor a enum é migration, e a fase seguinte não deve precisar de uma.
 */
export const whatsappMessageStatus = pgEnum("whatsapp_message_status", [
  "fila",
  "enviado",
  "entregue",
  "lido",
  "falhou",
]);

/**
 * Uma linha por envio.
 *
 * `renderedText` guarda a mensagem **já preenchida**, e isso é escolha: é o que
 * responde "o que exatamente foi mandado para essa família", que é a pergunta
 * que aparece quando há reclamação. É conteúdo da escola, não conteúdo de
 * criança — a mesma distinção que `assistant_usage` faz ao *não* guardar a
 * pergunta do aluno.
 *
 * O destinatário fica como E.164 solto, sem chave estrangeira para
 * `enrollment_guardian`: o envio é um fato datado, e o responsável pode trocar
 * de número ou sair da matrícula depois. Apontar para a linha faria o histórico
 * mudar de destinatário retroativamente.
 */
/**
 * Como a mensagem entra na conta da Meta.
 *
 * `servico` é texto livre dentro da janela de atendimento — o que consome a
 * cota gratuita de mil conversas por mês. `modelo` é mensagem por modelo
 * aprovado, cobrada por mensagem e fora dessa cota. Somar as duas num contador
 * só faria o painel dizer que a cota acabou quando o que acabou foi o dinheiro.
 */
export const whatsappBillingCategory = pgEnum("whatsapp_billing_category", ["servico", "modelo"]);

export const whatsappMessage = pgTable(
  "whatsapp_message",
  {
    id: id(),
    schoolId: schoolId(),
    accountId: text("account_id").references(() => whatsappAccount.id, { onDelete: "set null" }),
    templateId: text("template_id").references(() => whatsappTemplate.id, { onDelete: "set null" }),
    toPhoneE164: text("to_phone_e164").notNull(),
    /** "modelo" ou "texto": qual dos dois caminhos da porta foi usado. */
    kind: text("kind").notNull(),
    renderedText: text("rendered_text").notNull(),
    status: whatsappMessageStatus("status").default("fila").notNull(),
    providerMessageId: text("provider_message_id"),
    /** A mensagem de erro em português, quando falhou. */
    error: text("error"),
    billingCategory: whatsappBillingCategory("billing_category").default("modelo").notNull(),
    /**
     * Esta mensagem abriu uma conversa de serviço?
     *
     * É o que o contador soma. Guardado na linha, e **não recalculado na
     * leitura**, porque a decisão foi tomada com os dados de um instante que
     * não volta: a janela daquele número estava aberta ou não quando se
     * apertou enviar. Recalcular depois mudaria o passado toda vez que a regra
     * da Meta mudasse.
     */
    openedConversation: boolean("opened_conversation").default(false).notNull(),
    sentByUserId: text("sent_by_user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    sentAt: timestamp("sent_at"),
  },
  (table) => [
    index("whatsapp_message_school_at_idx").on(table.schoolId, table.createdAt),
    /**
     * O índice da janela: "qual foi o último envio de serviço para este
     * número nesta conta?". É a consulta que roda antes de **todo** envio, e
     * sem ela o disparo em massa varre a tabela inteira por destinatário.
     */
    index("whatsapp_message_janela_idx").on(
      table.accountId,
      table.toPhoneE164,
      table.billingCategory,
      table.sentAt,
    ),
  ],
);
