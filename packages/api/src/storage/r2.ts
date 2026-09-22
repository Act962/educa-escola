import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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
  StorageUnavailableError,
  validateAdapterBody,
  validateKey,
  validatePrefix,
} from "./port";

/**
 * Adaptador do Cloudflare R2, pela API compatível com S3.
 *
 * **Este é o único arquivo do sistema que conhece o SDK da AWS**, e um teste de
 * arquitetura garante isso. O dia de trocar de provedor é o dia de escrever um
 * irmão deste arquivo, não de caçar `S3Client` pelo código.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Sobrescreve o endpoint padrão. Só para bucket com domínio próprio. */
  endpoint?: string;
  /**
   * `bucket/chave` no caminho, em vez de `bucket.` no domínio.
   *
   * O R2 quer o padrão (`false`): o endereço dele é
   * `bucket.{conta}.r2.cloudflarestorage.com`. A opção existe porque servidor
   * compatível com S3 em `localhost` não tem como resolver um subdomínio — é o
   * que permite apontar este mesmo adaptador para um S3 local durante o
   * desenvolvimento, sem escrever um terceiro adaptador para isso.
   */
  forcePathStyle?: boolean;
}

/** O R2 pagina em 1000 por requisição, e não aceita mais que isso. */
const MAX_PAGE_SIZE = 1000;

export function r2Endpoint(config: R2Config): string {
  return config.endpoint ?? `https://${config.accountId}.r2.cloudflarestorage.com`;
}

export function createR2Storage(config: R2Config): ObjectStorage {
  const client = new S3Client({
    // O SDK exige uma região e o R2 ignora. "auto" é o que a Cloudflare manda usar.
    region: "auto",
    endpoint: r2Endpoint(config),
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    /**
     * Desde a versão 3.729 o SDK acrescenta um checksum CRC32 em toda
     * requisição, e não só quando o serviço pede. É uma extensão da AWS que nem
     * todo provedor compatível com S3 implementa igual; deixar em
     * `WHEN_REQUIRED` mantém o tráfego no S3 que está de fato especificado, em
     * vez de depender de o R2 acompanhar cada extensão nova.
     */
    requestChecksumCalculation: "WHEN_REQUIRED",
    forcePathStyle: config.forcePathStyle ?? false,
  });

  function isNotFound(error: unknown): boolean {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const name = (error as { name?: string })?.name;
    return status === 404 || name === "NoSuchKey" || name === "NotFound";
  }

  /**
   * Traduz o erro do SDK.
   *
   * Sem isto, uma credencial errada chega ao usuário como um objeto do Smithy
   * com `$metadata` e nome de comando. `StorageUnavailableError` é o balde
   * certo para tudo que não seja "não existe": rede, credencial, 5xx e
   * permissão negada do token são todos "o bucket não respondeu ao que
   * pedimos", e quem precisa da distinção lê a causa, que vai junto.
   */
  function translateError(error: unknown, what: string): never {
    const status = (error as { $metadata?: { httpStatusCode?: number } })?.$metadata
      ?.httpStatusCode;
    const name = (error as { name?: string })?.name;

    if (isNotFound(error)) {
      throw new ObjectNotFoundError(`Objeto não encontrado: ${what}`, { cause: error });
    }
    if (status === 412 || name === "PreconditionFailed") {
      throw new ObjectAlreadyExistsError(`Já existe objeto em ${what}.`, { cause: error });
    }

    throw new StorageUnavailableError(`O armazenamento não respondeu (${what}).`, {
      cause: error,
    });
  }

  /** O S3 devolve o etag entre aspas; guardá-las vazaria o formato do provedor. */
  const stripQuotes = (etag: string | undefined) => (etag ?? "").replaceAll('"', "");

  async function head(key: string): Promise<ObjectHead | null> {
    validateKey(key);

    try {
      const output = await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));

      return {
        key,
        etag: stripQuotes(output.ETag),
        size: output.ContentLength ?? 0,
        contentType: output.ContentType ?? "application/octet-stream",
        metadata: output.Metadata ?? {},
        modifiedAt: output.LastModified ?? new Date(0),
      };
    } catch (error) {
      if (isNotFound(error)) return null;
      translateError(error, key);
    }
  }

  return {
    async put(input: PutInput): Promise<PutResult> {
      validateKey(input.key);
      validateAdapterBody(input.body);
      const metadata = normalizeMetadata(input.metadata);

      try {
        const output = await client.send(
          new PutObjectCommand({
            Bucket: config.bucket,
            Key: input.key,
            Body: input.body,
            ContentType: input.contentType,
            ContentLength: input.body.length,
            Metadata: metadata,
            // Escrita condicional do R2: `*` significa "só se não existir".
            // A alternativa — consultar antes de gravar — tem corrida, do mesmo
            // jeito que consultar antes de inserir tem (ver `violaUnico`).
            ...(input.onlyIfAbsent ? { IfNoneMatch: "*" } : {}),
          }),
        );

        return { key: input.key, etag: stripQuotes(output.ETag), size: input.body.length };
      } catch (error) {
        translateError(error, input.key);
      }
    },

    async get(key: string): Promise<ObjectContent> {
      validateKey(key);

      try {
        const output = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
        if (!output.Body) throw new ObjectNotFoundError(`Objeto sem conteúdo: ${key}`);

        const body = Buffer.from(await output.Body.transformToByteArray());

        return {
          key,
          etag: stripQuotes(output.ETag),
          size: body.length,
          body,
          contentType: output.ContentType ?? "application/octet-stream",
          metadata: output.Metadata ?? {},
        };
      } catch (error) {
        if (error instanceof ObjectNotFoundError) throw error;
        translateError(error, key);
      }
    },

    head,

    /**
     * Confere antes de apagar.
     *
     * O S3 responde 204 ao apagar tanto o que existia quanto o que não existia,
     * então não há como saber pelo `DeleteObject` sozinho. São duas idas à rede,
     * e valem a pena: a revogação da foto precisa registrar se havia foto, e
     * `deleted: true` sempre transformaria esse registro em ficção.
     */
    async delete(key: string) {
      const existing = await head(key);
      if (!existing) return { deleted: false };

      try {
        await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
        return { deleted: true };
      } catch (error) {
        translateError(error, key);
      }
    },

    async list(prefix: string, options?: ListOptions): Promise<KeyPage> {
      validatePrefix(prefix);

      try {
        const output = await client.send(
          new ListObjectsV2Command({
            Bucket: config.bucket,
            Prefix: prefix,
            MaxKeys: Math.min(options?.limit ?? MAX_PAGE_SIZE, MAX_PAGE_SIZE),
            ContinuationToken: options?.cursor,
          }),
        );

        return {
          keys: (output.Contents ?? []).flatMap((item) => (item.Key ? [item.Key] : [])),
          // `IsTruncated` é a única resposta confiável sobre haver mais: uma
          // página cheia pode ser a última, e um token vindo sem truncamento
          // faria a varredura de órfãos girar para sempre.
          cursor: output.IsTruncated ? (output.NextContinuationToken ?? null) : null,
        };
      } catch (error) {
        translateError(error, prefix);
      }
    },

    /**
     * Lista e apaga em lotes, sempre relistando da primeira página.
     *
     * Sem cursor de propósito: o que acabou de ser apagado saiu do caminho, e
     * paginar por cima de uma lista que encolhe a cada volta é exatamente como
     * se pula item. A lista vazia é a condição de parada, e ela só chega quando
     * não sobrou nada — o que também cobre objeto gravado no meio da varredura.
     */
    async deletePrefix(prefix: string) {
      validatePrefix(prefix);
      let deleted = 0;

      try {
        for (;;) {
          const output = await client.send(
            new ListObjectsV2Command({
              Bucket: config.bucket,
              Prefix: prefix,
              MaxKeys: MAX_PAGE_SIZE,
            }),
          );

          const keys = (output.Contents ?? []).flatMap((item) =>
            item.Key ? [{ Key: item.Key }] : [],
          );
          if (keys.length === 0) break;

          const result = await client.send(
            new DeleteObjectsCommand({
              Bucket: config.bucket,
              Delete: { Objects: keys, Quiet: true },
            }),
          );

          // Falha parcial precisa parar o laço. Sem isto, a chave que recusou
          // some da contagem mas não do bucket, e a próxima volta relista a
          // mesma chave para sempre.
          if (result.Errors?.length) {
            const first = result.Errors[0];
            throw new StorageUnavailableError(
              `Não foi possível apagar ${first?.Key}: ${first?.Message ?? "sem detalhe"}.`,
            );
          }

          deleted += keys.length;
        }
      } catch (error) {
        if (error instanceof StorageUnavailableError) throw error;
        translateError(error, prefix);
      }

      return { deleted };
    },
  };
}
