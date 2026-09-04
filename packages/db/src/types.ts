import type { createDb } from "./index";

export type Database = ReturnType<typeof createDb>;

export type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Aceita tanto a conexão normal quanto uma transação.
 *
 * Repositórios tipam por aqui para que o mesmo código rode em produção e
 * dentro da transação revertida dos testes.
 */
export type DbHandle = Database | Transaction;
