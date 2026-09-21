import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { AppCost, OrbitaCatalog, StarBalance } from "../../integrations/orbita/catalog";
import type { OrbitaIdentity } from "../../integrations/orbita/identity";
import type { OrbitaRepository } from "./repository";
import { APP_KEYS, type AppKey, type InstallAppInput, type RemoveAppInput } from "./schema";

export interface OrbitaServiceDeps {
  now: () => Date;
  catalog: OrbitaCatalog;
  identity: OrbitaIdentity;
  actor: { userId: string };
}

/** O que a tela precisa saber de cada app, num objeto só. */
export interface AppState {
  appKey: AppKey;
  status: "disponivel" | "instalando" | "instalado" | "falhou";
  cost: AppCost | null;
  installedAt: Date | null;
  lastError: string | null;
  /** `false` quando o saldo não cobre a ativação. A tela diz quanto falta. */
  affordable: boolean;
}

/**
 * Os apps do Órbita, vistos de dentro do Integra.
 *
 * O dado dos apps mora lá; aqui mora o vínculo e o estado da instalação. A
 * regra que sustenta esta tela é uma só: **botão que gasta dinheiro não pode
 * ser mudo.** Instalar debita Stars da conta da escola, então o custo aparece
 * antes, a confirmação repete o valor, e o serviço recusa quando o saldo não
 * cobre em vez de deixar o Órbita falhar depois.
 */
export function createOrbitaService(repo: OrbitaRepository, deps: OrbitaServiceDeps) {
  async function contexto() {
    const workspace = await repo.workspace();
    const balance = await deps.catalog.balance(workspace?.orbitaOrganizationId ?? null);
    return { workspace, balance };
  }

  return {
    /** A grade inteira: treze apps, com custo, estado e se o saldo cobre. */
    async overview() {
      const { workspace, balance } = await contexto();
      const [installs, costs] = await Promise.all([
        repo.listInstalls(),
        deps.catalog.costs([...APP_KEYS]),
      ]);

      const instalado = new Map(installs.map((linha) => [linha.appKey, linha]));

      const apps: AppState[] = APP_KEYS.map((appKey) => {
        const linha = instalado.get(appKey);
        const cost = costs.get(appKey) ?? null;

        // Sem saldo conhecido não dá para afirmar que não cobre: a escola
        // ainda não conectou, e "não pode instalar" seria mentira.
        const affordable =
          balance === null || cost === null
            ? true
            : balance.balance + balance.bonusBalance >= cost.setupCost;

        const status: AppState["status"] =
          linha && linha.status !== "removido" ? linha.status : "disponivel";

        return {
          appKey,
          status,
          cost,
          installedAt: linha?.installedAt ?? null,
          lastError: linha?.lastError ?? null,
          affordable,
        };
      });

      return {
        connected: workspace?.status === "ativo",
        balance,
        apps,
        installedCount: apps.filter((app) => app.status === "instalado").length,
      };
    },

    /**
     * Conecta a escola ao Órbita.
     *
     * Hoje recebe o id da organização de fora porque a porta que a criaria no
     * Órbita ainda não existe. Quando existir, isto passa a chamá-la — e a
     * assinatura não muda.
     */
    async connect(orbitaOrganizationId: string) {
      const now = deps.now();
      const workspace = await repo.connectWorkspace({
        orbitaOrganizationId,
        userId: deps.actor.userId,
        now,
      });

      await repo.appendEvent({
        type: "conectada",
        actorUserId: deps.actor.userId,
        payload: { orbitaOrganizationId },
      });

      return workspace;
    },

    /**
     * Instala um app, e cobra o que prometeu cobrar.
     *
     * A verificação de preço é contra o valor que a tela mostrou, não contra o
     * atual: o catálogo muda no Órbita sem deploy aqui, e confirmar 120 ★ para
     * pagar 180 ★ é o defeito que esta checagem existe para impedir.
     */
    async install(input: InstallAppInput) {
      const { workspace, balance } = await contexto();
      if (!workspace || workspace.status !== "ativo") {
        throw new ValidationError("Conecte a escola ao Órbita antes de instalar um app.");
      }

      const existente = await repo.findInstall(input.appKey);
      if (existente && existente.status === "instalado") {
        throw new ConflictError("Este app já está instalado.");
      }

      const costs = await deps.catalog.costs([input.appKey]);
      const cost = costs.get(input.appKey);
      if (!cost || !cost.isEnabled) {
        throw new NotFoundError("Este app não está disponível no catálogo do Órbita.");
      }

      if (cost.setupCost !== input.expectedSetupCost) {
        throw new ConflictError(
          `O preço mudou: a ativação agora custa ${cost.setupCost} ★, e não ${input.expectedSetupCost} ★.`,
        );
      }

      if (balance && balance.balance + balance.bonusBalance < cost.setupCost) {
        const faltam = cost.setupCost - (balance.balance + balance.bonusBalance);
        throw new ValidationError(`Saldo insuficiente: faltam ${faltam} ★ para ativar este app.`);
      }

      const now = deps.now();

      // Fica em `instalando` porque quem ativa de verdade é o Órbita, e a
      // porta ainda não existe. A tela mostra o andamento em vez de fingir
      // que terminou.
      const linha = await repo.upsertInstall({
        appKey: input.appKey,
        status: "instalando",
        setupCostSnapshot: cost.setupCost,
        monthlyCostSnapshot: cost.monthlyCost,
        installedByUserId: deps.actor.userId,
        installedAt: null,
        removedAt: null,
        lastError: null,
      });

      await repo.appendEvent({
        type: "instalacao_iniciada",
        appKey: input.appKey,
        actorUserId: deps.actor.userId,
        payload: { setupCost: cost.setupCost, monthlyCost: cost.monthlyCost },
      });

      return { appKey: input.appKey, status: linha.status, now };
    },

    /**
     * O endereço para abrir um app, já autenticado.
     *
     * Só para app instalado: abrir o que a escola não contratou levaria a uma
     * tela de erro do Órbita, e o problema pareceria do Integra. O token é
     * emitido no momento do clique e vale segundos — não dá para guardar este
     * endereço nem compartilhá-lo.
     */
    async openApp(input: { appKey: AppKey; embedded?: boolean }) {
      const workspace = await repo.workspace();
      if (!workspace?.orbitaOrganizationId || workspace.status !== "ativo") {
        throw new ValidationError("Conecte a escola ao Órbita antes de abrir um app.");
      }

      const linha = await repo.findInstall(input.appKey);
      if (!linha || linha.status !== "instalado") {
        throw new NotFoundError("Este app não está instalado.");
      }

      const url = await deps.identity.handoffUrl({
        orbitaOrganizationId: workspace.orbitaOrganizationId,
        appKey: input.appKey,
        embedded: input.embedded,
      });

      return { url };
    },

    async remove(input: RemoveAppInput) {
      const existente = await repo.findInstall(input.appKey);
      if (!existente || existente.status === "removido") {
        throw new NotFoundError("Este app não está instalado.");
      }

      const now = deps.now();
      await repo.updateInstall(input.appKey, { status: "removido", removedAt: now });
      await repo.appendEvent({
        type: "removido",
        appKey: input.appKey,
        actorUserId: deps.actor.userId,
      });

      return { appKey: input.appKey };
    },

    events: () => repo.listEvents(),
  };
}

export type OrbitaService = ReturnType<typeof createOrbitaService>;
export type { AppCost, StarBalance };
