import { ValidationError } from "../../errors";

/**
 * A entrega da identidade da escola ao Órbita.
 *
 * **A direção é Integra → Órbita.** Quem é dono das pessoas da escola é este
 * sistema: a secretaria provisiona as contas e não há auto-cadastro. Se o
 * Órbita fosse o provedor, um professor precisaria de conta lá para usar o
 * sistema da escola.
 *
 * A pessoa abre um app já logada aqui; o que viaja é um token de uso único que
 * o Órbita troca por sessão local. Nenhuma senha atravessa, nenhuma segunda
 * conta é criada com credencial própria — e revogar acesso continua sendo uma
 * coisa só, num lugar só.
 */

export interface HandoffInput {
  /** A organização da escola no Órbita, do `orbita_workspace`. */
  orbitaOrganizationId: string;
  /** Qual app abrir. Ausente leva à raiz da conta. */
  appKey?: string;
  /** `true` pede ao Órbita o layout sem a navegação dele — para o embutido. */
  embedded?: boolean;
}

export interface OrbitaIdentity {
  /**
   * O endereço para abrir o Órbita já autenticado.
   *
   * Lança `ValidationError` quando não há como emitir — configuração ausente
   * ou sessão sem token. Devolver uma URL sem token mandaria a pessoa para uma
   * tela de login estranha, no meio do Integra.
   */
  handoffUrl(input: HandoffInput): Promise<string>;
}

/**
 * Monta o endereço. Separado da emissão para ser testável sem sessão.
 *
 * O token vai em `query` e não em fragmento porque quem precisa lê-lo é o
 * servidor do Órbita, não o navegador. Em compensação ele dura segundos e é de
 * uso único — o histórico do navegador guarda um token já queimado.
 */
export function buildHandoffUrl(input: {
  baseUrl: string;
  token: string;
  orbitaOrganizationId: string;
  appKey?: string;
  embedded?: boolean;
}): string {
  const url = new URL("/entrar", input.baseUrl);
  url.searchParams.set("token", input.token);
  url.searchParams.set("org", input.orbitaOrganizationId);
  if (input.appKey) url.searchParams.set("app", input.appKey);
  if (input.embedded) url.searchParams.set("embedded", "1");
  return url.toString();
}

export interface IdentityDeps {
  /** `ORBITA_BASE_URL`. Ausente = integração não configurada. */
  baseUrl: string | undefined;
  /**
   * Emite um token de uso único a partir da sessão ativa.
   *
   * Fecha sobre os headers da requisição em vez de recebê-los: com
   * `declaration: true` o tipo `Headers` vem do `undici-types` e não é
   * nomeável na emissão (TS2883) — a mesma razão de `getMembership`.
   */
  issueToken: () => Promise<string | null>;
}

export function createOrbitaIdentity(deps: IdentityDeps): OrbitaIdentity {
  return {
    async handoffUrl(input) {
      if (!deps.baseUrl) {
        throw new ValidationError(
          "A integração com o Órbita não está configurada nesta instalação.",
        );
      }

      const token = await deps.issueToken();
      if (!token) {
        throw new ValidationError("Não foi possível abrir o app. Entre de novo e tente.");
      }

      return buildHandoffUrl({ ...input, baseUrl: deps.baseUrl, token });
    },
  };
}

/**
 * Identidade de mentira, para teste e para desenvolvimento sem o Órbita no ar.
 *
 * Devolve uma URL com a forma certa e um token reconhecível: se ela vazar para
 * um ambiente de verdade, o Órbita a recusa e o token diz de onde veio.
 */
export function createStubIdentity(baseUrl = "https://orbita.exemplo.invalid"): OrbitaIdentity {
  return {
    async handoffUrl(input) {
      return buildHandoffUrl({ ...input, baseUrl, token: "token-de-mentira-do-integra" });
    },
  };
}
