import { ConflictError, NotFoundError, ValidationError, violaUnico } from "../../errors";
import { gerarCodigo, normalizarCodigo } from "./code";
import type { ReferralRepository } from "./repository";
import type { RegisterConversionInput, RewardKind, UpdateProgramInput } from "./schema";

/**
 * O programa como a escola vê antes de configurar nada.
 *
 * Desligado, e com o responsável como divulgador. São os dois padrões que
 * custam caro se estiverem errados: um programa que nasce ligado compromete
 * receita sem decisão, e um que nasce pondo a criança para captar matrícula
 * põe a escola na frente da Resolução 163/2014 do CONANDA sem ninguém ter
 * escolhido isso.
 */
export const PROGRAMA_PADRAO = {
  enabled: false,
  headline: "Indique e ganhe desconto",
  description: null,
  terms: null,
  rewardKind: "percentual" as RewardKind,
  rewardValue: 10,
  rewardCapPerYear: 3,
  linkExpiresInDays: 90,
  whoCanRefer: "responsavel" as const,
};

/**
 * Situação do prêmio, derivada da matrícula — nunca guardada.
 *
 * `confirmada` é o único estado que vale desconto. `acima_do_teto` existe para
 * a indicação continuar aparecendo: escondê-la faria a família achar que o
 * sistema perdeu a indicação, quando na verdade ela chegou depois do limite
 * que a própria escola definiu.
 */
export type SituacaoDaIndicacao = "pendente" | "confirmada" | "acima_do_teto" | "sem_efeito";

const CONFIRMA_O_PREMIO = new Set(["ativa", "concluida"]);
const AINDA_PODE = new Set(["pendente", "suspensa"]);

export function situacaoDe(
  enrollmentStatus: string,
  jaConfirmadasAntes: number,
  teto: number,
): SituacaoDaIndicacao {
  if (CONFIRMA_O_PREMIO.has(enrollmentStatus)) {
    return jaConfirmadasAntes < teto ? "confirmada" : "acima_do_teto";
  }
  return AINDA_PODE.has(enrollmentStatus) ? "pendente" : "sem_efeito";
}

export interface IndicacaoApurada {
  id: string;
  linkId: string;
  codigo: string;
  indicanteId: string;
  indicanteNome: string;
  enrollmentId: string;
  academicYear: number;
  rewardKind: RewardKind;
  rewardValue: number;
  note: string | null;
  createdAt: Date;
  situacao: SituacaoDaIndicacao;
}

type LinhaDeConversao = Awaited<ReturnType<ReferralRepository["listConversions"]>>[number];

/**
 * Aplica o teto por quem indica, na ordem de chegada.
 *
 * Ordem de chegada e não "as de maior desconto": o critério precisa ser um que
 * a família consiga conferir sozinha olhando as datas. Qualquer outro vira
 * discussão no balcão da secretaria.
 */
export function apurar(linhas: LinhaDeConversao[], teto: number): IndicacaoApurada[] {
  const confirmadasPorLink = new Map<string, number>();

  return [...linhas]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((linha) => {
      const antes = confirmadasPorLink.get(linha.linkId) ?? 0;
      const situacao = situacaoDe(linha.enrollmentStatus, antes, teto);
      if (situacao === "confirmada") confirmadasPorLink.set(linha.linkId, antes + 1);

      return {
        id: linha.id,
        linkId: linha.linkId,
        codigo: linha.codigo,
        indicanteId: linha.indicanteId,
        indicanteNome: linha.indicanteNome,
        enrollmentId: linha.enrollmentId,
        academicYear: linha.academicYear,
        rewardKind: linha.rewardKind,
        rewardValue: linha.rewardValue,
        note: linha.note,
        createdAt: linha.createdAt,
        situacao,
      };
    });
}

/**
 * O desconto acumulado de quem indica.
 *
 * Percentual e valor não se somam — são unidades diferentes —, então vêm
 * separados. Misturar os dois num número só daria um total que não significa
 * nada, e é justamente o número que alguém levaria para o boleto.
 */
export function totalizar(indicacoes: IndicacaoApurada[]) {
  const confirmadas = indicacoes.filter((i) => i.situacao === "confirmada");

  return {
    confirmadas: confirmadas.length,
    pendentes: indicacoes.filter((i) => i.situacao === "pendente").length,
    // Teto de 100%: a escola pode configurar 40% com teto de 3, e três
    // indicações confirmadas dariam 120% — mensalidade negativa.
    percentual: Math.min(
      100,
      confirmadas
        .filter((i) => i.rewardKind === "percentual")
        .reduce((s, i) => s + i.rewardValue, 0),
    ),
    /** Em centavos, como está guardado. */
    centavos: confirmadas
      .filter((i) => i.rewardKind === "valor")
      .reduce((s, i) => s + i.rewardValue, 0),
  };
}

export function createReferralService(
  repo: ReferralRepository,
  options: { now: () => Date; actor: { userId: string }; aleatorio?: () => number },
) {
  async function programaOuPadrao() {
    const salvo = await repo.findProgram();
    return salvo ?? { ...PROGRAMA_PADRAO, schoolId: "", updatedAt: options.now() };
  }

  return {
    programa: programaOuPadrao,

    updateProgram: (input: UpdateProgramInput) => repo.saveProgram(input),

    /**
     * O painel da gestão: programa, números e a lista de indicações.
     */
    async overview(academicYear: number) {
      const programa = await programaOuPadrao();
      const [linhas, familias] = await Promise.all([
        repo.listConversions(academicYear),
        repo.countLinks(),
      ]);

      const indicacoes = apurar(linhas, programa.rewardCapPerYear);

      return {
        programa,
        familias,
        indicacoes,
        resumo: totalizar(indicacoes),
      };
    },

    /**
     * O link de um aluno, criado na primeira vez que alguém pede.
     *
     * Criar sob demanda, e não para todo aluno da escola: a maioria nunca
     * divulga nada, e trezentas linhas ociosas só atrapalham quem depois
     * precisa achar as que importam.
     */
    async garantirLink(studentIdAlvo: string) {
      const programa = await programaOuPadrao();
      if (!programa.enabled) {
        throw new ValidationError("O programa de indicações está desligado.");
      }

      const aluno = await repo.findStudent(studentIdAlvo);
      if (!aluno) throw new NotFoundError("Aluno não encontrado nesta escola.");

      const existente = await repo.findLinkByStudent(studentIdAlvo);
      if (existente) return { link: existente, aluno };

      const codigo = gerarCodigo(aluno.name, await repo.codesInUse(), options.aleatorio);

      const expiresAt =
        programa.linkExpiresInDays > 0
          ? new Date(options.now().getTime() + programa.linkExpiresInDays * 86_400_000)
          : null;

      const link = await repo.createLink({
        studentId: studentIdAlvo,
        code: codigo,
        expiresAt,
        createdByUserId: options.actor.userId,
      });

      return { link, aluno };
    },

    /** O que o aluno vê: o próprio link e as próprias indicações. */
    async meuPainel(userId: string, academicYear: number) {
      const programa = await programaOuPadrao();
      const aluno = await repo.findStudentByUser(userId);

      if (!programa.enabled || !aluno) {
        return { programa, aluno: null, link: null, indicacoes: [], resumo: null };
      }

      const link = await repo.findLinkByStudent(aluno.id);
      const indicacoes = link
        ? apurar(
            await repo.listConversionsByStudent(aluno.id, academicYear),
            programa.rewardCapPerYear,
          )
        : [];

      return { programa, aluno, link, indicacoes, resumo: totalizar(indicacoes) };
    },

    /**
     * Amarra uma matrícula a um código.
     *
     * Quatro recusas, e todas existem porque a alternativa é um desconto que
     * ninguém consegue explicar depois.
     */
    async registrarConversao(input: RegisterConversionInput) {
      const programa = await programaOuPadrao();
      if (!programa.enabled) {
        throw new ValidationError("O programa de indicações está desligado.");
      }

      const codigo = normalizarCodigo(input.code);
      const link = await repo.findLinkByCode(codigo);
      if (!link) throw new NotFoundError(`Não existe o código de indicação ${codigo}.`);

      if (link.revokedAt) throw new ValidationError("Este código de indicação foi revogado.");
      if (link.expiresAt && link.expiresAt < options.now()) {
        throw new ValidationError("Este código de indicação está vencido.");
      }

      const matricula = await repo.findEnrollment(input.enrollmentId);
      if (!matricula) throw new NotFoundError("Matrícula não encontrada nesta escola.");

      // Indicar a si mesmo é o primeiro atalho que alguém tenta, e o único
      // que o índice único de matrícula não pega.
      if (matricula.studentId === link.studentId) {
        throw new ValidationError("Uma matrícula não pode ser indicada pelo próprio aluno.");
      }

      try {
        // O prêmio é congelado agora: mudar a regra em março não altera o
        // desconto de quem indicou em fevereiro.
        return await repo.createConversion({
          linkId: link.id,
          enrollmentId: input.enrollmentId,
          rewardKind: programa.rewardKind,
          rewardValue: programa.rewardValue,
          note: input.note,
          registeredByUserId: options.actor.userId,
        });
      } catch (erro) {
        // O único em (escola, matrícula) é quem garante que uma matrícula
        // premia uma indicação só. Traduzir aqui evita um 500 numa ação que a
        // secretaria lê como "já registrei isso".
        if (violaUnico(erro, "referral_conversion_enrollment_uidx")) {
          throw new ConflictError("Esta matrícula já está ligada a uma indicação.");
        }
        throw erro;
      }
    },

    async removerConversao(id: string) {
      const removida = await repo.removeConversion(id);
      if (!removida) throw new NotFoundError("Indicação não encontrada.");
      return removida;
    },
  };
}

export type ReferralService = ReturnType<typeof createReferralService>;
