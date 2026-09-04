import { createDb } from "@educa-escola/db";
import { member, organization, school } from "@educa-escola/db/schema";
import { eq } from "drizzle-orm";

import { auth } from "./index";

export interface ProvisionSchoolInput {
  name: string;
  slug: string;
  owner: { name: string; email: string; password: string };
  inepCode?: string;
}

/**
 * Provisiona uma escola e sua primeira pessoa responsável.
 *
 * Escolas não são criadas por auto-cadastro (`allowUserToCreateOrganization`
 * está desligado): quem provisiona é a plataforma, por aqui. A pessoa criada
 * entra como `owner`, e é ela que depois convida secretaria e professores.
 *
 * Idempotente pelo `slug`: rodar de novo não duplica escola.
 */
export async function provisionSchool(input: ProvisionSchoolInput) {
  const db = createDb();

  const [existing] = await db
    .select()
    .from(organization)
    .where(eq(organization.slug, input.slug))
    .limit(1);

  if (existing) {
    return { schoolId: existing.id, created: false as const };
  }

  const signUp = await auth.api.signUpEmail({
    body: {
      name: input.owner.name,
      email: input.owner.email,
      password: input.owner.password,
    },
  });

  const schoolId = crypto.randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(organization).values({
      id: schoolId,
      name: input.name,
      slug: input.slug,
      createdAt: new Date(),
    });

    // `school` compartilha a PK com `organization`.
    await tx.insert(school).values({ id: schoolId, inepCode: input.inepCode ?? null });

    await tx.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: schoolId,
      userId: signUp.user.id,
      role: "owner",
      createdAt: new Date(),
    });
  });

  return { schoolId, ownerId: signUp.user.id, created: true as const };
}
