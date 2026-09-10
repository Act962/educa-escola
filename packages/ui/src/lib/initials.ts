/**
 * "Ana Clara Souza Lima" -> "AC".
 *
 * As duas **primeiras** palavras, e não a primeira com a última: no Brasil o
 * nome de tratamento está no começo ("Ana Clara"), enquanto o fim costuma ser
 * o sobrenome de família, que se repete entre irmãos.
 */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}
