import { type Cifrado, decrypt, encrypt, parseKey } from "../../media/crypto";
import { COMANDO_DA_CHAVE } from "./instrucoes";

/**
 * A credencial do modelo, cifrada com a mesma máquina da foto do aluno.
 *
 * Reusa `encrypt`/`decrypt` de `media/crypto` — AES-256-GCM, com etiqueta de
 * autenticação — mas com **chave própria**. São segredos de ciclos diferentes:
 * girar a chave de mídia por causa de um incidente com foto não deve obrigar a
 * escola a recadastrar a credencial do modelo.
 */

/**
 * A mensagem diz só o que falta.
 *
 * A primeira versão mandava declarar a variável em três lugares — copiada do
 * helper da foto, escrito quando nenhum dos três existia. Aqui
 * `packages/env/src/server.ts` e o `turbo.json` já a declaram; o que falta é
 * o valor no `.env` da instalação. Instrução com dois passos desnecessários
 * manda quem lê procurar defeito onde não há, e o terceiro passo — reiniciar
 * — é o que de fato faltava, porque o `.env` é lido uma vez, na subida.
 */
export function chaveDoAssistente(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "ASSISTANT_ENCRYPTION_KEY não está no ambiente. Rode " +
        `\`${COMANDO_DA_CHAVE}\` ` +
        "e reinicie o servidor — o .env é lido só na subida.",
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

/**
 * A credencial gravada abre com a chave que o servidor tem agora?
 *
 * Existe por um cenário concreto e recorrente: **girar
 * `ASSISTANT_ENCRYPTION_KEY`**. O texto cifrado continua no banco, íntegro, e
 * simplesmente não abre mais — o GCM autentica, então a etiqueta não bate e o
 * `decipher` lança.
 *
 * Sem esta checagem, a escola só descobre na primeira pergunta, e descobre
 * como erro 500: a exceção do `node:crypto` não é erro de domínio e sai como
 * falha nossa. Com ela, a tela avisa antes e diz o que fazer — regravar a
 * credencial.
 */
export function credencialAbre(dados: Cifrado | null, raw: string | undefined): boolean {
  if (!dados || !raw) return false;

  try {
    decifrarCredencial(dados, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa o que veio do campo antes de cifrar.
 *
 * A credencial costuma ser copiada de um arquivo `.env`, e junto vem o nome da
 * variável: `OPENAI_API_KEY=sk-proj-…`. Cifrado assim, o valor fica íntegro,
 * abre certinho, e o provedor responde `invalid_api_key` — um erro que aponta
 * para a chave quando o defeito é a colagem, e que já custou uma investigação
 * inteira aqui.
 *
 * Tira também aspas em volta, porque o `.env` aceita as duas formas, e
 * qualquer espaço ou quebra de linha que o navegador tenha trazido junto.
 * Nada disso é parte de credencial de provedor nenhum: se um dia for, o valor
 * chega quebrado de propósito e a escola vê o erro na hora de salvar.
 */
export function limparCredencial(valor: string): string {
  const semNome = valor.trim().replace(/^[A-Z][A-Z0-9_]*\s*=\s*/, "");
  return semNome.replace(/^(['"])(.*)\1$/s, "$2").trim();
}
