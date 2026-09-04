import { organization, school, user } from "@educa-escola/db/schema";
import type { TestTransaction } from "@educa-escola/db/testing";

/**
 * Cria uma escola completa (organization + perfil de domínio).
 *
 * Ids aleatórios de propósito: os arquivos de teste rodam em paralelo contra
 * o mesmo banco, cada um na sua transação, e nomes fixos colidiriam nos
 * índices únicos.
 */
export async function createTestSchool(tx: TestTransaction, name = "Escola Teste") {
  const id = crypto.randomUUID();

  await tx.insert(organization).values({
    id,
    name,
    slug: `escola-${id.slice(0, 8)}`,
    createdAt: new Date(),
  });
  await tx.insert(school).values({ id });

  return { id, name };
}

export async function createTestUser(tx: TestTransaction, email?: string) {
  const id = crypto.randomUUID();

  await tx.insert(user).values({
    id,
    name: "Pessoa Teste",
    email: email ?? `teste-${id.slice(0, 8)}@example.com`,
    emailVerified: true,
  });

  return { id };
}
