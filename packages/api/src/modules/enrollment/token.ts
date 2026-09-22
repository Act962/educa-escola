import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * O token do link de confirmação.
 *
 * Só o hash vai para o banco: um dump não produz um link funcionando. É a
 * mesma lógica de senha.
 *
 * Não assinamos o token (HMAC) porque um valor autocontido não sabe ser
 * revogado nem consumido, e uso único e revogação são requisitos daqui. Com
 * linha em banco, "vencido", "já usado" e "revogado" são consultas — e não
 * precisamos de mais um segredo no ambiente.
 */

/** 256 bits. Nada derivado de id, nome ou data: o token não infere nada. */
const TOKEN_BYTES = 32;

/** Tentativas de conferência antes de o convite morrer. */
export const MAX_VERIFICATION_ATTEMPTS = 5;

/** Validade padrão do link, em dias. */
export const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Janela entre conferir a data e enviar a ficha.
 *
 * Não criamos sessão para o responsável — ele não tem conta. A janela curta é
 * o que limita o estrago de um celular emprestado com a página aberta.
 */
export const VERIFICATION_WINDOW_MS = 30 * 60 * 1000;

export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Monta o endereço público a partir da base configurada. */
export function enrollmentLinkFor(baseUrl: string, token: string): string {
  return new URL(`/matricula/${token}`, baseUrl).toString();
}

/**
 * Compara a data de nascimento digitada com a cadastrada.
 *
 * Tempo constante não é o que protege aqui — o contador de tentativas é —, mas
 * comparar assim custa nada e evita que o formato do vazamento dependa de onde
 * as strings divergem.
 */
export function birthDateMatches(expected: string | null, given: string): boolean {
  if (!expected) return false;

  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

export interface InviteState {
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  lockedAt: Date | null;
  verifiedAt: Date | null;
  attempts: number;
}

export type InviteVerdict = "valido" | "vencido" | "consumido" | "revogado" | "bloqueado";

/** Por que o link não serve mais — ou `valido`, se serve. */
export function inviteVerdict(invite: InviteState, now: Date): InviteVerdict {
  if (invite.revokedAt) return "revogado";
  if (invite.consumedAt) return "consumido";
  if (invite.lockedAt || invite.attempts >= MAX_VERIFICATION_ATTEMPTS) return "bloqueado";
  if (invite.expiresAt.getTime() <= now.getTime()) return "vencido";
  return "valido";
}

/** A conferência ainda vale? Passada a janela, o responsável confere de novo. */
export function verificationIsFresh(verifiedAt: Date | null, now: Date): boolean {
  if (!verifiedAt) return false;
  return now.getTime() - verifiedAt.getTime() < VERIFICATION_WINDOW_MS;
}

export function expiryFrom(now: Date, days: number = DEFAULT_EXPIRY_DAYS): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * Protocolo mostrado ao responsável no fim.
 *
 * Deriva do id da matrícula, então é estável: reabrir o link mostra o mesmo
 * número. Não é segredo — serve para a família citar ao telefone.
 */
export function protocolFor(enrollmentId: string, academicYear: number): string {
  const tail = createHash("sha256").update(enrollmentId).digest("hex").slice(0, 4).toUpperCase();
  return `${academicYear}-${enrollmentId.slice(0, 4).toUpperCase()}-${tail}`;
}
