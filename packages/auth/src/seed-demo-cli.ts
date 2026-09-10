import { seedDemoSchool } from "./seed-demo";

/**
 * Uso:
 *   pnpm run seed:demo
 *
 * Cria (ou regrava) a escola de demonstração com turmas, alunos, aulas,
 * chamadas, avaliações e notas coerentes entre si. As aulas são geradas em
 * torno de hoje, então rode no dia em que for demonstrar.
 */
const result = await seedDemoSchool();

console.log(`\nEscola de demonstração pronta: ${result.schoolId}`);
console.log(
  `${result.counts.alunos} alunos · ${result.counts.aulas} aulas · ` +
    `${result.counts.chamadas} chamadas · ${result.counts.notas} notas\n`,
);

console.log("Acessos:");
for (const login of result.logins) {
  console.log(`  ${login.perfil.padEnd(20)} ${login.email}  senha: ${login.senha}`);
}
console.log("");

process.exit(0);
