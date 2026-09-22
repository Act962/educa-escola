/** Erros de domínio, traduzidos para códigos tRPC na borda (router). */

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "CONFLICT" | "NOT_FOUND" | "BAD_REQUEST" | "EXPIRED" | "TOO_MANY_ATTEMPTS",
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

export class NotFoundError extends DomainError {
  constructor(message: string) {
    super(message, "NOT_FOUND");
  }
}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message, "BAD_REQUEST");
  }
}

/**
 * Link de confirmação que existiu e não vale mais: vencido, já usado ou
 * revogado.
 *
 * Separado de `NotFoundError` de propósito. Token desconhecido responde 404
 * uniforme, para não deixar enumerar; mas quem chega aqui já possui aquele
 * token específico, e precisa ler "peça um novo à secretaria" em vez de "não
 * encontrado" — que o faria achar que a matrícula sumiu.
 */
export class ExpiredError extends DomainError {
  constructor(message: string) {
    super(message, "EXPIRED");
  }
}

/** Tentativas de conferência esgotadas: o convite fica bloqueado. */
export class TooManyAttemptsError extends DomainError {
  constructor(message: string) {
    super(message, "TOO_MANY_ATTEMPTS");
  }
}

/**
 * Código do Postgres para violação de unicidade.
 *
 * Existe aqui porque a alternativa — consultar antes de inserir — tem corrida:
 * entre a consulta e o `insert`, outra requisição grava. O índice é a única
 * garantia real; isto só traduz o que ele disse.
 */
const UNIQUE_VIOLATION = "23505";

/**
 * O erro foi a violação deste índice único?
 *
 * **O Drizzle embrulha o erro do Postgres.** A mensagem do erro de fora é
 * `"Failed query: insert into …"`, e o nome da constraint só aparece no
 * `cause`. Procurar o nome em `erro.message` compila, parece certo e nunca
 * casa — foi exatamente o que um teste contra o Postgres real pegou aqui.
 * Por isso a busca percorre a cadeia de causas em vez de olhar um nível só.
 */
export function violatesUnique(error: unknown, constraint: string): boolean {
  let atual: unknown = error;

  for (let level = 0; level < 5 && atual; level += 1) {
    const candidato = atual as { code?: string; constraint?: string; cause?: unknown };
    if (candidato.code === UNIQUE_VIOLATION && candidato.constraint === constraint) return true;
    atual = candidato.cause;
  }

  return false;
}
