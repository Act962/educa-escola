import { relations } from "drizzle-orm";
import {
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
 * O vínculo da escola com o ecossistema Órbita.
 *
 * **Aqui mora só o vínculo, nunca o dado dos apps.** O CRM, o chat, os
 * arquivos — tudo isso continua vivendo no Órbita, que é quem o mantém. Copiar
 * tabela de lá para cá criaria duas verdades sobre o mesmo dado e uma segunda
 * implementação para manter.
 */

export const orbitaWorkspaceStatus = pgEnum("orbita_workspace_status", [
  "pendente",
  "ativo",
  "suspenso",
]);

export const orbitaInstallStatus = pgEnum("orbita_install_status", [
  "instalando",
  "instalado",
  "falhou",
  "removido",
]);

export const orbitaEventType = pgEnum("orbita_event_type", [
  "conectada",
  "desconectada",
  "instalacao_iniciada",
  "instalado",
  "instalacao_falhou",
  "removido",
]);

/**
 * A organização da escola no Órbita.
 *
 * Um por escola: é a conta onde os apps rodam e onde as Stars são debitadas.
 * `orbitaOrganizationId` fica nulo enquanto a conexão não foi feita — a escola
 * vê a aba e os custos antes de conectar, e decide depois.
 */
export const orbitaWorkspace = pgTable("orbita_workspace", {
  schoolId: text("school_id")
    .primaryKey()
    .references(() => school.id, { onDelete: "cascade" }),
  orbitaOrganizationId: text("orbita_organization_id"),
  status: orbitaWorkspaceStatus("status").default("pendente").notNull(),
  connectedAt: timestamp("connected_at"),
  connectedByUserId: text("connected_by_user_id").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const orbitaAppInstall = pgTable(
  "orbita_app_install",
  {
    id: id(),
    schoolId: schoolId(),
    /** Chave do app, a mesma do `appSlug` no catálogo do Órbita. */
    appKey: text("app_key").notNull(),
    status: orbitaInstallStatus("status").default("instalando").notNull(),
    /**
     * O preço do dia da instalação, em Stars.
     *
     * O catálogo do Órbita muda sem deploy daqui. Guardar o valor do momento é
     * o que permite responder "quanto a escola pagou por isto?" seis meses
     * depois — a pergunta que o preço de hoje não responde.
     */
    setupCostSnapshot: integer("setup_cost_snapshot"),
    monthlyCostSnapshot: integer("monthly_cost_snapshot"),
    installedAt: timestamp("installed_at"),
    installedByUserId: text("installed_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    removedAt: timestamp("removed_at"),
    /** Última falha, em português, para a tela não dizer "erro desconhecido". */
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    /** Um app por escola: reinstalar reaproveita a linha, não acumula. */
    uniqueIndex("orbita_app_install_school_app_uidx").on(table.schoolId, table.appKey),
    index("orbita_app_install_school_idx").on(table.schoolId),
  ],
);

/**
 * Trilha do que aconteceu com a conexão e com cada app, append-only.
 *
 * Mesma forma de `enrollment_event`: o repositório só expõe `append` e
 * `list`. Sem isso, "por que esse app sumiu?" e "quem instalou isso?" não têm
 * resposta — e instalação gasta dinheiro da escola.
 */
export const orbitaEvent = pgTable(
  "orbita_event",
  {
    id: id(),
    schoolId: schoolId(),
    type: orbitaEventType("type").notNull(),
    appKey: text("app_key"),
    actorUserId: text("actor_user_id").references(() => user.id, { onDelete: "set null" }),
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [index("orbita_event_school_idx").on(table.schoolId, table.occurredAt)],
);

export const orbitaWorkspaceRelations = relations(orbitaWorkspace, ({ one, many }) => ({
  school: one(school, { fields: [orbitaWorkspace.schoolId], references: [school.id] }),
  installs: many(orbitaAppInstall),
}));

export const orbitaAppInstallRelations = relations(orbitaAppInstall, ({ one }) => ({
  workspace: one(orbitaWorkspace, {
    fields: [orbitaAppInstall.schoolId],
    references: [orbitaWorkspace.schoolId],
  }),
}));

export const orbitaEventRelations = relations(orbitaEvent, ({ one }) => ({
  school: one(school, { fields: [orbitaEvent.schoolId], references: [school.id] }),
}));
