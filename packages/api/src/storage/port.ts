/**
 * A porta de armazenamento de objetos.
 *
 * O resto do app enxerga só esta interface. Trocar o R2 por outro provedor é
 * escrever outro adaptador; nenhum service, router ou tela muda — é a mesma
 * ideia de `messaging/messenger.ts`, onde o canal de entrega é implementação e
 * não contrato.
 *
 * **A porta não devolve endereço, devolve bytes.** URL pré-assinada seria mais
 * barata em banda, e está fora de propósito: a §24.2 do requisito diz que anexo
 * não é acessível por endereço direto sem verificação de permissão, e a §13.3
 * pede registro de *cada* leitura. Link assinado é endereço direto e é lido
 * quantas vezes quiserem, sem passar por aqui de novo. Para o que é cifrado
 * pela aplicação ele nem funcionaria: entregaria texto cifrado a um navegador
 * que não tem a chave.
 */

/** Teto do arquivo do usuário. Documento escolar cabe; vídeo de aula não. */
export const MAX_OBJECT_BYTES = 10 * 1024 * 1024;

/** Sobra do envelope de cifragem: 12 bytes de IV mais 16 de etiqueta. */
export const ENCRYPTION_ENVELOPE_BYTES = 28;

/**
 * Teto do que chega ao adaptador — o mesmo arquivo, já cifrado.
 *
 * São dois tetos porque o corpo cresce entre uma camada e outra: o usuário
 * manda 10 MB, o invólucro de cifragem entrega 10 MB e 28 bytes. Com um teto
 * só, um arquivo no limite passaria pela validação de cima e seria recusado
 * pela de baixo, com uma mensagem sobre um tamanho que o usuário não escolheu.
 */
export const MAX_BODY_BYTES = MAX_OBJECT_BYTES + ENCRYPTION_ENVELOPE_BYTES;

export interface PutResult {
  key: string;
  /** Sem as aspas que o S3 devolve — o adaptador tira. */
  etag: string;
  size: number;
}

export interface ObjectContent extends PutResult {
  body: Buffer;
  contentType: string;
  metadata: Record<string, string>;
}

export interface ObjectHead extends PutResult {
  contentType: string;
  metadata: Record<string, string>;
  modifiedAt: Date;
}

export interface PutInput {
  key: string;
  body: Buffer;
  contentType: string;
  /**
   * Metadados do provedor. **Nunca dado pessoal.**
   *
   * O que identifica pessoa vive na tabela de metadados, sob controle de
   * acesso. Aqui vira cabeçalho HTTP, aparece em log de ferramenta e não é
   * coberto pela cifragem do corpo.
   */
  metadata?: Record<string, string>;
  /** Recusa com `ObjectAlreadyExistsError` em vez de sobrescrever. */
  onlyIfAbsent?: boolean;
}

export interface ListOptions {
  cursor?: string;
  limit?: number;
}

export interface KeyPage {
  keys: string[];
  /** `null` na última página. */
  cursor: string | null;
}

export interface ObjectStorage {
  put(input: PutInput): Promise<PutResult>;

  /**
   * Lança `ObjectNotFoundError` em vez de devolver `null`.
   *
   * São perguntas diferentes: quem chama `get` já decidiu que o objeto deve
   * existir — se não existe, é inconsistência entre banco e bucket, e engolir
   * isso num `null` empurra o erro para longe da causa. Quem quer saber se
   * existe chama `head`.
   */
  get(key: string): Promise<ObjectContent>;

  /** `null` quando não existe. É a consulta barata de existência. */
  head(key: string): Promise<ObjectHead | null>;

  /** `deleted: false` quando não havia nada ali — a revogação precisa saber. */
  delete(key: string): Promise<{ deleted: boolean }>;

  list(prefix: string, options?: ListOptions): Promise<KeyPage>;

  /**
   * Apaga tudo sob um prefixo.
   *
   * Existe para o encerramento de vínculo de uma escola e para a limpeza da
   * suíte de integração — as duas coisas que precisam de "some com tudo isto"
   * e que, sem um método, viram um laço copiado em dois lugares.
   */
  deletePrefix(prefix: string): Promise<{ deleted: number }>;
}

/**
 * Erros de infraestrutura, e não de domínio.
 *
 * Classes próprias, e não as de `errors.ts`, porque o storage não sabe se
 * "não encontrado" vira 404 para o usuário ou vira log de inconsistência. Quem
 * traduz é o service do módulo consumidor — do mesmo jeito que o repositório
 * não lança `TRPCError`.
 */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

export class ObjectNotFoundError extends StorageError {}
export class ObjectAlreadyExistsError extends StorageError {}
export class EmptyObjectError extends StorageError {}
export class ObjectTooLargeError extends StorageError {}
export class StorageUnavailableError extends StorageError {}

/**
 * Chave fora do prefixo da escola ativa.
 *
 * **Nunca deveria chegar ao usuário.** É falha de programação, como uma query
 * sem filtro de escola: vira 500 e alarme, não 400.
 */
export class KeyOutsideTenantError extends StorageError {}

/**
 * O que uma chave de objeto pode conter.
 *
 * Restritivo de propósito. A assinatura do S3 é sensível a como a chave é
 * escapada na URL, e caractere fora do ASCII imprimível é onde adaptador e
 * dublê passam a discordar em silêncio — a memória aceita qualquer string, o
 * R2 assina uma coisa e pede outra. Fora isso, `..` num caminho nunca é
 * inocente.
 */
const VALID_KEY = /^[A-Za-z0-9][A-Za-z0-9._\-/]*$/;

export function validateKey(key: string): void {
  if (!key) throw new StorageError("Chave de objeto vazia.");
  if (key.length > 1024) throw new StorageError("Chave de objeto acima de 1024 caracteres.");
  if (!VALID_KEY.test(key)) {
    throw new StorageError(`Chave de objeto inválida: ${JSON.stringify(key)}`);
  }
  if (key.includes("//") || key.split("/").includes("..") || key.endsWith("/")) {
    throw new StorageError(`Chave de objeto inválida: ${JSON.stringify(key)}`);
  }
}

/** Mesma regra da chave, mas o prefixo pode terminar em barra (e deve). */
export function validatePrefix(prefix: string): void {
  if (!prefix) throw new StorageError("Prefixo vazio: isso listaria o bucket inteiro.");
  validateKey(prefix.endsWith("/") ? prefix.slice(0, -1) : prefix);
}

/**
 * Metadado do S3 vira cabeçalho HTTP: a chave volta em minúsculas e o valor
 * precisa ser ASCII.
 *
 * Normalizar aqui, e não em cada adaptador, é o que impede o dublê de mentir:
 * sem isto, gravar `{ Origem: "x" }` devolveria `Origem` na memória e `origem`
 * no R2, e o teste que passa no CI quebraria em produção.
 */
export function normalizeMetadata(
  metadata: Record<string, string> | undefined,
): Record<string, string> {
  const normalized: Record<string, string> = {};

  for (const [rawName, value] of Object.entries(metadata ?? {})) {
    const name = rawName.toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
      throw new StorageError(`Nome de metadado inválido: ${JSON.stringify(rawName)}`);
    }
    // Só ASCII imprimível: acento no valor faz a assinatura do S3 discordar do
    // que foi enviado, e o erro chega como falha de rede sem explicação.
    if (!/^[\x20-\x7e]*$/.test(value)) {
      throw new StorageError(`Metadado ${name} tem caractere fora do ASCII imprimível.`);
    }
    normalized[name] = value;
  }

  return normalized;
}

/** O teto do arquivo do usuário, antes de cifrar. */
export function validateBody(body: Buffer): void {
  if (body.length === 0) throw new EmptyObjectError("O arquivo chegou vazio.");
  if (body.length > MAX_OBJECT_BYTES) {
    throw new ObjectTooLargeError(
      `O arquivo passa de ${Math.floor(MAX_OBJECT_BYTES / 1024 / 1024)} MB.`,
    );
  }
}

/** O teto do que chega ao adaptador — o arquivo já com o envelope de cifragem. */
export function validateAdapterBody(body: Buffer): void {
  if (body.length === 0) throw new EmptyObjectError("O arquivo chegou vazio.");
  if (body.length > MAX_BODY_BYTES) {
    throw new ObjectTooLargeError(
      `O arquivo passa de ${Math.floor(MAX_OBJECT_BYTES / 1024 / 1024)} MB.`,
    );
  }
}
