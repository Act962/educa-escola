import { describe, expect, it } from "vitest";

import { dataParaISO, idadeEm, isoParaData, mascararCelular, mascararData } from "./masks";

describe("mascararCelular", () => {
  it("formata celular de nove dígitos", () => {
    expect(mascararCelular("86998122039")).toBe("(86) 99812-2039");
  });

  it("formata fixo de oito dígitos sem ramificar", () => {
    expect(mascararCelular("8632154400")).toBe("(86) 3215-4400");
  });

  it("acompanha a digitação, caractere a caractere", () => {
    expect(mascararCelular("8")).toBe("(8");
    expect(mascararCelular("86")).toBe("(86");
    expect(mascararCelular("869")).toBe("(86) 9");
    expect(mascararCelular("8699812")).toBe("(86) 9-9812");
  });

  it("ignora o que já está formatado e descarta o excesso", () => {
    expect(mascararCelular("(86) 99812-2039")).toBe("(86) 99812-2039");
    expect(mascararCelular("869981220399999")).toBe("(86) 99812-2039");
  });
});

describe("mascararData", () => {
  it("insere as barras conforme se digita", () => {
    expect(mascararData("1")).toBe("1");
    expect(mascararData("14")).toBe("14");
    expect(mascararData("1403")).toBe("14/03");
    expect(mascararData("14032015")).toBe("14/03/2015");
  });

  it("não deixa passar do ano", () => {
    expect(mascararData("140320159999")).toBe("14/03/2015");
  });

  /** Apagar no meio não pode travar o campo. */
  it("reconstrói a partir dos dígitos, não do texto", () => {
    expect(mascararData("14/0/2015")).toBe("14/02/015");
    expect(mascararData("")).toBe("");
  });
});

describe("dataParaISO", () => {
  it("converte data completa", () => {
    expect(dataParaISO("14/03/2015")).toBe("2015-03-14");
  });

  it("recusa data incompleta", () => {
    expect(dataParaISO("14/03")).toBeNull();
    expect(dataParaISO("")).toBeNull();
  });

  /** O `Date` rola 31/02 para 03/03 sem reclamar — daí a checagem de volta. */
  it("recusa dia que não existe no mês", () => {
    expect(dataParaISO("31/02/2015")).toBeNull();
    expect(dataParaISO("31/04/2015")).toBeNull();
    expect(dataParaISO("29/02/2015")).toBeNull();
    expect(dataParaISO("29/02/2016")).toBe("2016-02-29");
  });

  it("recusa mês impossível", () => {
    expect(dataParaISO("14/13/2015")).toBeNull();
  });
});

describe("isoParaData", () => {
  it("volta ao formato do campo", () => {
    expect(isoParaData("2015-03-14")).toBe("14/03/2015");
    expect(isoParaData(null)).toBe("");
  });
});

describe("idadeEm", () => {
  const hoje = new Date("2026-09-21T12:00:00Z");

  it("conta ano completo", () => {
    expect(idadeEm("2015-03-14", hoje)).toBe(11);
  });

  it("desconta quando o aniversário ainda não chegou", () => {
    expect(idadeEm("2015-12-01", hoje)).toBe(10);
  });

  it("conta o próprio dia do aniversário", () => {
    expect(idadeEm("2015-09-21", hoje)).toBe(11);
  });

  /**
   * 2051 no lugar de 2015 é o erro de digitação comum. A idade negativa é o
   * que faz ele aparecer na tela antes de virar matrícula errada.
   */
  it("devolve idade negativa para ano no futuro", () => {
    expect(idadeEm("2051-03-14", hoje)).toBe(-25);
  });

  it("devolve nulo sem data", () => {
    expect(idadeEm(null, hoje)).toBeNull();
  });
});
