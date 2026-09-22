import { seedProducao } from "./seed-producao";
import { resolverPerfis } from "./seed-producao-data";

/**
 * Uso mínimo:
 *   pnpm run seed:producao -- \
 *     --name "Escola Municipal X" --slug escola-x --dominio escola-x.br
 *
 * Cria a escola e um acesso de cada tipo — direção (`owner`), secretaria
 * (`admin`), professor (`teacher`) e aluno (`student`) —, as oito disciplinas
 * da base e uma turma com o aluno matriculado nela.
 *
 * **As senhas são geradas aqui e mostradas uma única vez.** Não ficam no
 * código, não vão para o log do deploy em texto que alguém releia depois, e não
 * são recuperáveis: quem perder usa "esqueci minha senha". É o oposto do
 * `seed:demo`, que tem senha fixa e fraca porque a escola dele é fictícia.
 *
 * Opcionais:
 *   --inep 35012345
 *   --turma "6º A"            (padrão: "Turma A")
 *   --ano 2026                (padrão: ano corrente)
 *   --turno manha|tarde|noite (padrão: manha)
 *   --segmento infantil|fundamental_i|fundamental_ii|medio
 *   --serie 6
 *   --aluno-nascimento 2014-03-22
 *   --aluno-responsavel "Maria Souza"
 *   --email-direcao / --email-secretaria / --email-professor / --email-aluno
 *   --nome-direcao  / --nome-secretaria  / --nome-professor  / --nome-aluno
 *   --senha-direcao / --senha-secretaria / --senha-professor / --senha-aluno
 */
function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(`--${flag}`);
  const valor = index >= 0 ? process.argv[index + 1] : undefined;
  return valor?.startsWith("--") ? undefined : valor;
}

function required(flag: string): string {
  const valor = arg(flag);
  if (!valor) {
    console.error(`Faltou --${flag}`);
    process.exit(1);
  }
  return valor;
}

function falhar(mensagem: string): never {
  console.error(mensagem);
  process.exit(1);
}

const TURNOS = ["manha", "tarde", "noite"] as const;
const SEGMENTOS = ["infantil", "fundamental_i", "fundamental_ii", "medio"] as const;

const turno = (arg("turno") ?? "manha") as (typeof TURNOS)[number];
if (!TURNOS.includes(turno)) falhar(`--turno aceita ${TURNOS.join(", ")}`);

const segmento = arg("segmento") as (typeof SEGMENTOS)[number] | undefined;
if (segmento && !SEGMENTOS.includes(segmento)) {
  falhar(`--segmento aceita ${SEGMENTOS.join(", ")}`);
}

const serie = arg("serie");
if (serie && Number.isNaN(Number.parseInt(serie, 10))) falhar("--serie aceita um número");

const ano = Number.parseInt(arg("ano") ?? String(new Date().getFullYear()), 10);
if (Number.isNaN(ano)) falhar("--ano aceita um número de quatro dígitos");

let perfis: ReturnType<typeof resolverPerfis>;
try {
  perfis = resolverPerfis({
    dominio: arg("dominio"),
    emails: {
      direcao: arg("email-direcao"),
      secretaria: arg("email-secretaria"),
      professor: arg("email-professor"),
      aluno: arg("email-aluno"),
    },
    nomes: {
      direcao: arg("nome-direcao"),
      secretaria: arg("nome-secretaria"),
      professor: arg("nome-professor"),
      aluno: arg("nome-aluno"),
    },
    senhas: {
      direcao: arg("senha-direcao"),
      secretaria: arg("senha-secretaria"),
      professor: arg("senha-professor"),
      aluno: arg("senha-aluno"),
    },
  });
} catch (erro) {
  falhar(erro instanceof Error ? erro.message : String(erro));
}

const resultado = await seedProducao({
  name: required("name"),
  slug: required("slug"),
  inepCode: arg("inep"),
  perfis,
  turma: {
    name: arg("turma") ?? "Turma A",
    academicYear: ano,
    shift: turno,
    stage: segmento,
    gradeLevel: serie ? Number.parseInt(serie, 10) : undefined,
  },
  aluno: {
    birthDate: arg("aluno-nascimento"),
    guardianName: arg("aluno-responsavel"),
  },
});

console.log(
  resultado.escolaCriada
    ? `\nEscola criada: ${resultado.schoolId}`
    : `\nEscola já existia: ${resultado.schoolId} — só o que faltava foi acrescentado`,
);

console.log(
  `Disciplinas: ${resultado.disciplinas.criadas} criadas, ` +
    `${resultado.disciplinas.reaproveitadas} já existiam`,
);
console.log(`Turma: ${resultado.turma.name} (${resultado.turma.criada ? "criada" : "já existia"})`);
console.log(
  `Aluno de acesso: matrícula ${resultado.aluno.registration} ` +
    `(${resultado.aluno.criado ? "criado, matrícula ativa" : "já existia"})`,
);

console.log("\nAcessos — anote as senhas agora, elas não são exibidas de novo:\n");
for (const acesso of resultado.acessos) {
  const senha = acesso.senha ?? "(conta já existia — senha mantida)";
  console.log(`  ${acesso.rotulo.padEnd(22)} ${acesso.email.padEnd(34)} ${senha}`);
  if (acesso.papelPreexistente) {
    console.log(
      `    ⚠ vínculo já existia como "${acesso.papelPreexistente}"; o papel não foi alterado.`,
    );
  }
}

console.log("\nPeça a troca da senha no primeiro acesso.\n");

process.exit(0);
