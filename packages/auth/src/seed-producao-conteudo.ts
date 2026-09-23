import {
  assessment,
  attendance,
  enrollment,
  enrollmentEvent,
  grade,
  lesson,
  school,
  student,
  subject,
} from "@educa-escola/db/schema";
import type { DbHandle } from "@educa-escola/db/types";
import { and, desc, eq, like } from "drizzle-orm";

import {
  absencesFor,
  aptitudeBySeat,
  birthDateOf,
  type DemoStudent,
  type Shift,
  scoreFor,
  spreadIndexes,
  timetableOf,
} from "./seed-demo-data";
import {
  ALUNO_COM_CONTA,
  bimestreDe,
  CONTEUDOS_DE_AULA,
  type ColegaDeDemonstracao,
  colegasDeDemonstracao,
  diaLetivoDe,
  FUSO_PADRAO,
  matriculaSeguinte,
  padraoDeMatricula,
} from "./seed-producao-data";

/**
 * Conteúdo de demonstração para a turma que o seed de produção acabou de criar.
 *
 * **Isto grava dado fictício num banco de verdade, e por isso é opcional e
 * desligado por padrão.** Existe para um caso só: apresentar o produto a partir
 * do ambiente que está no ar, com os painéis mostrando números em vez dos
 * estados vazios. Fora disso, não use — é dado que alguém vai ter de distinguir
 * do verdadeiro depois, e três meses adiante ninguém lembra qual aluno era de
 * mentira.
 *
 * É diferente do `seed:demo` em duas coisas que importam:
 *
 * - **Não apaga nada, nunca.** O `seed:demo` começa deletando a escola dele
 *   para a demonstração ser sempre igual. Aqui a garantia é a oposta: se a
 *   turma já tem aula, sai sem escrever. Rodar de novo não duplica nem
 *   regrava.
 * - **Uma turma, um professor.** O `seed:demo` monta uma escola municipal
 *   inteira, com 12 turmas e 20 professores. Aqui o conteúdo pende da única
 *   turma do seed e do único professor que ele criou — é o bastante para os
 *   três painéis terem números, e é pouco o suficiente para ser removido
 *   apagando a turma.
 *
 * Os geradores vêm de `seed-demo-data.ts`, que é puro e testado: frequência,
 * grade horária e distribuição de nota saem das mesmas funções. Nada sorteia —
 * rodar duas vezes em bancos diferentes dá a mesma escola, e é isso que permite
 * ensaiar a apresentação.
 */

/** Seis semanas de histórico e uma de grade à frente. */
const DIAS_PARA_TRAS = 42;
const DIAS_PARA_FRENTE = 7;

/**
 * Uma carteira da turma: a ficha no banco e o perfil que gera os números dela.
 *
 * O perfil é só o que a geração lê — frequência, atrasos e aptidão. O aluno com
 * conta já existe no banco e não tem linha na lista de colegas, então pedir
 * `DemoStudent` inteiro aqui obrigaria a inventar nome e matrícula vazios.
 */
type Carteira = {
  studentId: string;
  perfil: Pick<DemoStudent, "attendance" | "lates" | "aptitude">;
};

export interface ConteudoDeDemonstracaoInput {
  schoolId: string;
  classroomId: string;
  /** Nome da turma. Dá a série de onde sai a data de nascimento. */
  turmaName: string;
  /** `noite` não é aceito: a grade de demonstração só tem horário de manhã e tarde. */
  shift: Shift;
  sala: string;
  academicYear: number;
  /** O acesso `teacher`: dono de toda aula e avaliação. */
  teacherId: string;
  /** A ficha do acesso `student`, criada pelo seed. Ela é a carteira 0. */
  alunoStudentId: string;
  criadoPorUserId?: string;
  /** Injetável para o teste; por padrão, agora. */
  hoje?: Date;
}

export interface ConteudoDeDemonstracaoResult {
  /** Verdadeiro quando a turma já tinha aula: nada foi escrito. */
  jaHavia: boolean;
  colegas: number;
  aulas: number;
  aulasComChamada: number;
  chamadas: number;
  avaliacoes: number;
  notas: number;
}

const VAZIO: ConteudoDeDemonstracaoResult = {
  jaHavia: true,
  colegas: 0,
  aulas: 0,
  aulasComChamada: 0,
  chamadas: 0,
  avaliacoes: 0,
  notas: 0,
};

export async function semearConteudoDeDemonstracao(
  tx: DbHandle,
  input: ConteudoDeDemonstracaoInput,
): Promise<ConteudoDeDemonstracaoResult> {
  const { schoolId, classroomId, academicYear, teacherId, alunoStudentId } = input;

  // O dia letivo sai do fuso da escola, não do relógio do processo: rodando de
  // noite, o UTC já é amanhã, e a pendência de chamada cairia em "hoje" — onde
  // a fila da direção não a conta.
  const fuso = await fusoDaEscola(tx, schoolId);
  const hojeIso = diaLetivoDe(input.hoje ?? new Date(), fuso);
  const hoje = new Date(`${hojeIso}T00:00:00Z`);

  // A guarda que substitui o "apagar e regravar" do seed de demonstração:
  // turma com aula é turma que alguém já usou.
  const [existente] = await tx
    .select({ id: lesson.id })
    .from(lesson)
    .where(and(eq(lesson.schoolId, schoolId), eq(lesson.classroomId, classroomId)))
    .limit(1);

  if (existente) return VAZIO;

  const disciplinas = await tx
    .select({ id: subject.id, name: subject.name })
    .from(subject)
    .where(eq(subject.schoolId, schoolId));

  const idDaDisciplina = new Map(disciplinas.map((linha) => [linha.name, linha.id]));

  // ---- Colegas de turma ----
  const colegas = colegasDeDemonstracao();
  const ultima = await ultimaMatricula(tx, schoolId, academicYear);

  // A primeira continua a sequência da escola; as outras seguem dela, sem uma
  // consulta por aluno.
  const primeira = matriculaSeguinte(ultima, academicYear);
  const matriculados = colegas.map((colega, indice) => ({
    ...colega,
    registration: somaSequencial(primeira, indice),
  }));

  const linhasDeAluno = matriculados.map((colega) => ({
    id: crypto.randomUUID(),
    schoolId,
    classroomId,
    name: colega.name,
    registration: colega.registration,
    birthDate: birthDateOf(colega.registration, input.turmaName, academicYear),
    shift: input.shift,
    guardianName: colega.guardian,
    status: colega.status ?? ("ativo" as const),
  }));

  await emLotes(linhasDeAluno, 500, (lote) => tx.insert(student).values(lote));

  // Matrícula ativa para cada colega, com a mesma trilha que a do aluno com
  // conta: sem isso a fila de matrículas mostraria uma linha só, e a turma
  // apareceria cheia na chamada e vazia no módulo que é dono do vínculo.
  const linhasDeMatricula = linhasDeAluno.map((aluno) => ({
    id: crypto.randomUUID(),
    schoolId,
    studentId: aluno.id,
    academicYear,
    classroomId,
    shift: input.shift,
    status: "ativa" as const,
    kind: "matricula" as const,
    confirmedAt: new Date(),
    createdByUserId: input.criadoPorUserId ?? null,
    updatedByUserId: input.criadoPorUserId ?? null,
  }));

  await emLotes(linhasDeMatricula, 500, (lote) => tx.insert(enrollment).values(lote));
  await emLotes(
    linhasDeMatricula.flatMap((matricula) =>
      (["criada", "confirmada"] as const).map((type) => ({
        schoolId,
        enrollmentId: matricula.id,
        type,
        actor: "sistema" as const,
        actorUserId: input.criadoPorUserId ?? null,
      })),
    ),
    1000,
    (lote) => tx.insert(enrollmentEvent).values(lote),
  );

  /** A turma na ordem das carteiras: o aluno com conta primeiro. */
  const carteiras: Carteira[] = [
    { studentId: alunoStudentId, perfil: ALUNO_COM_CONTA },
    ...linhasDeAluno.map((aluno, indice) => ({
      studentId: aluno.id,
      perfil: matriculados[indice] as ColegaDeDemonstracao,
    })),
  ];

  // ---- Aulas ----
  const horario = timetableOf(0, input.shift, input.sala);
  const inicio = new Date(hoje);
  inicio.setUTCDate(inicio.getUTCDate() - DIAS_PARA_TRAS);
  const fim = new Date(hoje);
  fim.setUTCDate(fim.getUTCDate() + DIAS_PARA_FRENTE);

  const linhasDeAula: (typeof lesson.$inferInsert)[] = [];

  for (const dia of diasLetivos(inicio, fim)) {
    const data = isoDate(dia);
    for (const slot of horario.filter((item) => item.weekday === dia.getUTCDay())) {
      const subjectId = idDaDisciplina.get(slot.subject);
      if (!subjectId) continue;

      linhasDeAula.push({
        id: crypto.randomUUID(),
        schoolId,
        classroomId,
        subjectId,
        teacherId,
        date: data,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        room: slot.room,
      });
    }
  }

  const passadas = linhasDeAula
    .filter((aula) => (aula.date as string) < hojeIso)
    .sort((a, b) => `${a.date} ${a.startsAt}`.localeCompare(`${b.date} ${b.startsAt}`));

  /**
   * A aula mais recente fica **sem chamada**, de propósito.
   *
   * É o primeiro passo do roteiro: o painel abre com uma pendência, o professor
   * registra, o contador zera. Sem nenhuma pendência a tela de chamada em
   * atraso não tem o que mostrar — e é ela que explica por que registrar fora
   * do prazo exige justificativa.
   */
  const pendente = passadas.at(-1);
  const registrada = passadas.filter((aula) => aula.id !== pendente?.id);

  const comChamada = new Set(registrada.map((aula) => aula.id));
  const diario = new Map(
    registrada
      .slice(-CONTEUDOS_DE_AULA.length)
      .map((aula, indice) => [aula.id as string, CONTEUDOS_DE_AULA[indice] as string]),
  );

  const agora = new Date();
  for (const aula of linhasDeAula) {
    const conteudo = diario.get(aula.id as string);
    if (conteudo) aula.content = conteudo;
    if (comChamada.has(aula.id)) aula.attendanceRecordedAt = agora;
  }

  await emLotes(linhasDeAula, 400, (lote) => tx.insert(lesson).values(lote));

  // ---- Chamadas ----
  const linhasDeChamada: (typeof attendance.$inferInsert)[] = [];

  carteiras.forEach((carteira, assento) => {
    const { absences, lates } = absencesFor(carteira.perfil, registrada.length);
    const faltas = spreadIndexes(registrada.length, absences, assento);
    const atrasos = spreadIndexes(registrada.length, lates, assento + 3);

    registrada.forEach((aula, indice) => {
      linhasDeChamada.push({
        schoolId,
        lessonId: aula.id as string,
        studentId: carteira.studentId,
        status: faltas.has(indice) ? "falta" : atrasos.has(indice) ? "atraso" : "presente",
      });
    });
  });

  await emLotes(linhasDeChamada, 1000, (lote) => tx.insert(attendance).values(lote));

  // ---- Avaliações e notas ----
  const { avaliacoes, notas } = await semearAvaliacoes(tx, {
    schoolId,
    classroomId,
    teacherId,
    disciplinas,
    carteiras,
    hoje,
    hojeIso,
  });

  return {
    jaHavia: false,
    colegas: linhasDeAluno.length,
    aulas: linhasDeAula.length,
    aulasComChamada: registrada.length,
    chamadas: linhasDeChamada.length,
    avaliacoes,
    notas,
  };
}

/**
 * Quatro avaliações por disciplina: a média do bimestre anterior e três do
 * corrente.
 *
 * A média fechada do bimestre anterior é o que dá a barra de comparação do
 * painel do professor — sem ela o gráfico tem uma série só. E a Prova 2 fica em
 * **rascunho, com dois alunos sem nota**, na primeira disciplina: é o momento
 * da apresentação em que publicar é recusado com o motivo, e depois passa. Sem
 * um caso assim, essa regra não tem como ser mostrada.
 */
async function semearAvaliacoes(
  tx: DbHandle,
  args: {
    schoolId: string;
    classroomId: string;
    teacherId: string;
    disciplinas: { id: string; name: string }[];
    carteiras: Carteira[];
    hoje: Date;
    hojeIso: string;
  },
): Promise<{ avaliacoes: number; notas: number }> {
  const { schoolId, classroomId, teacherId, disciplinas, carteiras, hoje, hojeIso } = args;

  const bimestre = bimestreDe(hojeIso);
  const dataDe = (deslocamento: number) => {
    const valor = new Date(hoje);
    valor.setUTCDate(valor.getUTCDate() + deslocamento);
    return isoDate(valor);
  };

  const linhasDeAvaliacao: (typeof assessment.$inferInsert)[] = [];
  const linhasDeNota: (typeof grade.$inferInsert)[] = [];

  disciplinas.forEach((disciplina, indiceDaDisciplina) => {
    const comPendencia = indiceDaDisciplina === 0;

    const definicoes = [
      {
        name: bimestre > 1 ? `Média do ${bimestre - 1}º bimestre` : "Avaliação diagnóstica",
        weight: 1,
        term: Math.max(1, bimestre - 1),
        rascunho: false,
        appliedOn: null as string | null,
      },
      { name: "Prova 1", weight: 4, term: bimestre, rascunho: false, appliedOn: dataDe(-21) },
      {
        name: "Trabalho em grupo",
        weight: 3,
        term: bimestre,
        rascunho: false,
        appliedOn: dataDe(-10),
      },
      { name: "Prova 2", weight: 3, term: bimestre, rascunho: comPendencia, appliedOn: dataDe(-3) },
    ];

    const ids = definicoes.map(() => crypto.randomUUID());

    definicoes.forEach((definicao, indice) => {
      linhasDeAvaliacao.push({
        id: ids[indice] as string,
        schoolId,
        classroomId,
        subjectId: disciplina.id,
        teacherId,
        name: definicao.name,
        weight: definicao.weight,
        term: definicao.term,
        appliedOn: definicao.appliedOn,
        status: definicao.rascunho ? "rascunho" : "publicada",
        publishedAt: definicao.rascunho ? null : hoje,
      });
    });

    carteiras.forEach((carteira, assento) => {
      const aptidao = carteira.perfil.aptitude ?? aptitudeBySeat(assento);

      const notas = [1, 2, 3].map((indiceDaAvaliacao, posicao) => {
        // Só a Prova 2 fica sem lançamento, e só nas duas últimas carteiras:
        // avaliação já publicada com buraco é exatamente o que o app não deixa
        // existir, então a pendência tem de estar na que está em rascunho.
        const ultima = posicao === 2;
        if (comPendencia && ultima && assento >= carteiras.length - 2) return null;
        return scoreFor(assento, indiceDaDisciplina, indiceDaAvaliacao, aptidao);
      });

      const lancadas = notas.filter((valor): valor is number => valor !== null);
      const media = lancadas.reduce((soma, valor) => soma + valor, 0) / (lancadas.length || 1);

      // O bimestre anterior fica 0,7 abaixo do atual: a comparação do gráfico
      // precisa de diferença visível, e a evolução é a história que se conta.
      linhasDeNota.push({
        schoolId,
        assessmentId: ids[0] as string,
        studentId: carteira.studentId,
        score: Math.min(10, Math.max(0, Math.round((media - 0.7) * 10) / 10)),
      });

      notas.forEach((score, posicao) => {
        if (score === null) return;
        linhasDeNota.push({
          schoolId,
          assessmentId: ids[posicao + 1] as string,
          studentId: carteira.studentId,
          score,
        });
      });
    });
  });

  await emLotes(linhasDeAvaliacao, 400, (lote) => tx.insert(assessment).values(lote));
  await emLotes(linhasDeNota, 1000, (lote) => tx.insert(grade).values(lote));

  return { avaliacoes: linhasDeAvaliacao.length, notas: linhasDeNota.length };
}

/** O fuso da escola; `school.timezone` já tem o padrão, mas a coluna pode mudar. */
async function fusoDaEscola(tx: DbHandle, schoolId: string): Promise<string> {
  const [linha] = await tx
    .select({ timezone: school.timezone })
    .from(school)
    .where(eq(school.id, schoolId))
    .limit(1);

  return linha?.timezone ?? FUSO_PADRAO;
}

async function ultimaMatricula(
  tx: DbHandle,
  schoolId: string,
  ano: number,
): Promise<string | null> {
  const [linha] = await tx
    .select({ registration: student.registration })
    .from(student)
    .where(and(eq(student.schoolId, schoolId), like(student.registration, padraoDeMatricula(ano))))
    .orderBy(desc(student.registration))
    .limit(1);

  return linha?.registration ?? null;
}

/** `2026-0007` + 3 = `2026-0010`. Continua a sequência sem ir ao banco por linha. */
function somaSequencial(matricula: string, quantidade: number): string {
  const [ano, sequencial] = matricula.split("-");
  const proximo = (Number.parseInt(sequencial ?? "0", 10) || 0) + quantidade;
  return `${ano}-${String(proximo).padStart(4, "0")}`;
}

function isoDate(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

/** Dias letivos (segunda a sexta) de `de` até `ate`, inclusive. */
function diasLetivos(de: Date, ate: Date): Date[] {
  const dias: Date[] = [];
  const cursor = new Date(de);
  while (cursor <= ate) {
    const diaDaSemana = cursor.getUTCDay();
    if (diaDaSemana >= 1 && diaDaSemana <= 5) dias.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dias;
}

/**
 * Insere em lotes.
 *
 * Milhares de linhas de chamada num `insert` só estouram o limite de
 * parâmetros de uma instrução do Postgres.
 */
async function emLotes<T>(
  linhas: T[],
  tamanho: number,
  escreve: (lote: T[]) => Promise<unknown>,
): Promise<number> {
  for (let inicio = 0; inicio < linhas.length; inicio += tamanho) {
    await escreve(linhas.slice(inicio, inicio + tamanho));
  }
  return linhas.length;
}
