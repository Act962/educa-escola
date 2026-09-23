import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import { findWorkspaceRoot } from "@educa-escola/env/load";
import dotenv from "dotenv";

import { resolverPerfis } from "./seed-producao-data";

/**
 * Uso mínimo:
 *   pnpm run seed:producao -- \
 *     --name "Escola Municipal X" --slug escola-x --dominio escola-x.br
 *
 * Para apontar para outro banco que não o do `apps/web/.env` — um Postgres
 * local de testes, uma cópia de homologação —, passe `--env-file`:
 *
 *   pnpm run seed:producao -- --env-file apps/web/.env.local \
 *     --name "Escola de Testes" --slug escola-teste --dominio escola-teste.br
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
 *   --env-file apps/web/.env.local
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

/**
 * O `--env-file` precisa ser lido **antes** de tudo, e é por isso que o seed
 * entra por `import()` no fim do arquivo.
 *
 * `@educa-escola/env` valida o ambiente no carregamento do módulo, e
 * `seed-producao.ts` puxa a configuração da auth, que puxa o env. Um `import`
 * estático lá em cima seria avaliado antes desta linha, e o comando abriria
 * conexão com o banco do `apps/web/.env` — justamente o que a flag existe para
 * evitar. Apontar para o banco errado é o erro que este arquivo mais precisa
 * tornar impossível.
 *
 * `override: true` porque o arquivo pedido na linha de comando ganha do que já
 * estiver no ambiente: o contrário faria a flag ser silenciosamente ignorada
 * em quem exporta `DATABASE_URL` no shell.
 */
const envFile = arg("env-file");
if (envFile) {
  const caminho = resolverEnvFile(envFile);

  const { error } = dotenv.config({ path: caminho, override: true, quiet: true });
  if (error) falhar(`Não consegui ler ${caminho}: ${error.message}`);

  console.log(`Ambiente: ${caminho}`);
}

/**
 * Aceita o caminho relativo ao cwd **ou** à raiz do workspace.
 *
 * O comando é escrito da raiz (`--env-file apps/web/.env.local`), mas o pnpm
 * roda o script com o cwd em `packages/auth`: resolver só pelo cwd fazia o
 * caminho que está na documentação não existir.
 */
function resolverEnvFile(valor: string): string {
  const root = findWorkspaceRoot();
  const candidatos = [resolve(process.cwd(), valor), ...(root ? [join(root, valor)] : [])];

  const achado = candidatos.find((caminho) => existsSync(caminho));
  if (achado) return achado;

  falhar(`Não achei o arquivo de ambiente. Procurei em:\n  ${candidatos.join("\n  ")}`);
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

// Depois do `--env-file`, nunca antes: ver o comentário acima.
const { seedProducao } = await import("./seed-producao");

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
