import { createDb } from "@educa-escola/db";
import {
  classroom,
  enrollment,
  enrollmentEvent,
  member,
  organization,
  school,
  student,
  subject,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq, like } from "drizzle-orm";

import { auth } from "./index";
import {
  type ConteudoDeDemonstracaoResult,
  semearConteudoDeDemonstracao,
} from "./seed-producao-conteudo";
import {
  DISCIPLINAS_BASE,
  matriculaSeguinte,
  type PerfilKey,
  type PerfilResolvido,
  padraoDeMatricula,
} from "./seed-producao-data";

/**
 * Prepara uma escola nova para operar, com um acesso de cada tipo.
 *
 * É o `provision` levado até o fim. O `provision` cria a escola e a direção, e
 * para aí: quem entra encontra o app sem disciplina para montar aula e sem
 * nenhuma outra via de acesso para conferir. Este comando entrega a escola
 * pronta para o primeiro dia — as quatro pessoas de cada papel, as disciplinas
 * da base e uma turma com o aluno de acesso matriculado nela.
 *
 * **Roda em produção, e por isso nunca apaga.** O `seed:demo` começa deletando
 * para a demonstração ser sempre igual; aqui isso seria destruir a escola. Toda
 * etapa procura antes de escrever, e o resultado diz o que criou e o que
 * reaproveitou — rodar duas vezes no mesmo banco é seguro, e rodar depois de um
 * `provision` só acrescenta o que faltava.
 *
 * **Nada de fictício, por padrão.** Nenhuma aula, nota ou chamada: os painéis
 * abrem nos estados vazios até a escola cadastrar o que é dela. Painel cheio de
 * dado inventado em produção vira relatório errado na primeira semana, e aí
 * ninguém sabe mais o que apagar.
 *
 * `demonstracao` é a exceção, e é opt-in explícito: serve para apresentar o
 * produto do ambiente que está no ar, com números na tela. O que ela grava
 * pende todo da turma — ver `seed-producao-conteudo.ts`, inclusive como
 * remover depois.
 *
 * O aluno é a exceção que o próprio app obriga: sem uma ficha em `student`
 * casada com o `userId`, `student.byUserId` responde "nenhuma matrícula
 * vinculada a este acesso" e a via do Aluno não abre. Então a ficha existe, com
 * matrícula ativa no ano corrente — uma ficha de verdade, que a secretaria
 * renomeia para o primeiro aluno real ou cancela em dois cliques.
 */

export interface SeedProducaoInput {
  /** Nome da escola, como aparece na barra de contexto. */
  name: string;
  /** Slug da `organization`. É a chave de idempotência. */
  slug: string;
  inepCode?: string;
  perfis: PerfilResolvido[];
  turma: {
    name: string;
    academicYear: number;
    shift: "manha" | "tarde" | "noite";
    stage?: "infantil" | "fundamental_i" | "fundamental_ii" | "medio";
    gradeLevel?: number;
  };
  aluno: {
    /** Data civil `AAAA-MM-DD`. Sem ela não dá para emitir link de matrícula. */
    birthDate?: string;
    guardianName?: string;
  };
  /**
   * Conteúdo de demonstração na turma: colegas, aulas, chamadas e notas.
   *
   * **Desligado por padrão, e é dado fictício em banco de verdade.** Serve para
   * apresentar o produto a partir do ambiente que está no ar, com os painéis
   * mostrando números. A sala é a que aparece na aula; a grade de horário existe
   * só para manhã e tarde, então turma noturna não é aceita aqui.
   */
  demonstracao?: { sala: string };
}

export interface AcessoPreparado {
  rotulo: string;
  role: string;
  email: string;
  /**
   * `null` quando a conta já existia: o seed não redefine senha de quem já
   * entra no sistema. Trocar a senha de uma conta em uso, num comando de
   * preparação, é derrubar o acesso de alguém sem ninguém ter pedido.
   */
  senha: string | null;
  /** Se o vínculo com esta escola nasceu agora. */
  vinculoCriado: boolean;
  /** Papel que o vínculo já tinha, quando ele não nasceu agora e difere. */
  papelPreexistente?: string;
}

export interface SeedProducaoResult {
  schoolId: string;
  escolaCriada: boolean;
  acessos: AcessoPreparado[];
  disciplinas: { criadas: number; reaproveitadas: number };
  turma: { id: string; name: string; criada: boolean };
  aluno: { id: string; registration: string; criado: boolean };
  /** Ausente quando a flag de demonstração não foi pedida. */
  demonstracao?: ConteudoDeDemonstracaoResult;
}

export async function seedProducao(input: SeedProducaoInput): Promise<SeedProducaoResult> {
  const db = createDb();

  const escola = await ensureSchool(db, input);

  // As contas nascem fora da transação: quem as cria é a API do Better Auth,
  // com a conexão dela. Só o que é do domínio entra no bloco atômico abaixo.
  const contas = new Map<PerfilKey, { userId: string; senha: string | null }>();
  for (const perfil of input.perfis) {
    contas.set(perfil.key, await ensureUser(db, perfil));
  }

  const alunoUserId = contas.get("aluno")?.userId;
  if (!alunoUserId) {
    throw new Error("Falta o acesso do aluno: sem ele não há ficha para vincular.");
  }

  const dominio = await db.transaction(async (tx) => {
    const acessos = await ensureMembers(tx, escola.schoolId, input.perfis, contas);
    const disciplinas = await ensureSubjects(tx, escola.schoolId);
    const turma = await ensureClassroom(tx, escola.schoolId, input.turma);
    const aluno = await ensureStudent(tx, {
      schoolId: escola.schoolId,
      turma,
      input,
      alunoUserId,
      criadoPorUserId: contas.get("secretaria")?.userId,
    });

    const professorId = contas.get("professor")?.userId;

    // Recusar é melhor que aproveitar o horário da tarde: a tela mostraria uma
    // turma noturna com aula às 13h, e número errado numa apresentação é pior
    // que a ausência dele.
    if (input.demonstracao && input.turma.shift === "noite") {
      throw new Error(
        "O conteúdo de demonstração não tem horário de turno noturno. " +
          "Use --turno manha ou --turno tarde, ou rode sem --com-demonstracao.",
      );
    }

    const demonstracao =
      input.demonstracao && professorId && input.turma.shift !== "noite"
        ? await semearConteudoDeDemonstracao(tx, {
            schoolId: escola.schoolId,
            classroomId: turma.id,
            turmaName: turma.name,
            shift: input.turma.shift,
            sala: input.demonstracao.sala,
            academicYear: input.turma.academicYear,
            teacherId: professorId,
            alunoStudentId: aluno.id,
            criadoPorUserId: contas.get("secretaria")?.userId,
          })
        : undefined;

    return { acessos, disciplinas, turma, aluno, demonstracao };
  });

  return { schoolId: escola.schoolId, escolaCriada: escola.criada, ...dominio };
}

async function ensureSchool(
  db: DbHandle,
  input: SeedProducaoInput,
): Promise<{ schoolId: string; criada: boolean }> {
  const [existente] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, input.slug))
    .limit(1);

  if (existente) {
    // A `school` pode faltar se alguém criou a organization por fora. Sem ela
    // toda tabela de domínio quebra na chave estrangeira.
    const [linha] = await db
      .select({ id: school.id })
      .from(school)
      .where(eq(school.id, existente.id))
      .limit(1);

    if (!linha) {
      await db.insert(school).values({ id: existente.id, inepCode: input.inepCode ?? null });
    }

    return { schoolId: existente.id, criada: false };
  }

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
  });

  return { schoolId, criada: true };
}

async function ensureUser(
  db: DbHandle,
  perfil: PerfilResolvido,
): Promise<{ userId: string; senha: string | null }> {
  const existente = await db.query.user.findFirst({
    where: (table, { eq: is }) => is(table.email, perfil.email),
  });
  if (existente) return { userId: existente.id, senha: null };

  const criado = await auth.api.signUpEmail({
    body: { name: perfil.nome, email: perfil.email, password: perfil.senha },
  });
  return { userId: criado.user.id, senha: perfil.senha };
}

async function ensureMembers(
  tx: DbHandle,
  schoolId: string,
  perfis: PerfilResolvido[],
  contas: Map<PerfilKey, { userId: string; senha: string | null }>,
): Promise<AcessoPreparado[]> {
  const acessos: AcessoPreparado[] = [];

  for (const perfil of perfis) {
    const conta = contas.get(perfil.key);
    if (!conta) continue;

    const vinculo = await tx.query.member.findFirst({
      where: (table, { and: both, eq: is }) =>
        both(is(table.organizationId, schoolId), is(table.userId, conta.userId)),
    });

    if (!vinculo) {
      await tx.insert(member).values({
        id: crypto.randomUUID(),
        organizationId: schoolId,
        userId: conta.userId,
        role: perfil.role,
        createdAt: new Date(),
      });
    }

    acessos.push({
      rotulo: perfil.rotulo,
      role: perfil.role,
      email: perfil.email,
      senha: conta.senha,
      vinculoCriado: !vinculo,
      // Papel diferente do pedido não é corrigido por aqui: mexer no papel de
      // um vínculo existente muda o que a pessoa enxerga, e essa decisão é da
      // direção, na tela de membros — não de um comando de preparação.
      papelPreexistente: vinculo && vinculo.role !== perfil.role ? vinculo.role : undefined,
    });
  }

  return acessos;
}

async function ensureSubjects(
  tx: DbHandle,
  schoolId: string,
): Promise<{ criadas: number; reaproveitadas: number }> {
  const existentes = await tx
    .select({ name: subject.name })
    .from(subject)
    .where(eq(subject.schoolId, schoolId));

  const jaTem = new Set(existentes.map((linha) => linha.name));
  const faltando = DISCIPLINAS_BASE.filter((disciplina) => !jaTem.has(disciplina.name));

  if (faltando.length > 0) {
    await tx.insert(subject).values(
      faltando.map((disciplina) => ({
        schoolId,
        name: disciplina.name,
        code: disciplina.code,
        area: disciplina.area,
      })),
    );
  }

  return {
    criadas: faltando.length,
    reaproveitadas: DISCIPLINAS_BASE.length - faltando.length,
  };
}

async function ensureClassroom(
  tx: DbHandle,
  schoolId: string,
  turma: SeedProducaoInput["turma"],
): Promise<{ id: string; name: string; criada: boolean }> {
  const [existente] = await tx
    .select({ id: classroom.id })
    .from(classroom)
    .where(
      and(
        eq(classroom.schoolId, schoolId),
        eq(classroom.academicYear, turma.academicYear),
        eq(classroom.name, turma.name),
      ),
    )
    .limit(1);

  if (existente) return { id: existente.id, name: turma.name, criada: false };

  const [criada] = await tx
    .insert(classroom)
    .values({
      schoolId,
      name: turma.name,
      academicYear: turma.academicYear,
      // Série e segmento só vão preenchidos quando vieram por flag. A coluna
      // aceita nulo de propósito, e adivinhar o segmento pelo nome erraria no
      // "1º ano", que existe no fundamental e no médio.
      stage: turma.stage ?? null,
      gradeLevel: turma.gradeLevel ?? null,
    })
    .returning({ id: classroom.id });

  return { id: (criada as { id: string }).id, name: turma.name, criada: true };
}

/**
 * A ficha do aluno de acesso, e a matrícula ativa dela.
 *
 * A matrícula é gravada junto porque ela é a dona do vínculo datado: gravar só
 * `student` deixaria a escola no estado "aluno antigo, sem matrícula do ano" —
 * legítimo para quem veio de outro sistema, estranho no primeiro cadastro de
 * uma escola nova, com a fila de matrículas vazia e um aluno em sala.
 */
async function ensureStudent(
  tx: DbHandle,
  args: {
    schoolId: string;
    turma: { id: string; name: string };
    input: SeedProducaoInput;
    alunoUserId: string;
    criadoPorUserId?: string;
  },
): Promise<{ id: string; registration: string; criado: boolean }> {
  const { schoolId, turma, input, alunoUserId, criadoPorUserId } = args;

  const [existente] = await tx
    .select({ id: student.id, registration: student.registration })
    .from(student)
    .where(and(eq(student.schoolId, schoolId), eq(student.userId, alunoUserId)))
    .limit(1);

  if (existente) {
    return { id: existente.id, registration: existente.registration, criado: false };
  }

  const ano = input.turma.academicYear;

  // Continua a sequência da escola, e casa só o formato canônico: matrícula
  // herdada de outro sistema não empurra a numeração.
  const [ultima] = await tx
    .select({ registration: student.registration })
    .from(student)
    .where(and(eq(student.schoolId, schoolId), like(student.registration, padraoDeMatricula(ano))))
    .orderBy(desc(student.registration))
    .limit(1);

  const registration = matriculaSeguinte(ultima?.registration, ano);
  const perfilAluno = input.perfis.find((perfil) => perfil.key === "aluno");

  const [criado] = await tx
    .insert(student)
    .values({
      schoolId,
      classroomId: turma.id,
      userId: alunoUserId,
      name: perfilAluno?.nome ?? "Aluno(a)",
      registration,
      birthDate: input.aluno.birthDate ?? null,
      shift: input.turma.shift,
      guardianName: input.aluno.guardianName ?? null,
      status: "ativo",
    })
    .returning({ id: student.id });

  const studentId = (criado as { id: string }).id;

  const [matricula] = await tx
    .insert(enrollment)
    .values({
      schoolId,
      studentId,
      academicYear: ano,
      classroomId: turma.id,
      shift: input.turma.shift,
      status: "ativa",
      kind: "matricula",
      confirmedAt: new Date(),
      createdByUserId: criadoPorUserId ?? null,
      updatedByUserId: criadoPorUserId ?? null,
    })
    .returning({ id: enrollment.id });

  const enrollmentId = (matricula as { id: string }).id;

  // A trilha do §20.2 não começa no meio: a matrícula nasce criada e é
  // confirmada no mesmo gesto, e as duas linhas dizem que quem agiu foi o
  // sistema — não a secretaria, que ainda não abriu o app.
  await tx.insert(enrollmentEvent).values(
    (["criada", "confirmada"] as const).map((type) => ({
      schoolId,
      enrollmentId,
      type,
      actor: "sistema" as const,
      actorUserId: criadoPorUserId ?? null,
    })),
  );

  return { id: studentId, registration, criado: true };
}
