/**
 * Os dados fictícios da escola de demonstração, e os geradores que os
 * expandem para uma escola de porte realista.
 *
 * Está separado de `seed-demo.ts` porque aqui não há banco: é tudo função
 * pura, então dá para testar a grade horária e a distribuição de faltas sem
 * subir Postgres. `seed-demo.ts` cuida só da escrita.
 *
 * **Nada aqui sorteia.** Uma demonstração que muda de número a cada execução
 * é impossível de ensaiar: todo valor vem de aritmética sobre o índice.
 */

export const DEMO_YEAR = new Date().getFullYear();
/** Bimestre em foco na demonstração. */
export const DEMO_TERM = 3;

export type Shift = "manha" | "tarde";
export type StudentStatus = "ativo" | "documentacao_pendente" | "transferido";

// ---------------------------------------------------------------------------
// Disciplinas e grade horária
// ---------------------------------------------------------------------------

/** Sala fixa por disciplina; o resto acontece na sala da turma. */
const SALA_ESPECIAL: Record<string, string> = {
  Ciências: "Lab. de Ciências",
  Arte: "Ateliê",
  "Educação Física": "Quadra",
};

/**
 * Sequência semanal de 20 aulas — 4 por dia útil, de segunda a sexta.
 *
 * A ordem importa: Matemática cai em horários diferentes ao longo da semana
 * (1º, 2º, 3º e 4º tempos). Se caísse sempre no mesmo tempo, um professor com
 * três turmas estaria em três salas ao mesmo tempo todo dia.
 */
export const GRADE_SEMANAL = [
  "Matemática",
  "Língua Portuguesa",
  "Ciências",
  "História",
  "Língua Portuguesa",
  "Matemática",
  "Geografia",
  "Inglês",
  "Ciências",
  "Língua Portuguesa",
  "Matemática",
  "Arte",
  "Geografia",
  "História",
  "Língua Portuguesa",
  "Matemática",
  "Inglês",
  "Ciências",
  "Educação Física",
  "Matemática",
] as const;

export const DISCIPLINAS = [...new Set<string>(GRADE_SEMANAL)];

/** Tempos de aula por turno. Quatro por dia, com intervalo entre o 2º e o 3º. */
const TEMPOS: Record<Shift, { startsAt: string; endsAt: string }[]> = {
  manha: [
    { startsAt: "07:30", endsAt: "08:20" },
    { startsAt: "08:20", endsAt: "09:10" },
    { startsAt: "09:30", endsAt: "10:20" },
    { startsAt: "10:20", endsAt: "11:10" },
  ],
  tarde: [
    { startsAt: "13:00", endsAt: "13:50" },
    { startsAt: "13:50", endsAt: "14:40" },
    { startsAt: "15:00", endsAt: "15:50" },
    { startsAt: "15:50", endsAt: "16:40" },
  ],
};

export interface TimetableSlot {
  /** 1 = segunda … 5 = sexta. */
  weekday: number;
  /** 0 a 3 — o tempo dentro do dia. */
  period: number;
  startsAt: string;
  endsAt: string;
  room: string;
  subject: string;
}

/**
 * A grade da turma: a sequência semanal girada pelo índice da turma.
 *
 * O giro de 3 em 3 dá a cada uma das 12 turmas um deslocamento distinto, então
 * duas turmas do mesmo turno nunca têm a mesma disciplina no mesmo tempo — que
 * é o que permite um professor atender várias turmas sem se duplicar.
 */
export function timetableOf(classroomIndex: number, shift: Shift, room: string): TimetableSlot[] {
  const shiftBy = (classroomIndex * 3) % GRADE_SEMANAL.length;

  return GRADE_SEMANAL.map((_, cell) => {
    const subject = GRADE_SEMANAL[(cell + shiftBy) % GRADE_SEMANAL.length] as string;
    const period = cell % 4;
    const tempo = TEMPOS[shift][period] as { startsAt: string; endsAt: string };

    return {
      weekday: Math.floor(cell / 4) + 1,
      period,
      startsAt: tempo.startsAt,
      endsAt: tempo.endsAt,
      room: SALA_ESPECIAL[subject] ?? room,
      subject,
    };
  });
}

// ---------------------------------------------------------------------------
// Quadro de pessoal
// ---------------------------------------------------------------------------

export interface Person {
  name: string;
  email: string;
  role: "owner" | "admin" | "teacher" | "student";
}

export const DIRETORA: Person = {
  name: "Marina Duarte",
  email: "marina.duarte@dompedroii.edu.br",
  role: "owner",
};

export const SECRETARIA: Person = {
  name: "Vera Lúcia Amorim",
  email: "vera.amorim@dompedroii.edu.br",
  role: "admin",
};

/**
 * O corpo docente. A ordem dentro de cada disciplina é preferência de
 * alocação — **Ricardo Alves vem primeiro em Matemática de propósito**: é o
 * professor da demonstração, e precisa ficar com as turmas do roteiro.
 */
export const PROFESSORES: (Person & { subject: string })[] = (
  [
    { name: "Ricardo Alves", subject: "Matemática", email: "ricardo.alves", role: "teacher" },
    { name: "Beatriz Nogueira", subject: "Matemática", email: "beatriz.nogueira", role: "teacher" },
    { name: "Otávio Rangel", subject: "Matemática", email: "otavio.rangel", role: "teacher" },
    { name: "Simone Vidal", subject: "Matemática", email: "simone.vidal", role: "teacher" },
    { name: "Lourenço Aguiar", subject: "Matemática", email: "lourenco.aguiar", role: "teacher" },
    { name: "Helena Diniz", subject: "Língua Portuguesa", email: "helena.diniz", role: "teacher" },
    {
      name: "Paulo Tenório",
      subject: "Língua Portuguesa",
      email: "paulo.tenorio",
      role: "teacher",
    },
    {
      name: "Rosana Quadros",
      subject: "Língua Portuguesa",
      email: "rosana.quadros",
      role: "teacher",
    },
    { name: "Marcos Aurélio", subject: "Ciências", email: "marcos.aurelio", role: "teacher" },
    { name: "Vanessa Lobo", subject: "Ciências", email: "vanessa.lobo", role: "teacher" },
    { name: "Ariel Bonfim", subject: "Ciências", email: "ariel.bonfim", role: "teacher" },
    { name: "Regina Peixoto", subject: "Ciências", email: "regina.peixoto", role: "teacher" },
    { name: "Cláudia Reis", subject: "História", email: "claudia.reis", role: "teacher" },
    { name: "Elias Bittencourt", subject: "História", email: "elias.bittencourt", role: "teacher" },
    { name: "Tiago Peçanha", subject: "Geografia", email: "tiago.pecanha", role: "teacher" },
    { name: "Sueli Andrade", subject: "Geografia", email: "sueli.andrade", role: "teacher" },
    { name: "Yara Monteiro", subject: "Inglês", email: "yara.monteiro", role: "teacher" },
    { name: "Douglas Prata", subject: "Inglês", email: "douglas.prata", role: "teacher" },
    { name: "Sérgio Bandeira", subject: "Arte", email: "sergio.bandeira", role: "teacher" },
    {
      name: "Fernando Quintela",
      subject: "Educação Física",
      email: "fernando.quintela",
      role: "teacher",
    },
  ] satisfies (Omit<Person, "email"> & { subject: string; email: string })[]
).map((person) => ({
  ...person,
  email: `${person.email}@dompedroii.edu.br`,
}));

/** O professor que a demonstração usa. */
export const PROFESSOR_DEMO = PROFESSORES[0] as (typeof PROFESSORES)[number];

export const ALUNA_COM_ACESSO = {
  name: "Ana Clara Souza Lima",
  email: "ana.clara@aluno.dompedroii.edu.br",
};

/**
 * Turmas que o professor da demonstração leciona, custe o que custar.
 *
 * São as três turmas de `DEMO.md`. Deixar isso a cargo do desempate da
 * alocação já quebrou uma vez: bastou o critério passar a ser "menos
 * carregado" para o Ricardo perder o 9º B e o roteiro apontar para a pessoa
 * errada.
 */
export const TURMAS_DO_PROFESSOR_DEMO = ["8º A", "9º B", "7º C"];

/**
 * Aloca professor por (turma, disciplina) sem choque de horário.
 *
 * Guloso e determinístico: percorre as turmas na ordem recebida — as do
 * roteiro primeiro — e dá a cada disciplina o primeiro professor do quadro
 * que esteja livre em todos os tempos daquela turma. O choque é medido por
 * turno, dia e tempo: o 1º tempo da manhã e o da tarde são horários diferentes.
 *
 * Se ninguém estiver livre (quadro apertado demais), cai no menos carregado —
 * uma escola de demonstração não justifica um resolvedor de grade completo.
 */
export function assignTeachers(
  classrooms: { name: string; shift: Shift; timetable: TimetableSlot[] }[],
): Map<string, string> {
  const assignment = new Map<string, string>();
  const busy = new Map<string, Set<string>>();
  const load = new Map<string, number>();

  const keyOf = (shift: Shift, slot: TimetableSlot) => `${shift}-${slot.weekday}-${slot.period}`;

  for (const room of classrooms) {
    for (const subject of DISCIPLINAS) {
      const slots = room.timetable.filter((slot) => slot.subject === subject);
      if (slots.length === 0) continue;

      const pool = PROFESSORES.filter((teacher) => teacher.subject === subject);

      const fixo =
        subject === PROFESSOR_DEMO.subject && TURMAS_DO_PROFESSOR_DEMO.includes(room.name)
          ? PROFESSOR_DEMO
          : undefined;

      const free = pool.filter((teacher) => {
        const taken = busy.get(teacher.email) ?? new Set<string>();
        return slots.every((slot) => !taken.has(keyOf(room.shift, slot)));
      });

      /**
       * Entre os livres, o menos carregado. Pegar sempre o primeiro da lista
       * entope o começo do quadro e deixa as últimas turmas sem ninguém
       * disponível — foi assim que apareceram choques de horário. O empate
       * desempata pela ordem do quadro, que é o que garante ao professor da
       * demonstração as turmas do roteiro: no começo todos estão com carga 0.
       */
      const chosen =
        fixo ??
        (free.length > 0 ? free : pool).reduce(
          (least, teacher) =>
            (load.get(teacher.email) ?? 0) < (load.get(least.email) ?? 0) ? teacher : least,
          (free[0] ?? pool[0]) as (typeof PROFESSORES)[number],
        );
      if (!chosen) continue;

      const taken = busy.get(chosen.email) ?? new Set<string>();
      for (const slot of slots) taken.add(keyOf(room.shift, slot));
      busy.set(chosen.email, taken);
      load.set(chosen.email, (load.get(chosen.email) ?? 0) + slots.length);
      assignment.set(`${room.name}|${subject}`, chosen.email);
    }
  }

  return assignment;
}

// ---------------------------------------------------------------------------
// Alunos
// ---------------------------------------------------------------------------

export interface DemoStudent {
  name: string;
  registration: string;
  guardian: string;
  /**
   * Frequência alvo, de 0 a 1 — **não** um número de faltas.
   *
   * O total de aulas do ano muda conforme a grade; guardar "15 faltas" faria a
   * Júlia sair de 67% para 92% no dia em que a grade crescesse, e ela é o
   * exemplo de aluno abaixo do mínimo no roteiro. A taxa sobrevive a isso.
   */
  attendance: number;
  lates?: number;
  status?: StudentStatus;
  /**
   * Nota típica do aluno, quando o roteiro já a fixou em alguma disciplina.
   *
   * Sem isso as demais disciplinas saem do índice da carteira, e a Ana Clara
   * — 8,7 em Matemática, porque as notas dela estão escritas à mão — aparecia
   * com 4,5 em Educação Física e média geral 6,0. Boletim de aluno não é
   * oito retratos de pessoas diferentes.
   */
  aptitude?: number;
}

export interface DemoClassroom {
  name: string;
  shift: Shift;
  room: string;
  students: DemoStudent[];
}

/**
 * As três turmas do roteiro, com nome e frequência escritos à mão.
 *
 * São as que aparecem em `DEMO.md`: mexer em nome, matrícula ou frequência
 * daqui desalinha o roteiro da apresentação.
 */
const TURMAS_DO_ROTEIRO: DemoClassroom[] = [
  {
    name: "8º A",
    shift: "manha",
    room: "Sala 12",
    students: [
      {
        name: "Ana Clara Souza Lima",
        registration: `${DEMO_YEAR}-0301`,
        guardian: "Roberta Souza Lima",
        attendance: 0.94,
      },
      {
        name: "Beatriz Macedo Rocha",
        registration: `${DEMO_YEAR}-0305`,
        guardian: "Marcos Macedo Rocha",
        attendance: 0.96,
      },
      {
        name: "Caio Esteves Portela",
        registration: `${DEMO_YEAR}-0309`,
        guardian: "Luciana Esteves",
        attendance: 0.87,
      },
      {
        name: "Davi Fontes Xavier",
        registration: `${DEMO_YEAR}-0312`,
        guardian: "Sandra Fontes",
        attendance: 0.69,
      },
      {
        name: "Eduarda Mendes Vieira",
        registration: `${DEMO_YEAR}-0318`,
        guardian: "Paulo Mendes Vieira",
        attendance: 1,
      },
      {
        name: "Gabriel Tavares Pinto",
        registration: `${DEMO_YEAR}-0323`,
        guardian: "Renata Tavares",
        attendance: 0.91,
        lates: 6,
      },
      {
        name: "Helena Lacerda Guedes",
        registration: `${DEMO_YEAR}-0327`,
        guardian: "Cristina Lacerda",
        attendance: 0.95,
        status: "documentacao_pendente",
      },
    ],
  },
  {
    name: "9º B",
    shift: "manha",
    room: "Sala 21",
    students: [
      {
        name: "Alice Barreto Nunes",
        registration: `${DEMO_YEAR}-0412`,
        guardian: "Fernanda Barreto",
        attendance: 0.93,
      },
      {
        name: "Bruno Carvalho Dias",
        registration: `${DEMO_YEAR}-0418`,
        guardian: "Marcos Carvalho Dias",
        attendance: 0.98,
      },
      {
        name: "Júlia Moraes Ribeiro",
        registration: `${DEMO_YEAR}-0427`,
        guardian: "Vera Moraes",
        attendance: 0.67,
      },
      {
        name: "Lucas Ferreira Gomes",
        registration: `${DEMO_YEAR}-0433`,
        guardian: "Antônio Ferreira",
        attendance: 0.96,
        lates: 9,
      },
      {
        name: "Mariana Pinheiro Costa",
        registration: `${DEMO_YEAR}-0441`,
        guardian: "Sílvia Pinheiro",
        attendance: 1,
      },
      {
        name: "Pedro Lins Andrade",
        registration: `${DEMO_YEAR}-0449`,
        guardian: "Rui Andrade",
        attendance: 0.82,
      },
      {
        name: "Rafael Santana Melo",
        registration: `${DEMO_YEAR}-0455`,
        guardian: "Denise Santana",
        attendance: 0.98,
      },
      {
        name: "Sofia Vasconcelos Braga",
        registration: `${DEMO_YEAR}-0460`,
        guardian: "Jorge Vasconcelos",
        attendance: 1,
      },
    ],
  },
  {
    name: "7º C",
    shift: "tarde",
    room: "Sala 08",
    students: [
      {
        name: "Igor Nascimento Braga",
        registration: `${DEMO_YEAR}-0331`,
        guardian: "Fábio Nascimento",
        attendance: 0.91,
      },
      {
        name: "Laura Antunes Prado",
        registration: `${DEMO_YEAR}-0336`,
        guardian: "Camila Antunes",
        attendance: 0.98,
      },
      {
        name: "Miguel Rocha Teixeira",
        registration: `${DEMO_YEAR}-0340`,
        guardian: "Eduardo Teixeira",
        attendance: 0.95,
      },
      {
        name: "Nina Barbosa Freire",
        registration: `${DEMO_YEAR}-0344`,
        guardian: "Patrícia Freire",
        attendance: 1,
      },
      {
        name: "Otávio Campos Nunes",
        registration: `${DEMO_YEAR}-0349`,
        guardian: "Hélio Campos",
        attendance: 0.89,
      },
    ],
  },
];

const PRIMEIROS_NOMES = [
  "Alícia",
  "Arthur",
  "Bárbara",
  "Benício",
  "Carolina",
  "Daniel",
  "Elisa",
  "Enzo",
  "Fernanda",
  "Felipe",
  "Giovanna",
  "Guilherme",
  "Isadora",
  "Ian",
  "Joana",
  "Kauã",
  "Larissa",
  "Leonardo",
  "Manuela",
  "Murilo",
  "Natália",
  "Nicolas",
  "Olívia",
  "Pietro",
  "Rebeca",
  "Rodrigo",
  "Sara",
  "Samuel",
  "Tainá",
  "Théo",
  "Valentina",
  "Vicente",
  "Yasmin",
  "Yuri",
  "Antônia",
  "Breno",
  "Clarice",
  "Diego",
  "Emanuelle",
  "Heitor",
  "Agatha",
  "Álvaro",
  "Bianca",
  "Caetano",
  "Cecília",
  "Dandara",
  "Eduardo",
  "Eloá",
  "Francisco",
  "Gael",
  "Helena",
  "Íris",
  "Jussara",
  "Lorena",
  "Lívia",
  "Matheus",
  "Milena",
  "Otília",
  "Renan",
  "Ruan",
  "Sílvia",
  "Tomás",
  "Vitória",
  "Zuleica",
  "Anderson",
  "Camila",
  "Everton",
  "Josefa",
  "Luana",
  "Marcelo",
  "Noêmia",
  "Rúbia",
];

const SOBRENOMES = [
  "Albuquerque",
  "Bezerra",
  "Cavalcanti",
  "Dantas",
  "Estrela",
  "Furtado",
  "Gonçalves",
  "Henriques",
  "Ipiranga",
  "Juruá",
  "Klein",
  "Lisboa",
  "Maciel",
  "Navarro",
  "Oliveira",
  "Paiva",
  "Queiroga",
  "Rezende",
  "Siqueira",
  "Tinoco",
  "Uchôa",
  "Valença",
  "Wanderley",
  "Xavier",
  "Zamboni",
  "Aragão",
  "Brandão",
  "Caldeira",
  "Delgado",
  "Espíndola",
];

const RESPONSAVEIS = [
  "Adriana",
  "Bernardo",
  "Cíntia",
  "Décio",
  "Eliane",
  "Flávio",
  "Gisele",
  "Hugo",
  "Ivone",
  "Jonas",
  "Kátia",
  "Luciano",
  "Márcia",
  "Nelson",
  "Odete",
  "Plínio",
  "Regina",
  "Sandro",
  "Tereza",
  "Ubiratan",
];

/**
 * Frequências das turmas geradas, em ciclo.
 *
 * Cerca de um em quinze fica abaixo dos 75% da LDB — não é enfeite: é o que
 * faz o filtro "Alerta de frequência" e o painel de risco da direção terem o
 * que mostrar sem que a escola inteira pareça em colapso.
 */
const FREQUENCIAS = [
  1, 0.98, 0.95, 0.99, 0.92, 1, 0.97, 0.71, 0.96, 0.99, 0.9, 0.94, 1, 0.98, 0.86, 0.97, 1, 0.93,
  0.99, 0.68, 0.95, 1, 0.97, 0.91, 0.99, 0.96, 0.74, 1, 0.98, 0.94, 0.99, 0.88,
];

/**
 * Nome completo do aluno de índice `n`, sem repetir ninguém.
 *
 * Os três componentes usam passos coprimos com o tamanho da respectiva lista,
 * senão a aritmética degenera: com passo 30 numa lista de 30 sobrenomes, a
 * turma inteira vira homônima — foi o que aconteceu, e a listagem da direção
 * exibiu oito "Antônia Navarro" seguidas.
 *
 * O par (primeiro nome, sobrenome) se repete a cada 120 alunos; o termo
 * `n / 120` no nome do meio desloca essa repetição, então não há homônimo
 * antes do aluno 1.200 — bem acima do porte desta escola.
 */
function nomeDoAluno(n: number): string {
  const primeiro = PRIMEIROS_NOMES[n % PRIMEIROS_NOMES.length];
  const ultimoIndex = (n * 7) % SOBRENOMES.length;
  let meioIndex = (n * 11 + Math.floor(n / 120) * 3) % SOBRENOMES.length;
  // Ninguém se chama "Albuquerque Albuquerque".
  if (meioIndex === ultimoIndex) meioIndex = (meioIndex + 1) % SOBRENOMES.length;

  return `${primeiro} ${SOBRENOMES[meioIndex]} ${SOBRENOMES[ultimoIndex]}`;
}

/** Turmas geradas: 6º ao 9º ano, três por série, menos as do roteiro. */
const SERIES = [6, 7, 8, 9];
const LETRAS = ["A", "B", "C"];
/** Tamanho de turma por posição, em ciclo — escola real não tem turma uniforme. */
const TAMANHOS = [32, 29, 34, 27, 31, 33, 28, 30, 35];

/**
 * Puxa a aptidão do aluno das notas que o roteiro já fixou.
 *
 * Só o 8º A tem notas escritas à mão, e só em Matemática: quem está lá ganha
 * o resto do boletim coerente com elas.
 */
function comAptidaoDoRoteiro(turma: DemoClassroom): DemoClassroom {
  return {
    ...turma,
    students: turma.students.map((aluno) => {
      const escritas = NOTAS_DO_ROTEIRO[aluno.registration];
      if (!escritas) return aluno;

      const lancadas = escritas.filter((nota): nota is number => nota !== null);
      if (lancadas.length === 0) return aluno;

      const media = lancadas.reduce((soma, nota) => soma + nota, 0) / lancadas.length;
      return { ...aluno, aptitude: media };
    }),
  };
}

/**
 * A escola inteira: as turmas do roteiro primeiro, depois as geradas.
 *
 * A ordem é o que garante ao Ricardo as turmas da apresentação na alocação de
 * professores — quem vem antes escolhe primeiro.
 */
export function buildClassrooms(): DemoClassroom[] {
  const scripted = new Map(TURMAS_DO_ROTEIRO.map((turma) => [turma.name, turma]));
  const generated: DemoClassroom[] = [];
  let matricula = 1000;
  let indice = 0;
  let sizeIndex = 0;
  let freqIndex = 0;

  for (const serie of SERIES) {
    for (const [letraIndex, letra] of LETRAS.entries()) {
      const name = `${serie}º ${letra}`;
      if (scripted.has(name)) continue;

      // A turma C estuda à tarde; as demais, de manhã.
      const shift: Shift = letra === "C" ? "tarde" : "manha";
      const size = TAMANHOS[sizeIndex % TAMANHOS.length] as number;
      sizeIndex += 1;

      const students: DemoStudent[] = [];
      for (let seat = 0; seat < size; seat += 1) {
        const nome = nomeDoAluno(indice);
        const sobrenome = nome.split(" ").pop() as string;
        indice += 1;
        matricula += 1;
        const attendance = FREQUENCIAS[freqIndex % FREQUENCIAS.length] as number;
        freqIndex += 1;

        students.push({
          name: nome,
          registration: `${DEMO_YEAR}-${matricula}`,
          guardian: `${RESPONSAVEIS[(matricula + seat) % RESPONSAVEIS.length]} ${sobrenome}`,
          attendance,
          lates: seat % 9 === 0 ? 4 : undefined,
          // Uma matrícula por turma aguardando documento, e uma transferida a
          // cada três turmas: a direção precisa ver esses dois números.
          status:
            seat === 2
              ? "documentacao_pendente"
              : seat === 5 && letraIndex === 1
                ? "transferido"
                : "ativo",
        });
      }

      generated.push({ name, shift, room: `Sala ${20 + generated.length}`, students });
    }
  }

  return [...TURMAS_DO_ROTEIRO.map(comAptidaoDoRoteiro), ...generated];
}

// ---------------------------------------------------------------------------
// Notas
// ---------------------------------------------------------------------------

/**
 * Notas escritas à mão do 8º A em Matemática — a grade que a apresentação
 * abre. `null` é lançamento faltando, e é ele que faz a publicação ser
 * recusada.
 */
export const NOTAS_DO_ROTEIRO: Record<string, [number, number, number | null]> = {
  [`${DEMO_YEAR}-0301`]: [8.5, 9, 7.5],
  [`${DEMO_YEAR}-0305`]: [7, 8, 6.5],
  [`${DEMO_YEAR}-0309`]: [5, 6, null],
  [`${DEMO_YEAR}-0312`]: [4, 5.5, 4.5],
  [`${DEMO_YEAR}-0318`]: [9.5, 9.5, 10],
  [`${DEMO_YEAR}-0323`]: [6.5, 7.5, 7],
  [`${DEMO_YEAR}-0327`]: [8, 7, null],
};

/**
 * Nota de um aluno numa avaliação, entre 2 e 10, em passos de meio ponto.
 *
 * Há uma aptidão por aluno e um desvio por disciplina, então o mesmo aluno vai
 * melhor em umas matérias que em outras — sem isso o boletim vira uma régua
 * reta e o gráfico de desempenho não diz nada.
 *
 * A faixa começa em 5,4 de propósito: com a aptidão partindo de 4,5 um terço
 * da escola ficava abaixo da média de aprovação, e o painel da direção passava
 * a retratar um colapso em vez de uma escola. Cerca de um em sete fica em
 * recuperação — o bastante para o recorte de risco existir.
 */
export function aptitudeBySeat(seatIndex: number): number {
  return 5.4 + ((seatIndex * 7) % 13) / 2.8;
}

export function scoreFor(
  seatIndex: number,
  subjectIndex: number,
  assessmentIndex: number,
  aptidao = aptitudeBySeat(seatIndex),
): number {
  const porDisciplina = (((seatIndex + subjectIndex * 5) % 7) - 3) * 0.35;
  const porAvaliacao = ((assessmentIndex * 3 + seatIndex) % 5) * 0.2 - 0.4;

  const bruto = aptidao + porDisciplina + porAvaliacao;
  return Math.min(10, Math.max(2, Math.round(bruto * 2) / 2));
}

/**
 * Espalha `count` ocorrências por `total` aulas, sem sorteio.
 *
 * O `offset` desloca o padrão por aluno, senão a turma inteira faltaria nos
 * mesmos dias — e a tela de chamada mostraria dias inteiros vazios.
 */
export function spreadIndexes(total: number, count: number, offset = 0): Set<number> {
  const picked = new Set<number>();
  const wanted = Math.min(count, total);
  if (wanted <= 0 || total <= 0) return picked;
  for (let k = 0; k < wanted; k += 1) {
    picked.add((Math.floor((k * total) / wanted) + offset) % total);
  }
  return picked;
}

/** Faltas e atrasos de um aluno sobre um total de aulas, a partir da taxa alvo. */
export function absencesFor(
  student: DemoStudent,
  totalLessons: number,
): {
  absences: number;
  lates: number;
} {
  const absences = Math.round((1 - student.attendance) * totalLessons);
  const lates = Math.min(student.lates ?? 0, Math.max(0, totalLessons - absences));
  return { absences, lates };
}
