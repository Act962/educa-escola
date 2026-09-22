import type { DbHandle } from "@educa-escola/db/types";
import { env } from "@educa-escola/env/server";

import { permitted, router, schoolProcedure } from "../../index";
import { createClienteCompativel } from "../../integrations/model/client";
import type { Membership, TenantContext } from "../../trpc/tenant";
import { createAssessmentRepository } from "../assessment/repository";
import { createLessonRepository } from "../lesson/repository";
import { createOverviewRepository } from "../overview/repository";
import { createOverviewService } from "../overview/service";
import { createStudentRepository } from "../student/repository";
import { createStudentService } from "../student/service";
import { fatosDaGestao, fatosDoAluno, fatosDoProfessor } from "./facts";
import { createAssistantRepository } from "./repository";
import { askInput, updateSettingsInput } from "./schema";
import { createAssistantService } from "./service";

type Ctx = { db: DbHandle; tenant: TenantContext; membership: Membership };

function serviceFor(ctx: Ctx) {
  return createAssistantService(createAssistantRepository(ctx.db, ctx.tenant), {
    now: () => new Date(),
    chave: env.ASSISTANT_ENCRYPTION_KEY,
    modelo: createClienteCompativel,
  });
}

function overviewFor(ctx: Ctx) {
  return createOverviewService({
    overview: createOverviewRepository(ctx.db, ctx.tenant),
    lessons: createLessonRepository(ctx.db, ctx.tenant),
    assessments: createAssessmentRepository(ctx.db, ctx.tenant),
  });
}

/**
 * Os fatos que o Astro enxerga, montados aqui e não no serviço.
 *
 * O serviço do assistente não consulta domínio de propósito: se ele buscasse o
 * dado, teria de reimplementar o recorte de cada papel, e um esquecimento ali
 * seria vazamento, não defeito de tela. Aqui a origem é o **mesmo painel** que
 * a pessoa já abre — o assistente não sabe mais que a tela dela.
 *
 * O bimestre vem fixo em 3 porque `overview` o recebe da barra de contexto, que
 * é estado de tela. Enquanto o bimestre corrente não for do servidor, o Astro
 * fala do terceiro — e diz qual está usando na primeira linha dos fatos.
 */
const BIMESTRE = 3;

async function fatosDe(ctx: Ctx) {
  const overview = overviewFor(ctx);
  const { role, userId } = ctx.membership;

  if (role === "owner" || role === "admin") {
    return fatosDaGestao(overview, BIMESTRE, new Date());
  }

  if (role === "teacher") {
    return fatosDoProfessor(overview, userId, BIMESTRE);
  }

  const students = createStudentService(createStudentRepository(ctx.db, ctx.tenant));
  const eu = await students.byUserId(userId);
  return fatosDoAluno(overview, {
    studentId: eu.id,
    classroomId: eu.classroomId,
    term: BIMESTRE,
  });
}

/**
 * O Astro, nativo.
 *
 * `manage` é da direção: a credencial do modelo é chave de gasto, e quem
 * assina é quem responde pela escola. `situacao` e `perguntar` resolvem por
 * identidade — o botão aparece para todo papel, e quem decide se aquele papel
 * entra é a própria configuração da escola, não o RBAC.
 */
export const assistantRouter = router({
  /** A configuração, **sem a credencial**. Só a dica dos últimos dígitos. */
  configuracao: permitted({ assistant: ["manage"] }).query(({ ctx }) =>
    serviceFor(ctx).configuracao(),
  ),

  salvar: permitted({ assistant: ["manage"] })
    .input(updateSettingsInput)
    .mutation(({ ctx, input }) => serviceFor(ctx).salvar(input, ctx.membership.userId)),

  /**
   * Pergunta ao provedor quais modelos ele tem.
   *
   * Mutation e não query de propósito: bate na rede do provedor a cada
   * chamada, e cache de query esconderia isso de quem clicou em "buscar".
   */
  buscarModelos: permitted({ assistant: ["manage"] }).mutation(({ ctx }) =>
    serviceFor(ctx).modelosDisponiveis(),
  ),

  /**
   * O consumo da escola. Da direção, como a configuração.
   *
   * Quanto a escola gasta com o modelo é número de custo, não de sala de
   * aula: quem vê é quem assina. Professor e aluno recebem o que lhes serve —
   * quantas perguntas ainda cabem hoje — na própria resposta do Astro.
   */
  uso: permitted({ assistant: ["manage"] }).query(({ ctx }) => serviceFor(ctx).uso()),

  situacao: schoolProcedure.query(({ ctx }) => serviceFor(ctx).situacao(ctx.membership.role)),

  perguntar: schoolProcedure.input(askInput).mutation(async ({ ctx, input }) => {
    const fatos = await fatosDe(ctx);

    return serviceFor(ctx).perguntar(
      { ...input, fatos },
      {
        userId: ctx.membership.userId,
        role: ctx.membership.role,
        nome: ctx.session.user.name,
        escola: ctx.membership.schoolName,
      },
    );
  }),
});
