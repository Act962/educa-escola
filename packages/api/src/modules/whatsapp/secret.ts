import { decrypt, type Encrypted, encrypt, parseKey } from "../../media/crypto";

/**
 * O token do WhatsApp, cifrado com a mesma máquina da foto do aluno.
 *
 * Reusa `encrypt`/`decrypt` de `media/crypto` — AES-256-GCM, com etiqueta de
 * autenticação — com **chave própria**, `WHATSAPP_ENCRYPTION_KEY`. A razão é a
 * mesma registrada no Astro: são segredos de ciclos diferentes, e girar um por
 * incidente não deve obrigar a recadastrar os outros.
 *
 * O que está em jogo aqui é maior que dinheiro. Um token de WhatsApp Business
 * vazado manda mensagem **em nome da escola** para a lista de famílias dela —
 * e quem recebe não tem como saber que não foi a escola.
 */

export const KEY_COMMAND =
  "printf '\\nWHATSAPP_ENCRYPTION_KEY=%s\\n' \"$(openssl rand -base64 32)\" >> apps/web/.env";

export function whatsappKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "WHATSAPP_ENCRYPTION_KEY não está no ambiente. Rode " +
        `\`${KEY_COMMAND}\` ` +
        "e reinicie o servidor — o .env é lido só na subida.",
    );
  }
  return parseKey(raw);
}

export function encryptSecret(valor: string, raw: string | undefined): Encrypted {
  return encrypt(Buffer.from(valor, "utf8"), whatsappKey(raw));
}

export function decryptSecret(data: Encrypted, raw: string | undefined): string {
  return decrypt(data, whatsappKey(raw)).toString("utf8");
}

/**
 * Os últimos quatro caracteres, para a tela dizer *qual* token está gravado.
 *
 * Token da Meta tem centenas de caracteres e todos começam igual (`EAA…`): os
 * quatro do fim são o único trecho que distingue um do outro à vista. Quatro
 * não reconstroem nada.
 */
export function secretHint(valor: string): string {
  return valor.length >= 12 ? `••••${valor.slice(-4)}` : "••••";
}

/**
 * O que está gravado abre com a chave que o servidor tem agora?
 *
 * Existe pelo cenário de girar a chave: o texto cifrado continua no banco,
 * íntegro, e simplesmente não abre mais — o GCM autentica, a etiqueta não bate
 * e o `decipher` lança. Sem esta checagem a escola só descobre no primeiro
 * envio, e descobre como erro 500.
 */
export function secretOpens(data: Encrypted | null, raw: string | undefined): boolean {
  if (!data || !raw) return false;

  try {
    decryptSecret(data, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa o que veio do campo antes de cifrar.
 *
 * O token é copiado do painel da Meta ou de um `.env`, e junto vêm o nome da
 * variável, aspas e quebras de linha que o navegador trouxe. Cifrado assim o
 * valor fica íntegro, abre certinho, e a Meta responde 401 — um erro que
 * aponta para a credencial quando o defeito é a colagem.
 */
export function clearSecret(valor: string): string {
  const semNome = valor.trim().replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "");
  return semNome.replace(/^(['"])(.*)\1$/s, "$2").trim();
}

/** As três colunas do banco viram o envelope que `decrypt` entende. */
export function envelope(
  cipher: string | null,
  iv: string | null,
  tag: string | null,
): Encrypted | null {
  return cipher && iv && tag ? { cipher, iv, authTag: tag } : null;
}
