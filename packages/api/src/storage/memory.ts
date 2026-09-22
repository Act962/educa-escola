import { createHash } from "node:crypto";

import type {
  KeyPage,
  ListOptions,
  ObjectContent,
  ObjectHead,
  ObjectStorage,
  PutInput,
  PutResult,
} from "./port";
import {
  normalizeMetadata,
  ObjectAlreadyExistsError,
  ObjectNotFoundError,
  validateAdapterBody,
  validateKey,
  validatePrefix,
} from "./port";

/**
 * Adaptador em memória.
 *
 * É o que roda em todo pull request. O CI não tem segredo do R2 e PR vindo de
 * fork nunca recebe — se o único caminho de teste fosse o bucket de verdade, a
 * suíte ficaria vermelha ou pulada justamente onde ela precisa falar.
 *
 * Por isso ele passa pela **mesma** suíte de contrato que o R2, e valida chave,
 * tamanho e metadado com as mesmas funções de `port.ts`. Dublê que aceita o que
 * o original recusa não é dublê, é uma segunda implementação mentindo — foi
 * pensando nisso que a normalização de metadado saiu daqui para a porta.
 */

interface StoredEntry {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
  etag: string;
  modifiedAt: Date;
}

/** O R2 pagina em 1000 no máximo; a memória imita para o cursor ser testável. */
const MAX_PAGE_SIZE = 1000;

export function createMemoryStorage(): ObjectStorage {
  const objects = new Map<string, StoredEntry>();

  return {
    async put(input: PutInput): Promise<PutResult> {
      validateKey(input.key);
      validateAdapterBody(input.body);
      const metadata = normalizeMetadata(input.metadata);

      if (input.onlyIfAbsent && objects.has(input.key)) {
        throw new ObjectAlreadyExistsError(`Já existe objeto em ${input.key}.`);
      }

      // Cópia na entrada: sem ela, quem gravou continua com uma referência ao
      // buffer guardado e pode alterá-lo depois. O R2 copia por natureza — é
      // rede —, e a diferença só apareceria em produção.
      const body = Buffer.from(input.body);
      const etag = createHash("md5").update(body).digest("hex");

      objects.set(input.key, {
        body,
        contentType: input.contentType,
        metadata,
        etag,
        modifiedAt: new Date(),
      });

      return { key: input.key, etag, size: body.length };
    },

    async get(key: string): Promise<ObjectContent> {
      validateKey(key);
      const stored = objects.get(key);
      if (!stored) throw new ObjectNotFoundError(`Objeto não encontrado: ${key}`);

      return {
        key,
        etag: stored.etag,
        size: stored.body.length,
        // Cópia na saída, pelo mesmo motivo da cópia na entrada.
        body: Buffer.from(stored.body),
        contentType: stored.contentType,
        metadata: { ...stored.metadata },
      };
    },

    async head(key: string): Promise<ObjectHead | null> {
      validateKey(key);
      const stored = objects.get(key);
      if (!stored) return null;

      return {
        key,
        etag: stored.etag,
        size: stored.body.length,
        contentType: stored.contentType,
        metadata: { ...stored.metadata },
        modifiedAt: stored.modifiedAt,
      };
    },

    async delete(key: string) {
      validateKey(key);
      return { deleted: objects.delete(key) };
    },

    async list(prefix: string, options?: ListOptions): Promise<KeyPage> {
      validatePrefix(prefix);
      const limit = Math.min(options?.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE);

      // Ordenado porque o S3 devolve em ordem lexicográfica, e é isso que faz
      // o cursor "continue depois desta chave" funcionar nos dois adaptadores.
      const candidates = [...objects.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .filter((key) => !options?.cursor || key > options.cursor);

      const keys = candidates.slice(0, limit);
      const last = keys.at(-1);

      return { keys, cursor: candidates.length > keys.length && last ? last : null };
    },

    async deletePrefix(prefix: string) {
      validatePrefix(prefix);
      let deleted = 0;
      for (const key of [...objects.keys()]) {
        if (key.startsWith(prefix) && objects.delete(key)) deleted += 1;
      }
      return { deleted };
    },
  };
}
