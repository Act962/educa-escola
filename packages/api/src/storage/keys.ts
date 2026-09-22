import { randomBytes } from "node:crypto";

import { StorageError, validateKey } from "./port";

/**
 * A chave do objeto no bucket.
 *
 * ```
 * escolas/{schoolId}/{domínio}/{entityId}/{ulid}
 * ```
 *
 * Os segmentos fixos ficam em português (`escolas`, `alunos`, `documentos`)
 * porque são **dado gravado**, não código: eles entram na chave que vai ao
 * bucket e à coluna `storage_key`, e seguem a mesma convenção dos valores de
 * enum do banco (`biometria`, `foto_aberta`, `documentacao_pendente`).
 * Traduzi-los depois seria migração de dado, não renomeação.
 *
 * Quatro decisões, e cada uma tem motivo:
 *
 * - **O `schoolId` vem primeiro.** Permite token do R2 escopado por prefixo,
 *   torna "apague tudo desta escola" uma operação de prefixo, e faz o
 *   vazamento entre escolas exigir uma chave visivelmente errada em vez de um
 *   filtro ausente.
 * - **A chave não carrega o nome original do arquivo.** `laudo-joao-tdah.pdf`
 *   é dado pessoal sensível escrito no nome; o nome original vai na tabela de
 *   metadados, sob o mesmo controle de acesso do resto.
 * - **A chave não carrega extensão.** Extensão no fim convida a servir o objeto
 *   pelo que o nome diz em vez de pelo `contentType` que foi gravado.
 * - **A chave nunca vem da entrada do usuário.** Quem monta é este arquivo, a
 *   partir do tenant e do id da entidade — igual ao `schoolId` da criação vir
 *   sempre do tenant, nunca do `input`.
 */

/**
 * De que parte do produto o arquivo é.
 *
 * União fechada, e não `string`, porque o segundo nível da chave é o que
 * separa "documento do aluno" de "material de aula" numa varredura de órfãos.
 * Domínio novo é uma linha aqui, e a linha é o momento de perguntar se o
 * arquivo é mesmo de uma família nova.
 */
export const FILE_DOMAINS = [
  "alunos",
  "documentos",
  "comunicados",
  "atividades",
  "materiais",
  "instituicao",
] as const;

export type FileDomain = (typeof FILE_DOMAINS)[number];

/**
 * O prefixo da escola. **Termina em barra, e isso não é cosmético.**
 *
 * Sem a barra, a escola de id `abc` daria `escolas/abc`, que é prefixo de
 * `escolas/abc2/...` — o isolamento entre duas escolas cujos ids compartilham
 * o começo cairia sem que nada acusasse.
 */
export function schoolPrefix(schoolId: string): string {
  validateSegment(schoolId, "schoolId");
  return `escolas/${schoolId}/`;
}

export function domainPrefix(schoolId: string, domain: FileDomain): string {
  return `${schoolPrefix(schoolId)}${domain}/`;
}

export function entityPrefix(schoolId: string, domain: FileDomain, entityId: string): string {
  validateSegment(entityId, "entityId");
  return `${domainPrefix(schoolId, domain)}${entityId}/`;
}

export interface BuildKeyInput {
  schoolId: string;
  domain: FileDomain;
  entityId: string;
  /** Só para teste: normalmente o ULID é sorteado na hora. */
  suffix?: string;
}

export function buildKey(input: BuildKeyInput): string {
  const key = `${entityPrefix(input.schoolId, input.domain, input.entityId)}${
    input.suffix ?? ulid()
  }`;
  validateKey(key);
  return key;
}

/** Cada nível da chave é um id nosso; nada de barra, ponto-ponto ou acento. */
export function validateSegment(value: string, field: string): void {
  if (!value) throw new StorageError(`${field} vazio ao montar chave de objeto.`);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) {
    throw new StorageError(`${field} inválido para chave de objeto: ${JSON.stringify(value)}`);
  }
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * ULID: 10 caracteres de tempo, 16 de acaso, base32 de Crockford.
 *
 * Aqui e não `crypto.randomUUID()` — que é o id de toda tabela — porque ULID
 * ordena por tempo como texto, e `list` com prefixo devolve em ordem
 * lexicográfica. A varredura de órfãos precisa de "os mais antigos primeiro", e
 * com UUID isso exigiria ir ao banco buscar a data de cada objeto.
 *
 * Os 16 bytes de acaso viram caractere por `% 32`, e 256 é múltiplo de 32 — a
 * conta é uniforme, sem o viés que um alfabeto de tamanho diferente traria.
 */
export function ulid(now: Date = new Date()): string {
  let time = now.getTime();
  const chars = new Array<string>(26);

  for (let i = 9; i >= 0; i -= 1) {
    chars[i] = CROCKFORD[time % 32] as string;
    time = Math.floor(time / 32);
  }

  const random = randomBytes(16);
  for (let i = 0; i < 16; i += 1) {
    chars[10 + i] = CROCKFORD[(random[i] as number) % 32] as string;
  }

  return chars.join("");
}
