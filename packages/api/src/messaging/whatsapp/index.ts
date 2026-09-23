import { env } from "@educa-escola/env/server";

import { createCloudChannel } from "./cloud";
import { createMemoryChannel } from "./memory";
import { CredencialRecusadaError, type WhatsAppChannel } from "./port";

export type WhatsAppProvider = "cloud" | "memoria";

export interface CanalConfig {
  provider: WhatsAppProvider;
  /**
   * Quem é o dono deste canal — na prática, o id da conta.
   *
   * Só o dublê usa: é o que mantém os modelos de uma escola separados dos de
   * outra durante a simulação. No adaptador da Meta a separação já vem do
   * `wabaId`, que é a conta de verdade.
   */
  chave?: string | null;
  phoneNumberId?: string | null;
  wabaId?: string | null;
  /** Já decifrado. Quem decifra é `modules/whatsapp/secret.ts`. */
  token?: string | null;
  apiVersion?: string;
}

/**
 * Escolhe o adaptador e confere a configuração.
 *
 * A conferência mora aqui, e não no schema do `@educa-escola/env`, pelo mesmo
 * motivo de `createStorage`: ela é cruzada. `phoneNumberId`, `wabaId` e token
 * são obrigatórios **se** o provedor for `cloud`, e irrelevantes se for o
 * dublê. E são por escola, não do ambiente — duas escolas na mesma instalação
 * têm números diferentes.
 *
 * Falha com a frase que manda a direção para a tela certa. Um `fetch` com
 * `Bearer null` devolveria 401 da Meta, e a escola leria "credencial recusada"
 * quando o defeito é campo em branco.
 */
export function criarCanal(config: CanalConfig): WhatsAppChannel {
  const driver = driverEfetivo(config.provider);

  if (driver === "memoria") return dubleDe(config.chave ?? "padrao");

  const faltando = (
    [
      [config.phoneNumberId, "o ID do número"],
      [config.wabaId, "o ID da conta comercial (WABA)"],
      [config.token, "o token de acesso"],
    ] as const
  )
    .filter(([valor]) => !valor)
    .map(([, rotulo]) => rotulo);

  if (faltando.length > 0) {
    throw new CredencialRecusadaError(
      `Falta ${faltando.join(", ")} nas configurações do WhatsApp.`,
    );
  }

  return createCloudChannel({
    phoneNumberId: config.phoneNumberId as string,
    wabaId: config.wabaId as string,
    token: config.token as string,
    apiVersion: config.apiVersion ?? env.WHATSAPP_API_VERSION,
  });
}

/**
 * O dublê vive enquanto o processo viver.
 *
 * Um por chave, e **não um por requisição**, porque o estado dele é o roteiro
 * da demonstração: o modelo criado numa requisição precisa existir na
 * seguinte, quando alguém clica em enviar. Com uma instância por chamada, a
 * tela dizia "aprovado" — que é o estado gravado no nosso banco — e o envio
 * respondia "esse modelo não existe".
 *
 * Reinício do servidor esvazia tudo, e está certo: simulação não é dado, é
 * ensaio. Quem precisa de permanência usa a conta de verdade.
 */
const dubles = new Map<string, WhatsAppChannel>();

function dubleDe(chave: string): WhatsAppChannel {
  const existente = dubles.get(chave);
  if (existente) return existente;

  const novo = createMemoryChannel();
  dubles.set(chave, novo);
  return novo;
}

/** Só para teste: derruba os dublês entre casos. */
export function resetDubles(): void {
  dubles.clear();
}

/**
 * `WHATSAPP_DRIVER=memoria` força o dublê, mesmo em conta configurada como
 * `cloud`.
 *
 * É a chave da apresentação: mostrar o fluxo inteiro com credencial real
 * gravada, sem mandar mensagem para família nenhuma e sem gastar conversa.
 * Vale o inverso do storage — lá `memory` em produção é recusado, porque
 * perderia arquivo em silêncio; aqui ele **não manda**, que é falha visível na
 * hora e reversível tirando a variável.
 */
function driverEfetivo(doBanco: WhatsAppProvider): WhatsAppProvider {
  return env.WHATSAPP_DRIVER === "memoria" ? "memoria" : doBanco;
}

/** A escola está de fato mandando mensagem, ou está em simulação? */
export function emSimulacao(provider: WhatsAppProvider): boolean {
  return driverEfetivo(provider) === "memoria";
}

export type { CloudConfig } from "./cloud";
export { createCloudChannel } from "./cloud";
export type { EnvioRegistrado, MemoryChannel } from "./memory";
export { createMemoryChannel } from "./memory";
export * from "./port";
export * from "./template";
