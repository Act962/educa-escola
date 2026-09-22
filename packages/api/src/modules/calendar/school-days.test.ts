import { describe, expect, it } from "vitest";

import {
  contarDiasLetivos,
  diaDaSemana,
  diasEntre,
  type EventoQueAfetaODia,
  ehDiaUtil,
} from "./school-days";

const feriado = (startsOn: string, endsOn = startsOn): EventoQueAfetaODia => ({
  startsOn,
  endsOn,
  dayEffect: "nao_letivo",
});

const reposicao = (startsOn: string): EventoQueAfetaODia => ({
  startsOn,
  endsOn: startsOn,
  dayEffect: "letivo_extra",
});

describe("diasEntre", () => {
  it("inclui as duas pontas", () => {
    expect([...diasEntre("2026-02-05", "2026-02-07")]).toEqual([
      "2026-02-05",
      "2026-02-06",
      "2026-02-07",
    ]);
  });

  it("um dia só devolve um dia", () => {
    expect([...diasEntre("2026-02-05", "2026-02-05")]).toEqual(["2026-02-05"]);
  });

  /** Fevereiro de 2028 tem 29 dias. Aritmética de data não pode chutar. */
  it("atravessa mês e ano bissexto", () => {
    expect([...diasEntre("2028-02-28", "2028-03-01")]).toEqual([
      "2028-02-28",
      "2028-02-29",
      "2028-03-01",
    ]);
  });

  it("atravessa a virada do ano", () => {
    expect([...diasEntre("2026-12-31", "2027-01-01")]).toEqual(["2026-12-31", "2027-01-01"]);
  });
});

describe("ehDiaUtil", () => {
  it("sábado e domingo não são úteis", () => {
    // 2026-02-07 é sábado, 08 é domingo, 09 é segunda.
    expect(diaDaSemana("2026-02-07")).toBe(6);
    expect(ehDiaUtil("2026-02-07")).toBe(false);
    expect(ehDiaUtil("2026-02-08")).toBe(false);
    expect(ehDiaUtil("2026-02-09")).toBe(true);
  });
});

describe("contarDiasLetivos", () => {
  // Segunda 2026-02-02 a sexta 2026-02-06: cinco dias úteis.
  const semana = { startsOn: "2026-02-02", endsOn: "2026-02-06", minimo: 200 };

  it("conta só os dias úteis do período", () => {
    const conta = contarDiasLetivos({ ...semana, endsOn: "2026-02-08", eventos: [] });
    expect(conta.diasUteis).toBe(5);
    expect(conta.letivos).toBe(5);
  });

  it("feriado em dia útil tira um dia", () => {
    const conta = contarDiasLetivos({ ...semana, eventos: [feriado("2026-02-04")] });
    expect(conta.perdidos).toBe(1);
    expect(conta.letivos).toBe(4);
  });

  /** Feriado municipal no sábado não tira dia letivo nenhum. */
  it("feriado em fim de semana não tira nada", () => {
    const conta = contarDiasLetivos({
      startsOn: "2026-02-02",
      endsOn: "2026-02-08",
      minimo: 200,
      eventos: [feriado("2026-02-07")],
    });
    expect(conta.perdidos).toBe(0);
    expect(conta.letivos).toBe(5);
  });

  /**
   * O defeito que esta função existe para não ter: somar durações de evento em
   * vez de marcar dias faria o feriado e o recesso sobrepostos tirarem o mesmo
   * dia duas vezes — e a escola reporia aula que não devia.
   */
  it("dia perdido conta uma vez só, mesmo com eventos sobrepostos", () => {
    const conta = contarDiasLetivos({
      ...semana,
      eventos: [feriado("2026-02-03", "2026-02-05"), feriado("2026-02-04", "2026-02-06")],
    });

    expect(conta.perdidos).toBe(4);
    expect(conta.letivos).toBe(1);
  });

  it("reposição em fim de semana acrescenta dia letivo", () => {
    const conta = contarDiasLetivos({
      startsOn: "2026-02-02",
      endsOn: "2026-02-08",
      minimo: 200,
      eventos: [reposicao("2026-02-07")],
    });
    expect(conta.repostos).toBe(1);
    expect(conta.letivos).toBe(6);
  });

  /** Se a escola marcou aula no feriado, houve aula. */
  it("reposição vence o feriado no mesmo dia", () => {
    const conta = contarDiasLetivos({
      ...semana,
      eventos: [feriado("2026-02-04"), reposicao("2026-02-04")],
    });
    expect(conta.perdidos).toBe(0);
    expect(conta.letivos).toBe(5);
  });

  it("evento sem efeito não mexe na conta", () => {
    const conta = contarDiasLetivos({
      ...semana,
      eventos: [{ startsOn: "2026-02-03", endsOn: "2026-02-03", dayEffect: "nenhum" }],
    });
    expect(conta.letivos).toBe(5);
  });

  describe("mínimo legal", () => {
    it("diz quanto falta e que não cumpre", () => {
      const conta = contarDiasLetivos({ ...semana, minimo: 200, eventos: [] });
      expect(conta.cumpreOMinimo).toBe(false);
      expect(conta.faltam).toBe(195);
    });

    it("cumprir na trave já é cumprir, e não falta nada", () => {
      const conta = contarDiasLetivos({ ...semana, minimo: 5, eventos: [] });
      expect(conta.cumpreOMinimo).toBe(true);
      expect(conta.faltam).toBe(0);
    });

    /** Passar do mínimo não devolve "faltam -3". */
    it("sobrar não vira falta negativa", () => {
      const conta = contarDiasLetivos({ ...semana, minimo: 2, eventos: [] });
      expect(conta.faltam).toBe(0);
    });
  });

  /** Um ano letivo de verdade, para a conta não valer só em semanas curtas. */
  it("ano letivo completo fica perto dos 200 dias", () => {
    const conta = contarDiasLetivos({
      startsOn: "2026-02-02",
      endsOn: "2026-12-18",
      minimo: 200,
      eventos: [
        feriado("2026-02-16", "2026-02-17"),
        feriado("2026-04-03"),
        feriado("2026-04-21"),
        feriado("2026-05-01"),
        feriado("2026-06-04"),
        feriado("2026-09-07"),
        feriado("2026-10-12"),
        feriado("2026-11-02"),
        feriado("2026-11-15"),
        feriado("2026-07-06", "2026-07-17"),
      ],
    });

    // Números conferidos contra uma contagem independente, não estimados.
    expect(conta.diasUteis).toBe(230);
    expect(conta.perdidos).toBe(19);
    expect(conta.letivos).toBe(211);
    expect(conta.cumpreOMinimo).toBe(true);
  });
});
