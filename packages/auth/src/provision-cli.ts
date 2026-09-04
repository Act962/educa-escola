import { provisionSchool } from "./provision";

/**
 * Uso:
 *   pnpm --filter @educa-escola/auth run provision -- \
 *     --name "Escola Municipal X" --slug escola-x \
 *     --owner-email diretoria@escola-x.br --owner-password "senha-forte" \
 *     --owner-name "Maria Diretora"
 */
function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(`--${flag}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function required(flag: string): string {
  const value = arg(flag);
  if (!value) {
    console.error(`Faltou --${flag}`);
    process.exit(1);
  }
  return value;
}

const result = await provisionSchool({
  name: required("name"),
  slug: required("slug"),
  inepCode: arg("inep"),
  owner: {
    name: required("owner-name"),
    email: required("owner-email"),
    password: required("owner-password"),
  },
});

console.log(
  result.created
    ? `Escola provisionada: ${result.schoolId} (owner ${result.ownerId})`
    : `Escola já existia: ${result.schoolId}`,
);

process.exit(0);
