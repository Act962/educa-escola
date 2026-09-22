import { type Cifrado, decrypt, encrypt, parseKey } from "../../media/crypto";

/**
 * A credencial do modelo, cifrada com a mesma máquina da foto do aluno.
 *
 * Reusa `encrypt`/`decrypt` de `media/crypto` — AES-256-GCM, com etiqueta de
 * autenticação — mas com **chave própria**. São segredos de ciclos diferentes:
 * girar a chave de mídia por causa de um incidente com foto não deve obrigar a
 * escola a recadastrar a credencial do modelo.
 */

export function chaveDoAssistente(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "ASSISTANT_ENCRYPTION_KEY não está configurada. Gere com `openssl rand -base64 32` " +
        "e declare em apps/web/.env, em packages/env/src/server.ts e no turbo.json.",
    );
  }
  return parseKey(raw);
}

export function cifrarCredencial(valor: string, raw: string | undefined): Cifrado {
  return encrypt(Buffer.from(valor, "utf8"), chaveDoAssistente(raw));
}

export function decifrarCredencial(dados: Cifrado, raw: string | undefined): string {
  return decrypt(dados, chaveDoAssistente(raw)).toString("utf8");
}

/**
 * Os últimos quatro caracteres, para a tela dizer *qual* chave está gravada.
 *
 * Quatro não reconstroem nada, e são o bastante para a direção reconhecer a
 * própria credencial. Chave curta demais devolve só pontos: mostrar metade de
 * um segredo de oito caracteres seria mostrar metade do segredo.
 */
export function dicaDaCredencial(valor: string): string {
  return valor.length >= 12 ? `••••${valor.slice(-4)}` : "••••";
}
