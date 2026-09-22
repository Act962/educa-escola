import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { ReferralRepository } from "./repository";
import { apurar, createReferralService, PROGRAMA_PADRAO, situacaoDe, totalizar } from "./service";

type Linha = Awaited<ReturnType<ReferralRepository["listConversions"]>>[number];

const AGORA = new Date("2026-03-10T12:00:00Z");

const linha = (over: Partial<Linha> & { id: string }): Linha =>
  ({
    linkId: "l1",
    codigo: "MA4K2Z",
    indicanteId: "a1",
    indicanteNome: "Maria Clara",
    enrollmentId: `m-${over.id}`,
    academicYear: 2026,
    rewardKind: "percentual",
    rewardValue: 10,
    note: null,
    createdAt: AGORA,
    enrollmentStatus: "ativa",
    ...over,
  }) as Linha;

const PROGRAMA = { ...PROGRAMA_PADRAO, schoolId: "e1", enabled: true, updatedAt: AGORA };

function fakeRepository(over: Partial<ReferralRepository> = {}): ReferralRepository {
  return {
    findProgram: async () => PROGRAMA as never,
    saveProgram: async (input) => ({ ...PROGRAMA, ...input }) as never,
    findLinkByStudent: async () => null,
    findLinkByCode: async () => null,
    createLink: async (data) => ({ id: "novo", ...data }) as never,
    findStudent: async (id) => ({
      id,
      name: "Maria Clara",
      registration: "2026-0001",
      classroomName: "6º A",
    }),
    findStudentByUser: async () => null,
    listConversions: async () => [],
    listConversionsByStudent: async () => [],
    findEnrollment: async (id) => ({
      id,
      studentId: "outro",
      status: "pendente",
      academicYear: 2026,
      studentName: "João",
    }),
    createConversion: async (data) => ({ id: "c1", ...data }) as never,
    removeConversion: async (id) => ({ id }),
    codesInUse: async () => new Set<string>(),
    countLinks: async () => 0,
    ...over,
  };
}

const servico = (over: Partial<ReferralRepository> = {}) =>
  createReferralService(fakeRepository(over), {
    now: () => AGORA,
    actor: { userId: "u1" },
  });

describe("padrões do programa", () => {
  /**
   * Os dois padrões que custam caro se estiverem errados: um programa que
   * nasce ligado compromete receita sem decisão, e um que nasce pondo a
   * criança para captar matrícula põe a escola na frente da Resolução
   * 163/2014 do CONANDA sem ninguém ter escolhido isso.
   */
  it("nasce desligado e com o responsável divulgando", () => {
    expect(PROGRAMA_PADRAO.enabled).toBe(false);
    expect(PROGRAMA_PADRAO.whoCanRefer).toBe("responsavel");
  });

  it("devolve o padrão quando a escola nunca configurou nada", async () => {
    const visao = await servico({ findProgram: async () => null }).programa();

    expect(visao.enabled).toBe(false);
    expect(visao.rewardValue).toBe(10);
  });
});

describe("situacaoDe", () => {
  it("só matrícula que vingou confirma desconto", () => {
    expect(situacaoDe("ativa", 0, 3)).toBe("confirmada");
    expect(situacaoDe("concluida", 0, 3)).toBe("confirmada");
    expect(situacaoDe("pendente", 0, 3)).toBe("pendente");
    expect(situacaoDe("suspensa", 0, 3)).toBe("pendente");
  });

  /**
   * O desconto de uma matrícula cancelada tem de cair no mesmo instante. É
   * por isso que a situação é derivada e não coluna: com coluna, ela ficaria
   * de pé até alguém lembrar de sincronizar.
   */
  it("matrícula cancelada ou transferida não vale desconto", () => {
    expect(situacaoDe("cancelada", 0, 3)).toBe("sem_efeito");
    expect(situacaoDe("transferida", 0, 3)).toBe("sem_efeito");
  });

  it("passa a valer 'acima do teto' depois do limite da escola", () => {
    expect(situacaoDe("ativa", 2, 3)).toBe("confirmada");
    expect(situacaoDe("ativa", 3, 3)).toBe("acima_do_teto");
  });
});

describe("apurar", () => {
  /** Critério que a família confere sozinha olhando as datas. */
  it("aplica o teto na ordem de chegada", () => {
    const linhas = [
      linha({ id: "c", createdAt: new Date("2026-03-03T12:00:00Z") }),
      linha({ id: "a", createdAt: new Date("2026-03-01T12:00:00Z") }),
      linha({ id: "b", createdAt: new Date("2026-03-02T12:00:00Z") }),
    ];

    const apuradas = apurar(linhas, 2);

    expect(apuradas.map((i) => [i.id, i.situacao])).toEqual([
      ["a", "confirmada"],
      ["b", "confirmada"],
      ["c", "acima_do_teto"],
    ]);
  });

  /** O teto é por quem indica, não da escola: dois links não competem. */
  it("conta o teto separado por link", () => {
    const apuradas = apurar(
      [
        linha({ id: "a1", linkId: "l1" }),
        linha({ id: "a2", linkId: "l1" }),
        linha({ id: "b1", linkId: "l2" }),
      ],
      1,
    );

    expect(apuradas.find((i) => i.id === "a1")?.situacao).toBe("confirmada");
    expect(apuradas.find((i) => i.id === "a2")?.situacao).toBe("acima_do_teto");
    expect(apuradas.find((i) => i.id === "b1")?.situacao).toBe("confirmada");
  });

  /** Indicação cancelada não consome vaga no teto de quem indicou. */
  it("matrícula sem efeito não gasta o teto", () => {
    const apuradas = apurar(
      [
        linha({ id: "a", enrollmentStatus: "cancelada" }),
        linha({ id: "b", createdAt: new Date("2026-03-02T12:00:00Z") }),
      ],
      1,
    );

    expect(apuradas.find((i) => i.id === "b")?.situacao).toBe("confirmada");
  });
});

describe("totalizar", () => {
  /**
   * 40% com teto de 3 daria 120% — mensalidade negativa. O teto de 100% é o
   * que impede a configuração da escola de produzir um número impossível.
   */
  it("não deixa o desconto passar de 100%", () => {
    const apuradas = apurar(
      [
        linha({ id: "a", rewardValue: 40 }),
        linha({ id: "b", rewardValue: 40, createdAt: new Date("2026-03-02T12:00:00Z") }),
        linha({ id: "c", rewardValue: 40, createdAt: new Date("2026-03-03T12:00:00Z") }),
      ],
      3,
    );

    expect(totalizar(apuradas).percentual).toBe(100);
  });

  /** Percentual e centavo são unidades diferentes: somá-los daria lixo. */
  it("mantém percentual e valor separados", () => {
    const apuradas = apurar(
      [
        linha({ id: "a", rewardKind: "percentual", rewardValue: 10 }),
        linha({
          id: "b",
          rewardKind: "valor",
          rewardValue: 5000,
          createdAt: new Date("2026-03-02T12:00:00Z"),
        }),
      ],
      3,
    );

    expect(totalizar(apuradas)).toMatchObject({ percentual: 10, centavos: 5000, confirmadas: 2 });
  });

  it("só o que está confirmado entra na conta", () => {
    const apuradas = apurar([linha({ id: "a", enrollmentStatus: "pendente", rewardValue: 30 })], 3);

    expect(totalizar(apuradas)).toMatchObject({ percentual: 0, pendentes: 1, confirmadas: 0 });
  });
});

describe("garantirLink", () => {
  it("recusa enquanto o programa estiver desligado", async () => {
    await expect(
      servico({ findProgram: async () => ({ ...PROGRAMA, enabled: false }) as never }).garantirLink(
        "a1",
      ),
    ).rejects.toThrow(/desligado/);
  });

  it("recusa aluno de outra escola", async () => {
    await expect(
      servico({ findStudent: async () => null }).garantirLink("a1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  /** Pedir duas vezes não pode dar dois códigos: o link é o mesmo, sempre. */
  it("devolve o link existente em vez de criar outro", async () => {
    let criou = 0;
    const s = servico({
      findLinkByStudent: async () => ({ id: "l1", code: "MA4K2Z" }) as never,
      createLink: async (d) => {
        criou += 1;
        return { id: "novo", ...d } as never;
      },
    });

    expect((await s.garantirLink("a1")).link.code).toBe("MA4K2Z");
    expect(criou).toBe(0);
  });

  it("põe prazo no link conforme o programa", async () => {
    const { link } = await servico().garantirLink("a1");

    // 90 dias, que é o padrão do programa.
    expect(link.expiresAt?.toISOString().slice(0, 10)).toBe("2026-06-08");
  });

  it("sem prazo configurado, o link não vence", async () => {
    const s = servico({
      findProgram: async () => ({ ...PROGRAMA, linkExpiresInDays: 0 }) as never,
    });

    expect((await s.garantirLink("a1")).link.expiresAt).toBeNull();
  });
});

describe("registrarConversao", () => {
  const comCodigo = (over: Partial<ReferralRepository> = {}) =>
    servico({
      findLinkByCode: async () => ({
        id: "l1",
        studentId: "a1",
        code: "MA4K2Z",
        expiresAt: null,
        revokedAt: null,
        studentName: "Maria Clara",
      }),
      ...over,
    });

  it("recusa enquanto o programa estiver desligado", async () => {
    await expect(
      comCodigo({
        findProgram: async () => ({ ...PROGRAMA, enabled: false }) as never,
      }).registrarConversao({
        enrollmentId: "m1",
        code: "MA4K2Z",
      }),
    ).rejects.toThrow(/desligado/);
  });

  it("aceita o código como a pessoa digitou", async () => {
    const vistos: string[] = [];
    const s = servico({
      findLinkByCode: async (c) => {
        vistos.push(c);
        return {
          id: "l1",
          studentId: "a1",
          code: c,
          expiresAt: null,
          revokedAt: null,
          studentName: "M",
        };
      },
    });

    await s.registrarConversao({ enrollmentId: "m1", code: " ma-4k2z " });

    expect(vistos).toEqual(["MA4K2Z"]);
  });

  it("recusa código inexistente, dizendo qual", async () => {
    await expect(
      servico().registrarConversao({ enrollmentId: "m1", code: "ZZ9999" }),
    ).rejects.toThrow(/ZZ9999/);
  });

  it("recusa código revogado e código vencido", async () => {
    const revogado = comCodigo({
      findLinkByCode: async () => ({
        id: "l1",
        studentId: "a1",
        code: "MA4K2Z",
        expiresAt: null,
        revokedAt: AGORA,
        studentName: "M",
      }),
    });
    await expect(
      revogado.registrarConversao({ enrollmentId: "m1", code: "MA4K2Z" }),
    ).rejects.toThrow(/revogado/);

    const vencido = comCodigo({
      findLinkByCode: async () => ({
        id: "l1",
        studentId: "a1",
        code: "MA4K2Z",
        expiresAt: new Date("2026-01-01T00:00:00Z"),
        revokedAt: null,
        studentName: "M",
      }),
    });
    await expect(
      vencido.registrarConversao({ enrollmentId: "m1", code: "MA4K2Z" }),
    ).rejects.toThrow(/vencido/);
  });

  /** O primeiro atalho que alguém tenta, e o que nenhum índice pega. */
  it("recusa o aluno indicando a própria matrícula", async () => {
    const s = comCodigo({
      findEnrollment: async (id) => ({
        id,
        studentId: "a1",
        status: "pendente",
        academicYear: 2026,
        studentName: "Maria Clara",
      }),
    });

    await expect(s.registrarConversao({ enrollmentId: "m1", code: "MA4K2Z" })).rejects.toThrow(
      /próprio aluno/,
    );
  });

  it("recusa matrícula de outra escola", async () => {
    await expect(
      comCodigo({ findEnrollment: async () => null }).registrarConversao({
        enrollmentId: "m1",
        code: "MA4K2Z",
      }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  /** Mudar a regra em março não pode alterar o desconto de fevereiro. */
  it("congela o prêmio do dia", async () => {
    const criada = await comCodigo().registrarConversao({ enrollmentId: "m1", code: "MA4K2Z" });

    expect(criada).toMatchObject({ rewardKind: "percentual", rewardValue: 10 });
  });

  /**
   * O dublê reproduz a forma real do erro: o Drizzle embrulha o do Postgres, e
   * o nome da constraint vive no `cause`. A primeira versão deste teste
   * lançava um `Error` com o nome na mensagem — passava, e escondia que o
   * service nunca casaria em produção.
   */
  it("traduz a colisão do índice em conflito legível", async () => {
    const s = comCodigo({
      createConversion: async () => {
        const doPostgres = Object.assign(new Error("duplicate key value"), {
          code: "23505",
          constraint: "referral_conversion_enrollment_uidx",
        });
        throw new Error('Failed query: insert into "referral_conversion" …', {
          cause: doPostgres,
        });
      },
    });

    await expect(
      s.registrarConversao({ enrollmentId: "m1", code: "MA4K2Z" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("meuPainel", () => {
  /** Conta sem ficha de aluno não é erro: professor e secretaria abrem a tela. */
  it("devolve vazio para quem não é aluno", async () => {
    const painel = await servico().meuPainel("u1", 2026);

    expect(painel.aluno).toBeNull();
    expect(painel.link).toBeNull();
  });

  it("com o programa desligado não mostra link nem indicação", async () => {
    const painel = await servico({
      findProgram: async () => ({ ...PROGRAMA, enabled: false }) as never,
      findStudentByUser: async () => ({ id: "a1", name: "Maria" }),
      findLinkByStudent: async () => ({ id: "l1", code: "MA4K2Z" }) as never,
    }).meuPainel("u1", 2026);

    expect(painel.link).toBeNull();
    expect(painel.indicacoes).toEqual([]);
  });

  it("traz o link e as indicações do próprio aluno", async () => {
    const painel = await servico({
      findStudentByUser: async () => ({ id: "a1", name: "Maria Clara" }),
      findLinkByStudent: async () => ({ id: "l1", code: "MA4K2Z" }) as never,
      listConversionsByStudent: async () => [linha({ id: "c1" })],
    }).meuPainel("u1", 2026);

    expect(painel.link?.code).toBe("MA4K2Z");
    expect(painel.indicacoes).toHaveLength(1);
    expect(painel.resumo).toMatchObject({ confirmadas: 1, percentual: 10 });
  });
});

describe("removerConversao", () => {
  it("recusa indicação de outra escola", async () => {
    await expect(
      servico({ removeConversion: async () => null }).removerConversao("c1"),
    ).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("validação de entrada", () => {
  it("o programa recusa percentual acima de 100", async () => {
    const { updateProgramInput } = await import("./schema");
    const saida = updateProgramInput.safeParse({
      ...PROGRAMA_PADRAO,
      rewardKind: "percentual",
      rewardValue: 120,
    });

    expect(saida.success).toBe(false);
  });

  /** Valor fixo em centavos pode passar de 100 sem problema nenhum. */
  it("valor fixo não sofre o teto de 100", async () => {
    const { updateProgramInput } = await import("./schema");
    const saida = updateProgramInput.safeParse({
      ...PROGRAMA_PADRAO,
      rewardKind: "valor",
      rewardValue: 15000,
    });

    expect(saida.success).toBe(true);
  });
});

describe("ValidationError", () => {
  it("é o tipo que o programa desligado lança", async () => {
    await expect(
      servico({ findProgram: async () => ({ ...PROGRAMA, enabled: false }) as never }).garantirLink(
        "a1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});
