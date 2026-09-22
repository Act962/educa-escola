import { type Cifrado, decrypt, encrypt, parseKey } from "../../media/crypto";

/**
 * A credencial do modelo, cifrada com a mesma máquina da foto do aluno.
 *
 * Reusa `encrypt`/`decrypt` de `media/crypto` — AES-256-GCM, com etiqueta de
 * autenticação — mas com **chave própria**. São segredos de ciclos diferentes:
 * girar a chave de mídia por causa de um incidente com foto não deve obrigar a
 * escola a recadastrar a credencial do modelo.
 */

/**
 * O comando que gera a chave, num lugar só.
 *
 * `printf` com `\n` na frente, e não `echo … >>`, por causa de um defeito que
 * este projeto já sofreu: arquivo `.env` sem quebra de linha no fim faz o `>>`
 * **colar** a variável nova no fim da anterior. As duas ficam inválidas, e o
 * erro que aparece é o mesmo de antes — então quem seguiu a instrução conclui
 * que a instrução estava errada, e não que o arquivo é que ficou torto.
 *
 * O `\n` da frente custa, no pior caso, uma linha em branco.
 */
export const COMANDO_DA_CHAVE = `printf '\\nASSISTANT_ENCRYPTION_KEY=%s\\n' "$(openssl rand -base64 32)" >> apps/web/.env`;

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
