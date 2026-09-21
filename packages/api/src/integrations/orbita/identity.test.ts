import { describe, expect, it } from "vitest";

import { ValidationError } from "../../errors";
import { buildHandoffUrl, createOrbitaIdentity, createStubIdentity } from "./identity";

const BASE = "https://orbita.exemplo.com";
const ORG = "org-1";

describe("buildHandoffUrl", () => {
  it("leva organização e token", () => {
    const url = new URL(
      buildHandoffUrl({ baseUrl: BASE, token: "t-1", orbitaOrganizationId: ORG }),
    );

    expect(url.origin).toBe(BASE);
    expect(url.pathname).toBe("/entrar");
    expect(url.searchParams.get("org")).toBe(ORG);
    expect(url.searchParams.get("token")).toBe("t-1");
  });

  it("só leva app e embutido quando pedidos", () => {
    const semExtras = new URL(
      buildHandoffUrl({ baseUrl: BASE, token: "t", orbitaOrganizationId: ORG }),
    );
    expect(semExtras.searchParams.get("app")).toBeNull();
    expect(semExtras.searchParams.get("embedded")).toBeNull();

    const completo = new URL(
      buildHandoffUrl({
        baseUrl: BASE,
        token: "t",
        orbitaOrganizationId: ORG,
        appKey: "linnker",
        embedded: true,
      }),
    );
    expect(completo.searchParams.get("app")).toBe("linnker");
    expect(completo.searchParams.get("embedded")).toBe("1");
  });

  /** Base com caminho não pode engolir o `/entrar`. */
  it("respeita a base informada", () => {
    const url = buildHandoffUrl({
      baseUrl: "https://orbita.exemplo.com/",
      token: "t",
      orbitaOrganizationId: ORG,
    });
    expect(url.startsWith("https://orbita.exemplo.com/entrar?")).toBe(true);
  });

  it("escapa o que vai na query", () => {
    const url = new URL(
      buildHandoffUrl({
        baseUrl: BASE,
        token: "a b&c=d",
        orbitaOrganizationId: "org/1",
      }),
    );

    expect(url.searchParams.get("token")).toBe("a b&c=d");
    expect(url.searchParams.get("org")).toBe("org/1");
  });
});

describe("createOrbitaIdentity", () => {
  it("recusa quando a integração não está configurada", async () => {
    const identity = createOrbitaIdentity({
      baseUrl: undefined,
      issueToken: async () => "t",
    });

    await expect(identity.handoffUrl({ orbitaOrganizationId: ORG })).rejects.toThrow(
      ValidationError,
    );
  });

  /**
   * Devolver URL sem token mandaria a pessoa para uma tela de login estranha,
   * no meio do Integra, sem explicação.
   */
  it("recusa quando a sessão não produz token", async () => {
    const identity = createOrbitaIdentity({ baseUrl: BASE, issueToken: async () => null });

    await expect(identity.handoffUrl({ orbitaOrganizationId: ORG })).rejects.toThrow(
      /Entre de novo/,
    );
  });

  it("emite um token por chamada, não reaproveita", async () => {
    let contador = 0;
    const identity = createOrbitaIdentity({
      baseUrl: BASE,
      issueToken: async () => `t-${++contador}`,
    });

    const primeira = await identity.handoffUrl({ orbitaOrganizationId: ORG });
    const segunda = await identity.handoffUrl({ orbitaOrganizationId: ORG });

    expect(new URL(primeira).searchParams.get("token")).toBe("t-1");
    expect(new URL(segunda).searchParams.get("token")).toBe("t-2");
  });
});

describe("createStubIdentity", () => {
  /**
   * Se esta URL vazar para um ambiente de verdade, o Órbita a recusa e o token
   * diz de onde veio — em vez de falhar com "token inválido" sem pista.
   */
  it("usa domínio inválido e token reconhecível", async () => {
    const url = new URL(await createStubIdentity().handoffUrl({ orbitaOrganizationId: ORG }));

    expect(url.hostname.endsWith(".invalid")).toBe(true);
    expect(url.searchParams.get("token")).toContain("mentira");
  });
});
