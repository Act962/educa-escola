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
