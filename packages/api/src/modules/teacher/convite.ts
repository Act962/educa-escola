import { createHash, randomBytes } from "node:crypto";

/**
 * O token do convite de professor.
 *
 * Mesma forma do convite de matrícula, e pelo mesmo motivo: **só o hash vai ao
 * banco**. Um dump de banco não produz link que funcione, e quem opera o
 * sistema não consegue entrar na conta de um professor pelo convite dele.
 *
 * 32 bytes porque este token é a única prova que o portador tem — não há data
 * de nascimento para conferir depois, como na matrícula. O que segura aqui é o
 * tamanho do segredo e o prazo.
 */
export function gerarToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function conviteDeProfessorFor(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, "")}/professor/${token}`;
}

export function prazoDe(agora: Date, dias: number): Date {
  return new Date(agora.getTime() + dias * 24 * 60 * 60 * 1000);
}
