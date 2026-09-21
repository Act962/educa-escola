import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { createDemoCatalog } from "../../integrations/orbita/catalog";
import { createStubIdentity } from "../../integrations/orbita/identity";
import type { InstallRow, OrbitaRepository, WorkspaceRow } from "./repository";
import { createOrbitaService } from "./service";

const AGORA = new Date("2026-09-21T12:00:00Z");
const ORG = "org-orbita-1";

/**
 * Repositório em memória, tipado como o real (sem cast): se a interface mudar,
 * este dublê para de compilar em vez de mentir.
 */
function fakeRepository(
  estado: { workspace?: WorkspaceRow | null; installs?: InstallRow[] } = {},
): OrbitaRepository {
  let workspace = estado.workspace ?? null;
  const installs = [...(estado.installs ?? [])];
  const eventos: { type: string; appKey?: string | null }[] = [];

  return {
    workspace: async () => workspace,

    connectWorkspace: async (data) => {
      workspace = {
        schoolId: "escola-1",
        orbitaOrganizationId: data.orbitaOrganizationId,
        status: "ativo",
        connectedAt: data.now,
        connectedByUserId: data.userId,
        createdAt: data.now,
        updatedAt: data.now,
      };
      return workspace;
    },

    listInstalls: async () => installs,

    findInstall: async (appKey) => installs.find((linha) => linha.appKey === appKey) ?? null,

    upsertInstall: async (data) => {
      const linha = {
        id: `inst-${data.appKey}`,
        schoolId: "escola-1",
        createdAt: AGORA,
        updatedAt: AGORA,
        removedAt: null,
        lastError: null,
        installedAt: null,
        installedByUserId: null,
        setupCostSnapshot: null,
        monthlyCostSnapshot: null,
        ...data,
      } as InstallRow;

      const indice = installs.findIndex((item) => item.appKey === data.appKey);
      if (indice >= 0) installs[indice] = linha;
      else installs.push(linha);
      return linha;
    },

    updateInstall: async (appKey, data) => {
      const indice = installs.findIndex((item) => item.appKey === appKey);
      if (indice < 0) return null;
      installs[indice] = { ...(installs[indice] as InstallRow), ...data } as InstallRow;
      return installs[indice] as InstallRow;
    },

    appendEvent: async (data) => {
      eventos.push({ type: data.type, appKey: data.appKey });
      return { ...data, id: "ev", schoolId: "escola-1", occurredAt: AGORA } as never;
    },

    listEvents: async () => eventos as never,
  };
}

function servico(repo: OrbitaRepository, saldo?: { balance: number; bonusBalance: number }) {
  return createOrbitaService(repo, {
    now: () => AGORA,
    catalog: createDemoCatalog(saldo),
    identity: createStubIdentity(),
    actor: { userId: "usuario-1" },
  });
}

const conectada: WorkspaceRow = {
  schoolId: "escola-1",
  orbitaOrganizationId: ORG,
  status: "ativo",
  connectedAt: AGORA,
  connectedByUserId: "usuario-1",
  createdAt: AGORA,
  updatedAt: AGORA,
};

describe("overview", () => {
  it("devolve os treze apps mesmo sem conexão", async () => {
    const panorama = await servico(fakeRepository()).overview();

    expect(panorama.apps).toHaveLength(13);
    expect(panorama.connected).toBe(false);
    expect(panorama.installedCount).toBe(0);
    expect(panorama.apps.every((app) => app.status === "disponivel")).toBe(true);
  });

  /**
   * Sem conta conectada não há saldo — e afirmar que a escola não pode pagar
   * seria mentira. Só se marca "não cobre" quando existe um número para comparar.
   */
  it("sem conexão, nenhum app aparece como inacessível", async () => {
    const panorama = await servico(fakeRepository()).overview();

    expect(panorama.balance).toBeNull();
    expect(panorama.apps.every((app) => app.affordable)).toBe(true);
  });

  it("com saldo baixo, marca quem não cabe", async () => {
    const panorama = await servico(fakeRepository({ workspace: conectada }), {
      balance: 50,
      bonusBalance: 0,
    }).overview();

    // TrafeGO custa 150 na ativação; Linnker e Astro custam 0.
    const trafego = panorama.apps.find((app) => app.appKey === "trafego");
    const linnker = panorama.apps.find((app) => app.appKey === "linnker");

    expect(trafego?.affordable).toBe(false);
    expect(linnker?.affordable).toBe(true);
  });

  it("app removido volta a aparecer como disponível", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [{ appKey: "chat", status: "removido" } as InstallRow],
    });

    const panorama = await servico(repo).overview();
    expect(panorama.apps.find((app) => app.appKey === "chat")?.status).toBe("disponivel");
    expect(panorama.installedCount).toBe(0);
  });
});

describe("install", () => {
  it("recusa antes de a escola conectar a conta", async () => {
    const service = servico(fakeRepository());

    await expect(service.install({ appKey: "linnker", expectedSetupCost: 0 })).rejects.toThrow(
      ValidationError,
    );
  });

  it("instala e deixa em andamento, porque quem ativa é o Órbita", async () => {
    const repo = fakeRepository({ workspace: conectada });
    const resultado = await servico(repo).install({ appKey: "forms", expectedSetupCost: 40 });

    expect(resultado.status).toBe("instalando");

    const linha = await repo.findInstall("forms");
    expect(linha?.setupCostSnapshot).toBe(40);
    expect(linha?.monthlyCostSnapshot).toBe(25);
  });

  /**
   * O catálogo muda no Órbita sem deploy aqui. Confirmar 40 ★ e pagar 180 ★ é
   * exatamente o defeito que esta checagem existe para impedir.
   */
  it("recusa quando o preço mudou entre a tela e o clique", async () => {
    const service = servico(fakeRepository({ workspace: conectada }));

    await expect(service.install({ appKey: "forms", expectedSetupCost: 10 })).rejects.toThrow(
      /preço mudou/i,
    );
  });

  it("recusa com saldo insuficiente, e diz quanto falta", async () => {
    const service = servico(fakeRepository({ workspace: conectada }), {
      balance: 100,
      bonusBalance: 20,
    });

    await expect(service.install({ appKey: "trafego", expectedSetupCost: 150 })).rejects.toThrow(
      /faltam 30/,
    );
  });

  it("o bônus entra na conta do que a escola pode gastar", async () => {
    const service = servico(fakeRepository({ workspace: conectada }), {
      balance: 100,
      bonusBalance: 50,
    });

    await expect(
      service.install({ appKey: "trafego", expectedSetupCost: 150 }),
    ).resolves.toMatchObject({ appKey: "trafego" });
  });

  it("instalar duas vezes não cria duas linhas", async () => {
    const repo = fakeRepository({ workspace: conectada });
    const service = servico(repo);

    await service.install({ appKey: "nbox", expectedSetupCost: 30 });
    await service.install({ appKey: "nbox", expectedSetupCost: 30 });

    expect(await repo.listInstalls()).toHaveLength(1);
  });

  it("recusa reinstalar o que já está instalado", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [{ appKey: "chat", status: "instalado" } as InstallRow],
    });

    await expect(servico(repo).install({ appKey: "chat", expectedSetupCost: 70 })).rejects.toThrow(
      ConflictError,
    );
  });
});

describe("remove", () => {
  it("recusa remover o que não está instalado", async () => {
    await expect(
      servico(fakeRepository({ workspace: conectada })).remove({ appKey: "pages" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("remove e marca a data", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [{ appKey: "pages", status: "instalado" } as InstallRow],
    });

    await servico(repo).remove({ appKey: "pages" });

    const linha = await repo.findInstall("pages");
    expect(linha?.status).toBe("removido");
    expect(linha?.removedAt).toEqual(AGORA);
  });
});

describe("openApp", () => {
  it("recusa antes de a escola conectar", async () => {
    await expect(servico(fakeRepository()).openApp({ appKey: "chat" })).rejects.toThrow(
      ValidationError,
    );
  });

  /**
   * Abrir o que a escola não contratou levaria a uma tela de erro do Órbita, e
   * o problema pareceria do Integra.
   */
  it("recusa app que não está instalado", async () => {
    await expect(
      servico(fakeRepository({ workspace: conectada })).openApp({ appKey: "chat" }),
    ).rejects.toThrow(NotFoundError);
  });

  it("devolve o endereço com organização, app e token", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [{ appKey: "chat", status: "instalado" } as InstallRow],
    });

    const { url } = await servico(repo).openApp({ appKey: "chat" });
    const endereco = new URL(url);

    expect(endereco.pathname).toBe("/entrar");
    expect(endereco.searchParams.get("org")).toBe(ORG);
    expect(endereco.searchParams.get("app")).toBe("chat");
    expect(endereco.searchParams.get("token")).toBeTruthy();
    expect(endereco.searchParams.get("embedded")).toBeNull();
  });

  it("pede o layout sem navegação quando for embutido", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [{ appKey: "chat", status: "instalado" } as InstallRow],
    });

    const { url } = await servico(repo).openApp({ appKey: "chat", embedded: true });
    expect(new URL(url).searchParams.get("embedded")).toBe("1");
  });
});

describe("installed", () => {
  /**
   * A barra lateral desenha um item por app instalado. App que ficou em
   * `instalando` ou que foi removido não pode virar item de menu: o clique
   * levaria a uma aba que o `openApp` recusa.
   */
  it("traz só o que está instalado de fato", async () => {
    const repo = fakeRepository({
      workspace: conectada,
      installs: [
        { appKey: "chat", status: "instalado", installedAt: AGORA } as InstallRow,
        { appKey: "forms", status: "instalando" } as InstallRow,
        { appKey: "pages", status: "removido" } as InstallRow,
        { appKey: "astro", status: "falhou" } as InstallRow,
      ],
    });

    const lista = await servico(repo).installed();

    expect(lista).toEqual([{ appKey: "chat", installedAt: AGORA }]);
  });

  /** Sem conexão não há instalação — e a lista vazia não pode virar erro. */
  it("devolve lista vazia sem conexão, sem falhar", async () => {
    await expect(servico(fakeRepository()).installed()).resolves.toEqual([]);
  });
});
