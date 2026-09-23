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
import { buildClassrooms, type DemoStudent } from "./seed-demo-data";

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

// ---------------------------------------------------------------------------
// Conteúdo de demonstração (opcional, e desligado por padrão)
// ---------------------------------------------------------------------------

/** Fuso padrão da escola. Espelha `DEFAULT_TIMEZONE` de `packages/api/src/dates.ts`. */
export const FUSO_PADRAO = "America/Sao_Paulo";

/**
 * O dia letivo de um instante, no fuso da escola: `2026-09-22`.
 *
 * **Não é `toISOString().slice(0, 10)`**, e a diferença estragou uma
 * demonstração: rodando o seed às 21h de São Paulo, o UTC já é o dia seguinte.
 * As aulas nasciam datadas de amanhã, a pendência de chamada caía em "hoje" e
 * desaparecia da fila da direção, que só conta aula com data anterior à de
 * hoje. Quem semeia e quem lê a tela precisam concordar sobre que dia é.
 *
 * É a mesma conversão de `toSchoolDate` (`packages/api/src/dates.ts`), repetida
 * aqui porque `packages/auth` não pode importar `packages/api` — a dependência
 * vai no sentido contrário. São cinco linhas; unificar exigiria um pacote novo
 * só para datas, e aí a duplicação some.
 */
export function diaLetivoDe(instante: Date, fuso: string = FUSO_PADRAO): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/**
 * O bimestre em que o dia letivo cai, no calendário escolar brasileiro.
 *
 * O seed de demonstração fixa o 3º bimestre porque a apresentação dele é
 * ensaiada; aqui a data é a de quem roda, então o bimestre tem de sair dela.
 * Fevereiro a abril é o 1º, maio a julho o 2º, agosto e setembro o 3º, e o
 * resto o 4º — janeiro cai no 1º por não haver bimestre zero.
 *
 * Recebe o dia letivo já em texto (`2026-09-22`), e não um `Date`, de
 * propósito: `getMonth()` sobre um `Date` à meia-noite UTC devolve o mês do dia
 * anterior em qualquer fuso a oeste de Greenwich, e no primeiro dia de outubro
 * isso daria o 3º bimestre em vez do 4º.
 */
export function bimestreDe(diaLetivo: string): 1 | 2 | 3 | 4 {
  const mes = Number.parseInt(diaLetivo.slice(5, 7), 10);
  if (mes <= 4) return 1;
  if (mes <= 7) return 2;
  if (mes <= 9) return 3;
  return 4;
}

/**
 * A turma de referência do conteúdo de demonstração.
 *
 * É a primeira turma **gerada** da escola de demonstração, e não uma das três
 * do roteiro: as do roteiro têm matrícula e nota escritas à mão
 * (`NOTAS_DO_ROTEIRO`), que colidiriam com a sequência de matrícula da escola
 * de verdade. Reaproveitar a lista gerada evita inventar outra — os nomes já
 * passam pelo teste que garante que ninguém sai homônimo.
 */
const TURMA_DE_REFERENCIA = 3;

/** O colega de demonstração: tudo de `DemoStudent`, menos a matrícula. */
export type ColegaDeDemonstracao = Omit<DemoStudent, "registration">;

/**
 * O perfil do aluno que tem conta, sobrescrevendo o da carteira 0.
 *
 * Dois valores escritos à mão, e cada um corrige um defeito que apareceu na
 * tela:
 *
 * - **Frequência 96%, com dois atrasos.** A carteira 0 da lista gerada tem
 *   100%, e é justamente esse o aluno que a apresentação abre. Frequência cheia
 *   não mostra nada; 96% exibe o cálculo funcionando, e o atraso contando como
 *   presença — que é regra do sistema, não detalhe.
 * - **Aptidão 8.** Sem ela, `aptitudeBySeat(0)` devolve 5,4, que é o piso da
 *   faixa: o boletim do aluno da apresentação abria em **recuperação em quase
 *   toda disciplina**. O desvio por disciplina do `scoreFor` continua dando a
 *   variação que o gráfico precisa, agora em torno de uma média aprovada.
 */
export const ALUNO_COM_CONTA: Pick<DemoStudent, "attendance" | "lates" | "aptitude"> = {
  attendance: 0.96,
  lates: 2,
  aptitude: 8,
};

/**
 * Os colegas de turma do aluno com conta.
 *
 * Sai com a matrícula removida de propósito: quem numera é a sequência da
 * escola de verdade, no banco, não esta lista.
 */
export function colegasDeDemonstracao(): ColegaDeDemonstracao[] {
  const turma = buildClassrooms()[TURMA_DE_REFERENCIA];
  if (!turma) return [];

  // A carteira 0 é do aluno que tem conta, e ele já existe no banco.
  return turma.students.slice(1).map(({ registration: _, ...resto }) => resto);
}

/**
 * A disciplina que recebe a Prova 2 em rascunho, com duas notas faltando.
 *
 * É Matemática porque é a disciplina do roteiro de `DEMO.md` — e é escolhida
 * por nome, não por posição, para não depender da ordem em que o banco devolve
 * as disciplinas. Se a escola não tiver esta, a pendência cai na primeira.
 */
export const DISCIPLINA_COM_PENDENCIA = "Matemática";

/**
 * O que o professor escreveu no diário das últimas aulas.
 *
 * Existe para a aula registrada não ficar com o campo vazio na tela — o diário
 * é parte do que a apresentação mostra, e "sem conteúdo" em toda aula passada
 * faria o recurso parecer não implementado.
 */
export const CONTEUDOS_DE_AULA = [
  "Apresentação do conteúdo do bimestre e combinados da turma.",
  "Resolução de exercícios em duplas, com correção no quadro.",
  "Leitura compartilhada e discussão do capítulo 4.",
  "Revisão para a avaliação: exercícios comentados.",
  "Correção da avaliação e retomada dos pontos de maior erro.",
] as const;
