import { describe, expect, it } from "vitest";

import {
  absencesFor,
  assignTeachers,
  buildClassrooms,
  type DemoClassroom,
  DISCIPLINAS,
  GRADE_SEMANAL,
  NOTAS_DO_ROTEIRO,
  PROFESSOR_DEMO,
  PROFESSORES,
  scoreFor,
  spreadIndexes,
  timetableOf,
} from "./seed-demo-data";

/**
 * A escola de demonstração é dado fictício, mas é o que aparece na
 * apresentação: se a grade puser um professor em duas salas ao mesmo tempo,
 * ou se a Júlia deixar de estar abaixo dos 75%, o roteiro quebra na frente de
 * quem está assistindo. Estes testes guardam essas promessas.
 */

const escola = buildClassrooms();

const comHorario = escola.map((turma, index) => ({
  name: turma.name,
  shift: turma.shift,
  timetable: timetableOf(index, turma.shift, turma.room),
}));

const alunosDe = (nome: string) =>
  (escola.find((turma) => turma.name === nome) as DemoClassroom).students;

describe("grade horária", () => {
  it("dá 20 aulas por semana a cada turma, quatro por dia útil", () => {
    for (const turma of comHorario) {
      expect(turma.timetable).toHaveLength(20);
      for (const weekday of [1, 2, 3, 4, 5]) {
        const doDia = turma.timetable.filter((slot) => slot.weekday === weekday);
        expect(doDia).toHaveLength(4);
        expect(new Set(doDia.map((slot) => slot.period)).size).toBe(4);
      }
    }
  });

  it("mantém a carga semanal de cada disciplina em todas as turmas", () => {
    const esperado = new Map<string, number>();
    for (const nome of GRADE_SEMANAL) esperado.set(nome, (esperado.get(nome) ?? 0) + 1);

    for (const turma of comHorario) {
      for (const [nome, aulas] of esperado) {
        expect(turma.timetable.filter((slot) => slot.subject === nome)).toHaveLength(aulas);
      }
    }
  });
});

describe("alocação de professores", () => {
  const assignment = assignTeachers(comHorario);

  it("cobre toda disciplina de toda turma", () => {
    for (const turma of comHorario) {
      for (const disciplina of DISCIPLINAS) {
        expect(assignment.get(`${turma.name}|${disciplina}`)).toBeDefined();
      }
    }
  });

  /**
   * O choque é o erro que a plateia enxerga: "Aulas de hoje" mostraria o mesmo
   * professor em duas salas no mesmo horário.
   */
  it("não põe professor em duas turmas no mesmo horário", () => {
    const ocupado = new Set<string>();
    const choques: string[] = [];

    for (const turma of comHorario) {
      for (const slot of turma.timetable) {
        const email = assignment.get(`${turma.name}|${slot.subject}`);
        const chave = `${email}|${turma.shift}|${slot.weekday}|${slot.period}`;
        if (ocupado.has(chave)) choques.push(`${turma.name} ${slot.subject} ${chave}`);
        ocupado.add(chave);
      }
    }

    expect(choques).toEqual([]);
  });

  it("dá ao professor da demonstração as três turmas do roteiro", () => {
    for (const turma of ["8º A", "9º B", "7º C"]) {
      expect(assignment.get(`${turma}|${PROFESSOR_DEMO.subject}`)).toBe(PROFESSOR_DEMO.email);
    }
  });

  it("não deixa professor sem turma — quadro inteiro aparece na escola", () => {
    const alocados = new Set(assignment.values());
    const ociosos = PROFESSORES.filter((teacher) => !alocados.has(teacher.email));
    expect(ociosos.map((teacher) => teacher.name)).toEqual([]);
  });
});

describe("turmas e alunos", () => {
  it("mantém as turmas e as matrículas do roteiro", () => {
    const nomes = escola.map((turma) => turma.name);
    expect(nomes).toContain("8º A");
    expect(nomes).toContain("9º B");
    expect(nomes).toContain("7º C");
    expect(alunosDe("8º A")[0]?.name).toBe("Ana Clara Souza Lima");
  });

  it("não repete matrícula na escola", () => {
    const matriculas = escola.flatMap((turma) => turma.students.map((aluno) => aluno.registration));
    expect(new Set(matriculas).size).toBe(matriculas.length);
  });

  /**
   * Nome gerado por aritmética degenera em homônimo sem avisar: a listagem da
   * direção já mostrou oito "Antônia Navarro" seguidas porque o passo não era
   * coprimo com o tamanho da lista de sobrenomes. Contagem de alunos não pega
   * isso — só olhar a tela, ou este teste.
   */
  it("não repete nome completo, nem sobrenome ao longo da chamada", () => {
    const nomes = escola.flatMap((turma) => turma.students.map((aluno) => aluno.name));
    expect(new Set(nomes).size).toBe(nomes.length);

    for (const turma of escola) {
      const sobrenomes = turma.students.map((aluno) => aluno.name.split(" ").pop());
      // Numa turma de trinta, no mínimo um terço de sobrenomes distintos.
      expect(new Set(sobrenomes).size).toBeGreaterThan(turma.students.length / 3);
    }
  });

  it("dá nomes variados dentro da mesma turma", () => {
    for (const turma of escola) {
      const primeiros = turma.students.map((aluno) => aluno.name.split(" ")[0]);
      expect(new Set(primeiros).size).toBe(primeiros.length);
    }
  });

  it("tem porte de escola de verdade, com turmas de tamanhos diferentes", () => {
    const total = escola.reduce((sum, turma) => sum + turma.students.length, 0);
    expect(total).toBeGreaterThan(250);
    expect(new Set(escola.map((turma) => turma.students.length)).size).toBeGreaterThan(3);
  });

  it("tem matrícula em todas as situações que a direção filtra", () => {
    const situacoes = new Set(
      escola.flatMap((turma) => turma.students.map((aluno) => aluno.status ?? "ativo")),
    );
    expect([...situacoes].sort()).toEqual(["ativo", "documentacao_pendente", "transferido"]);
  });
});

describe("frequência", () => {
  /**
   * A frequência é guardada como taxa, não como número de faltas, justamente
   * para sobreviver a uma mudança na grade. Este teste é a prova: o mesmo
   * aluno continua abaixo do mínimo com 45 ou com 180 aulas no período.
   */
  it("preserva a taxa alvo em qualquer quantidade de aulas", () => {
    const julia = alunosDe("9º B").find((aluno) => aluno.name.startsWith("Júlia"));
    expect(julia).toBeDefined();

    for (const total of [45, 120, 180, 400]) {
      const { absences } = absencesFor(julia as NonNullable<typeof julia>, total);
      expect((total - absences) / total).toBeCloseTo(0.67, 2);
    }
  });

  it("deixa Júlia e Davi abaixo dos 75% da LDB", () => {
    const abaixo = escola
      .flatMap((turma) => turma.students)
      .filter((aluno) => aluno.attendance < 0.75)
      .map((aluno) => aluno.name);

    expect(abaixo).toContain("Júlia Moraes Ribeiro");
    expect(abaixo).toContain("Davi Fontes Xavier");
  });

  it("mantém o alerta de frequência como exceção, não como regra", () => {
    const todos = escola.flatMap((turma) => turma.students);
    const abaixo = todos.filter((aluno) => aluno.attendance < 0.75).length;
    const proporcao = abaixo / todos.length;

    expect(proporcao).toBeGreaterThan(0.01);
    expect(proporcao).toBeLessThan(0.12);
  });

  it("nunca marca mais faltas do que aulas houve", () => {
    for (const turma of escola) {
      for (const aluno of turma.students) {
        const { absences, lates } = absencesFor(aluno, 40);
        expect(absences).toBeGreaterThanOrEqual(0);
        expect(absences + lates).toBeLessThanOrEqual(40);
      }
    }
  });
});

describe("distribuição sem sorteio", () => {
  it("espalha as faltas em vez de agrupá-las no começo", () => {
    const escolhidos = [...spreadIndexes(20, 4)].sort((a, b) => a - b);
    expect(escolhidos).toEqual([0, 5, 10, 15]);
  });

  it("desloca o padrão por aluno, para não esvaziar o mesmo dia", () => {
    expect([...spreadIndexes(20, 4, 1)].sort((a, b) => a - b)).toEqual([1, 6, 11, 16]);
  });

  it("repete o resultado entre execuções", () => {
    expect(scoreFor(3, 2, 1)).toBe(scoreFor(3, 2, 1));
    expect(buildClassrooms()[4]?.students[7]?.name).toBe(escola[4]?.students[7]?.name);
  });
});

describe("notas geradas", () => {
  it("fica na escala de 0 a 10, em passos de meio ponto", () => {
    for (let seat = 0; seat < 35; seat += 1) {
      for (let subjectIndex = 0; subjectIndex < DISCIPLINAS.length; subjectIndex += 1) {
        for (const assessmentIndex of [1, 2, 3]) {
          const nota = scoreFor(seat, subjectIndex, assessmentIndex);
          expect(nota).toBeGreaterThanOrEqual(0);
          expect(nota).toBeLessThanOrEqual(10);
          expect(nota * 2).toBe(Math.round(nota * 2));
        }
      }
    }
  });

  /** Boletim de régua reta não mostra nada: o gráfico por disciplina some. */
  it("varia entre disciplinas para o mesmo aluno", () => {
    const doAluno = DISCIPLINAS.map((_, subjectIndex) => scoreFor(9, subjectIndex, 1));
    expect(new Set(doAluno).size).toBeGreaterThan(2);
  });

  /**
   * O boletim é de uma pessoa só. Quando as notas do roteiro fixam 8,3 em
   * Matemática e o resto sai do índice da carteira, a mesma aluna aparece com
   * 4,5 em Educação Física e média geral 6,0 — oito retratos de gente
   * diferente na mesma tela.
   */
  it("mantém o boletim do aluno do roteiro coerente com a nota escrita à mão", () => {
    const ana = alunosDe("8º A").find((aluno) => aluno.name.startsWith("Ana Clara"));
    expect(ana?.aptitude).toBeCloseTo(8.33, 1);

    const boletim = DISCIPLINAS.map(
      (_, subjectIndex) =>
        [1, 2, 3].reduce(
          (soma, avaliacao) => soma + scoreFor(0, subjectIndex, avaliacao, ana?.aptitude),
          0,
        ) / 3,
    );

    const geral = boletim.reduce((soma, media) => soma + media, 0) / boletim.length;
    expect(geral).toBeGreaterThan(7.5);
    // Nenhuma disciplina desaba: a variação é de desempenho, não de identidade.
    expect(Math.min(...boletim)).toBeGreaterThan(6.5);
  });

  it("produz aluno aprovado e aluno em recuperação", () => {
    const medias = Array.from(
      { length: 30 },
      (_, seat) => [1, 2, 3].reduce((sum, index) => sum + scoreFor(seat, 0, index), 0) / 3,
    );
    expect(medias.some((media) => media >= 6)).toBe(true);
    expect(medias.some((media) => media < 6)).toBe(true);
  });

  it("deixa exatamente dois alunos do 8º A sem a Prova 2", () => {
    const semNota = Object.values(NOTAS_DO_ROTEIRO).filter((notas) => notas[2] === null);
    expect(semNota).toHaveLength(2);
  });
});
