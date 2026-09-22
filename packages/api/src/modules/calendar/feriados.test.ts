import { describe, expect, it } from "vitest";

import { contarDiasLetivos } from "./dias-letivos";
import {
  calendarioBrasileiro,
  datasComemorativas,
  domingoDePascoa,
  feriadosNacionais,
  pontosFacultativos,
  recessoDeJulho,
  somarDias,
} from "./feriados";

const acha = <T extends { title: string }>(lista: T[], titulo: string) =>
  lista.find((d) => d.title.includes(titulo));

describe("domingoDePascoa", () => {
  /**
   * Valores conferidos contra o calendário litúrgico. Metade dos feriados
   * brasileiros deriva daqui — se esta conta errar, erram Carnaval,
   * Sexta-feira Santa e Corpus Christi de uma vez.
   */
  it("acerta anos conhecidos", () => {
    expect(domingoDePascoa(2024)).toBe("2024-03-31");
    expect(domingoDePascoa(2025)).toBe("2025-04-20");
    expect(domingoDePascoa(2026)).toBe("2026-04-05");
    expect(domingoDePascoa(2027)).toBe("2027-03-28");
    expect(domingoDePascoa(2028)).toBe("2028-04-16");
    expect(domingoDePascoa(2030)).toBe("2030-04-21");
  });

  /** A Páscoa é sempre domingo. Invariante que pega erro de deslocamento. */
  it("cai sempre num domingo", () => {
    for (let ano = 2024; ano <= 2040; ano++) {
      const dia = new Date(`${domingoDePascoa(ano)}T12:00:00Z`).getUTCDay();
      expect(dia).toBe(0);
    }
  });

  it("fica entre 22 de março e 25 de abril, como manda a regra", () => {
    for (let ano = 2024; ano <= 2060; ano++) {
      const data = domingoDePascoa(ano);
      expect(data >= `${ano}-03-22`).toBe(true);
      expect(data <= `${ano}-04-25`).toBe(true);
    }
  });
});

describe("somarDias", () => {
  it("atravessa mês, ano e fevereiro bissexto", () => {
    expect(somarDias("2026-02-28", 1)).toBe("2026-03-01");
    expect(somarDias("2028-02-28", 1)).toBe("2028-02-29");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("feriadosNacionais", () => {
  it("traz os dez feriados nacionais", () => {
    expect(feriadosNacionais(2026)).toHaveLength(10);
  });

  /**
   * O erro mais comum desta lista. A Lei 14.759/2023 tornou o 20 de novembro
   * feriado nacional a partir de 2024 — muitas agendas ainda o trazem como
   * facultativo.
   */
  it("traz a Consciência Negra como feriado nacional, com a lei", () => {
    const data = acha(feriadosNacionais(2026), "Consciência Negra");
    expect(data).toMatchObject({ startsOn: "2026-11-20", dayEffect: "nao_letivo" });
    expect(data?.fonte).toContain("14.759/2023");
  });

  it("a Sexta-feira Santa acompanha a Páscoa", () => {
    expect(acha(feriadosNacionais(2026), "Sexta-feira Santa")?.startsOn).toBe("2026-04-03");
    expect(acha(feriadosNacionais(2025), "Sexta-feira Santa")?.startsOn).toBe("2025-04-18");
  });

  it("todo feriado nacional tira dia letivo e cita a lei", () => {
    for (const data of feriadosNacionais(2026)) {
      expect(data.dayEffect).toBe("nao_letivo");
      expect(data.fonte).toMatch(/Lei|Decreto/);
    }
  });

  it("vem em ordem de data", () => {
    const datas = feriadosNacionais(2026).map((d) => d.startsOn);
    expect([...datas].sort()).toEqual(datas);
  });
});

describe("pontosFacultativos", () => {
  it("Carnaval, Cinzas e Corpus Christi acompanham a Páscoa", () => {
    const lista = pontosFacultativos(2026);

    // Páscoa 2026 em 05/04: Carnaval 16 e 17/02, Cinzas 18/02, Corpus 04/06.
    expect(acha(lista, "Carnaval")).toMatchObject({
      startsOn: "2026-02-16",
      endsOn: "2026-02-17",
    });
    expect(acha(lista, "Cinzas")?.startsOn).toBe("2026-02-18");
    expect(acha(lista, "Corpus Christi")?.startsOn).toBe("2026-06-04");
  });

  /** Não são feriado por lei federal, e a origem precisa dizer isso. */
  it("diz que são ponto facultativo, não feriado", () => {
    for (const data of pontosFacultativos(2026)) {
      expect(data.fonte).toContain("facultativo");
    }
  });
});

describe("datasComemorativas", () => {
  /**
   * "Dia dos Povos Indígenas" é o nome oficial desde a Lei 14.402/2022. O
   * termo anterior é pejorativo, e a lei é recente o bastante para muita
   * agenda ainda trazer o antigo.
   */
  it("usa o nome oficial dos Povos Indígenas, e cita a lei que renomeou", () => {
    const data = acha(datasComemorativas(2026), "Povos Indígenas");
    expect(data?.startsOn).toBe("2026-04-19");
    expect(data?.fonte).toContain("14.402/2022");
    expect(data?.title).not.toContain("Índio");
  });

  /** Tem aula no Dia do Folclore. Elas são gancho de projeto, não folga. */
  it("nenhuma data comemorativa tira dia letivo", () => {
    for (const data of datasComemorativas(2026)) {
      expect(data.dayEffect).toBe("nenhum");
    }
  });

  it("traz as datas da história do Brasil", () => {
    const lista = datasComemorativas(2026);
    expect(acha(lista, "Abolição")?.startsOn).toBe("2026-05-13");
    expect(acha(lista, "Descobrimento")?.startsOn).toBe("2026-04-22");
    expect(acha(lista, "Folclore")?.startsOn).toBe("2026-08-22");
    expect(acha(lista, "Bandeira")?.startsOn).toBe("2026-11-19");
  });
});

describe("recessoDeJulho", () => {
  it("começa na primeira segunda de julho e dura duas semanas", () => {
    const recesso = recessoDeJulho(2026);
    // 2026-07-06 é a primeira segunda-feira de julho.
    expect(recesso.startsOn).toBe("2026-07-06");
    expect(recesso.endsOn).toBe("2026-07-17");
    expect(new Date(`${recesso.startsOn}T12:00:00Z`).getUTCDay()).toBe(1);
  });

  /** Cada rede define o seu — vem como sugestão, e a origem diz isso. */
  it("se apresenta como sugestão", () => {
    expect(recessoDeJulho(2026).fonte).toContain("Sugestão");
  });
});

describe("calendarioBrasileiro", () => {
  it("junta tudo em ordem de data, sem repetir dia e título", () => {
    const lista = calendarioBrasileiro(2026);
    const chaves = lista.map((d) => `${d.startsOn}|${d.title}`);

    expect(new Set(chaves).size).toBe(chaves.length);
    expect([...lista.map((d) => d.startsOn)].sort()).toEqual(lista.map((d) => d.startsOn));
  });

  /**
   * O teste que amarra as duas metades do módulo: o calendário sugerido,
   * jogado na contagem de dias letivos de um ano típico, tem de deixar a
   * escola perto dos 200 dias — e não abaixo.
   */
  it("um ano letivo com o calendário sugerido cumpre o mínimo legal", () => {
    const conta = contarDiasLetivos({
      startsOn: "2026-02-02",
      endsOn: "2026-12-18",
      minimo: 200,
      eventos: calendarioBrasileiro(2026),
    });

    expect(conta.cumpreOMinimo).toBe(true);
    expect(conta.letivos).toBeGreaterThanOrEqual(200);
    expect(conta.letivos).toBeLessThan(conta.diasUteis);
  });
});
