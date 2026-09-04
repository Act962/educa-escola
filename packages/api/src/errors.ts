/** Erros de domínio, traduzidos para códigos tRPC na borda (router). */

export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: "CONFLICT" | "NOT_FOUND" | "BAD_REQUEST",
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
