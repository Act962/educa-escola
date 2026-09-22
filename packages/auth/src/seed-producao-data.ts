/**
 * Os dados e as decisões do seed de produção, sem banco.
 *
 * Está separado de `seed-producao.ts` pelo mesmo motivo que
 * `seed-demo-data.ts`: aqui é tudo função pura, então a derivação de e-mail, a
 * geração de senha e a sequência de matrícula são testáveis sem subir Postgres.
 *
 * A diferença em relação ao seed de demonstração é o que **não** existe aqui:
 * nenhum aluno fictício, nenhuma nota, nenhuma aula. Produção recebe estrutura
 * — as pessoas de cada tipo de acesso, as disciplinas da base e uma turma —, e
 * o resto a escola cadastra. Dado inventado em banco de produção não se
 * distingue de dado real depois da primeira semana.
 */

import { randomInt } from "node:crypto";

import type { AppRole } from "./permissions";

/** Os quatro tipos de acesso do produto, na ordem em que aparecem no relatório. */
export type PerfilKey = "direcao" | "secretaria" | "professor" | "aluno";

export interface PerfilBase {
  key: PerfilKey;
  role: AppRole;
  /** Como o acesso é chamado na tela e na conversa, não no RBAC. */
  rotulo: string;
  /** Parte local do e-mail, quando ele é derivado do domínio da escola. */
  emailLocal: string;
  nomePadrao: string;
}

/**
 * Um acesso por papel do RBAC — e é por isso que são quatro e não três.
 *
 * As vias do produto são Gestão, Professor e Aluno, mas a Gestão tem dois
 * papéis com poderes diferentes: só a direção exclui a escola e instala app do
 * Órbita. Entregar uma conta só para a Gestão deixaria justamente a diferença
 * que importa sem ninguém para exercê-la.
 */
export const PERFIS: readonly PerfilBase[] = [
  {
    key: "direcao",
    role: "owner",
    rotulo: "Gestão — direção",
    emailLocal: "direcao",
    nomePadrao: "Direção",
  },
  {
    key: "secretaria",
    role: "admin",
    rotulo: "Gestão — secretaria",
    emailLocal: "secretaria",
    nomePadrao: "Secretaria",
  },
  {
    key: "professor",
    role: "teacher",
    rotulo: "Professor",
    emailLocal: "professor",
    nomePadrao: "Professor(a)",
  },
  {
    key: "aluno",
    role: "student",
    rotulo: "Aluno",
    emailLocal: "aluno",
    nomePadrao: "Aluno(a)",
  },
] as const;

/**
 * As disciplinas da base comum do fundamental.
 *
 * São as oito que qualquer escola de fundamental oferece, com sigla e área da
 * BNCC preenchidas: a sigla é o que cabe na grade horária e no boletim, e a
 * área é o agrupamento do relatório. A escola acrescenta eletiva e
 * complementar depois — `kind` fica no padrão `obrigatoria`.
 */
export const DISCIPLINAS_BASE: readonly { name: string; code: string; area: string }[] = [
  { name: "Língua Portuguesa", code: "LPO", area: "Linguagens" },
  { name: "Matemática", code: "MAT", area: "Matemática" },
  { name: "Ciências", code: "CIE", area: "Ciências da Natureza" },
  { name: "História", code: "HIS", area: "Ciências Humanas" },
  { name: "Geografia", code: "GEO", area: "Ciências Humanas" },
  { name: "Arte", code: "ART", area: "Linguagens" },
  { name: "Educação Física", code: "EDF", area: "Linguagens" },
  { name: "Inglês", code: "ING", area: "Linguagens" },
] as const;

/**
 * Alfabeto da senha gerada, **sem os pares que se confundem no papel**.
 *
 * Fora `O`/`0`, `I`/`l`/`1`: a senha do primeiro acesso é lida de uma tela e
 * digitada em outra, às vezes ditada por telefone, e caractere ambíguo vira
 * suporte no dia da entrega. Sobram 60 símbolos, ~5,9 bits por caractere.
 */
export const ALFABETO_SENHA = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Tamanho padrão: 16 caracteres deste alfabeto dão ~94 bits de entropia. */
export const TAMANHO_SENHA = 16;

/**
 * Senha aleatória para o primeiro acesso.
 *
 * `randomInt` e não `Math.random()`: é credencial, e o gerador precisa ser
 * criptográfico. Também não há viés de módulo — `randomInt` já sorteia no
 * intervalo pedido.
 */
export function senhaAleatoria(tamanho: number = TAMANHO_SENHA): string {
  let senha = "";
  for (let posicao = 0; posicao < tamanho; posicao += 1) {
    senha += ALFABETO_SENHA[randomInt(ALFABETO_SENHA.length)];
  }
  return senha;
}

export interface PerfilResolvido extends PerfilBase {
  nome: string;
  email: string;
  senha: string;
  /** Falso quando a senha veio por flag: o relatório não a repete no fim. */
  senhaGerada: boolean;
}

export interface ResolverPerfisInput {
  /** Domínio de e-mail da escola, para derivar o que não vier explícito. */
  dominio?: string;
  emails?: Partial<Record<PerfilKey, string>>;
  nomes?: Partial<Record<PerfilKey, string>>;
  senhas?: Partial<Record<PerfilKey, string>>;
}

/**
 * Fecha nome, e-mail e senha de cada tipo de acesso.
 *
 * O e-mail explícito ganha do derivado do domínio, e **a falta dos dois é
 * erro, não um endereço inventado**: e-mail é o que a pessoa digita para
 * entrar, e placeholder que ninguém recebe produz conta inacessível — que só
 * aparece no dia em que a direção tenta o primeiro login.
 */
export function resolverPerfis(input: ResolverPerfisInput): PerfilResolvido[] {
  const dominio = input.dominio?.trim().replace(/^@/, "").toLowerCase();

  return PERFIS.map((perfil) => {
    const explicito = input.emails?.[perfil.key]?.trim().toLowerCase();
    const email = explicito || (dominio ? `${perfil.emailLocal}@${dominio}` : undefined);

    if (!email) {
      throw new Error(
        `Sem e-mail para o acesso "${perfil.rotulo}": passe --dominio ou --email-${perfil.key}.`,
      );
    }

    const senha = input.senhas?.[perfil.key];

    return {
      ...perfil,
      nome: input.nomes?.[perfil.key]?.trim() || perfil.nomePadrao,
      email,
      senha: senha || senhaAleatoria(),
      senhaGerada: !senha,
    };
  });
}

/**
 * O número de matrícula seguinte no ano, no formato canônico `2026-0042`.
 *
 * Recebe a última matrícula do ano em vez de consultá-la para poder ser
 * testada, e repete a regra de `enrollment/service.ts` de propósito: quem
 * numera precisa ser uma coisa só, e no dia em que a numeração virar
 * configurável esta função é o lugar onde as duas se encontram.
 */
export function matriculaSeguinte(ultima: string | null | undefined, ano: number): string {
  const prefixo = `${ano}-`;
  const sequencial = ultima?.startsWith(prefixo)
    ? Number.parseInt(ultima.slice(prefixo.length), 10)
    : 0;
  const proximo = Number.isNaN(sequencial) ? 1 : sequencial + 1;
  return `${prefixo}${String(proximo).padStart(4, "0")}`;
}

/** O `LIKE` que casa só o formato canônico do ano — número herdado não conta. */
export function padraoDeMatricula(ano: number): string {
  return `${ano}-____`;
}
