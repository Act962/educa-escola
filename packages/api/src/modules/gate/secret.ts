import { decrypt, type Encrypted, encrypt, parseKey } from "../../media/crypto";

/**
 * O molde facial, cifrado com a mesma máquina da foto do aluno.
 *
 * Mesma chave da foto, e não uma própria: os dois são a **mesma biometria da
 * mesma criança**, capturados no mesmo ato e revogados no mesmo gesto. Chaves
 * separadas dariam a impressão de que dá para girar uma sem a outra — e girar
 * só a da foto deixaria o molde abrindo, que é o vazamento que importa.
 */
export function templateKey(raw: string | undefined): Buffer {
  if (!raw) {
    throw new Error(
      "MEDIA_ENCRYPTION_KEY não está no ambiente. O molde facial não é gravado sem ela.",
    );
  }
  return parseKey(raw);
}

/**
 * O vetor vira JSON antes de cifrar.
 *
 * Formato de texto e não binário compacto de propósito: o molde é gravado uma
 * vez e lido em lote, então os bytes a mais não pesam, e um formato que se lê
 * num dump é um formato que alguém consegue auditar.
 */
export function encryptTemplate(descritor: readonly number[], raw: string | undefined): Encrypted {
  return encrypt(Buffer.from(JSON.stringify(descritor), "utf8"), templateKey(raw));
}

export function decryptTemplate(dados: Encrypted, raw: string | undefined): number[] {
  const texto = decrypt(dados, templateKey(raw)).toString("utf8");
  const valor: unknown = JSON.parse(texto);

  // Um molde que não é vetor de números viraria `NaN` na distância, e `NaN`
  // não é maior que o limiar — a comparação passaria batido em vez de falhar.
  if (!Array.isArray(valor) || valor.some((n) => typeof n !== "number" || !Number.isFinite(n))) {
    throw new Error("O molde gravado não é um vetor de números.");
  }
  return valor as number[];
}
