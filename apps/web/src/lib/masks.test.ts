import { describe, expect, it } from "vitest";

import { dateToISO, idadeEm, isoToDate, maskDate, maskPhone } from "./masks";

describe("mascararCelular", () => {
  it("formata celular de nove dígitos", () => {
    expect(maskPhone("86998122039")).toBe("(86) 99812-2039");
  });

  it("formata fixo de oito dígitos sem ramificar", () => {
    expect(maskPhone("8632154400")).toBe("(86) 3215-4400");
  });

  it("acompanha a digitação, caractere a caractere", () => {
    expect(maskPhone("8")).toBe("(8");
    expect(maskPhone("86")).toBe("(86");
    expect(maskPhone("869")).toBe("(86) 9");
    expect(maskPhone("8699812")).toBe("(86) 9-9812");
  });

  it("ignora o que já está formatado e descarta o excesso", () => {
    expect(maskPhone("(86) 99812-2039")).toBe("(86) 99812-2039");
    expect(maskPhone("869981220399999")).toBe("(86) 99812-2039");
  });
});

describe("mascararData", () => {
  it("insere as barras conforme se digita", () => {
    expect(maskDate("1")).toBe("1");
    expect(maskDate("14")).toBe("14");
    expect(maskDate("1403")).toBe("14/03");
    expect(maskDate("14032015")).toBe("14/03/2015");
  });

  it("não deixa passar do ano", () => {
    expect(maskDate("140320159999")).toBe("14/03/2015");
  });

  /** Apagar no meio não pode travar o campo. */
  it("reconstrói a partir dos dígitos, não do texto", () => {
    expect(maskDate("14/0/2015")).toBe("14/02/015");
    expect(maskDate("")).toBe("");
  });
});

describe("dataParaISO", () => {
  it("converte data completa", () => {
    expect(dateToISO("14/03/2015")).toBe("2015-03-14");
  });

  it("recusa data incompleta", () => {
    expect(dateToISO("14/03")).toBeNull();
    expect(dateToISO("")).toBeNull();
  });

  /** O `Date` rola 31/02 para 03/03 sem reclamar — daí a checagem de volta. */
  it("recusa dia que não existe no mês", () => {
    expect(dateToISO("31/02/2015")).toBeNull();
    expect(dateToISO("31/04/2015")).toBeNull();
    expect(dateToISO("29/02/2015")).toBeNull();
    expect(dateToISO("29/02/2016")).toBe("2016-02-29");
  });

  it("recusa mês impossível", () => {
    expect(dateToISO("14/13/2015")).toBeNull();
  });
});

describe("isoParaData", () => {
  it("volta ao formato do campo", () => {
    expect(isoToDate("2015-03-14")).toBe("14/03/2015");
    expect(isoToDate(null)).toBe("");
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
