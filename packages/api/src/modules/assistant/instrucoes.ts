/**
 * Textos de instrução que a **tela** também usa.
 *
 * Este arquivo não importa nada, e é essa a regra que importa: o cliente
 * consome estas constantes, e qualquer import aqui viaja para o navegador
 * junto. Foi o que aconteceu quando o comando morava em `segredo.ts` — ele
 * importa `media/crypto`, que importa `node:crypto`, e a tela de Configurações
 * quebrou inteira com "Module node:crypto has been externalized".
 */

/**
 * O comando que gera a chave de cifragem do assistente.
 *
 * `printf` com `\n` na frente, e não `echo … >>`, por causa de um defeito que
 * este projeto já sofreu: arquivo `.env` sem quebra de linha no fim faz o `>>`
 * **colar** a variável nova no fim da anterior. As duas ficam inválidas, e o
 * erro que aparece é o mesmo de antes — então quem seguiu a instrução conclui
 * que a instrução estava errada, e não que o arquivo ficou torto.
 *
 * O `\n` da frente custa, no pior caso, uma linha em branco.
 */
export const COMANDO_DA_CHAVE = `printf '\\nASSISTANT_ENCRYPTION_KEY=%s\\n' "$(openssl rand -base64 32)" >> apps/web/.env`;
