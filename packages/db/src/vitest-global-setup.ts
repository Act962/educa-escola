import { ensureTestDatabase } from "./testing";

/** globalSetup do Vitest: garante banco de teste criado e migrado. */
export default async function setup(): Promise<void> {
  await ensureTestDatabase();
}
