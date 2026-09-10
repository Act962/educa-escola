import { describe, expect, it } from "vitest";

import { daysBetween, longDate, shortDate, toSchoolDate, toSchoolTime } from "./dates";

describe("datas do dia letivo", () => {
  /**
   * O caso que motiva a função existir: às 21h de São Paulo já é o dia
   * seguinte em UTC. Um `toISOString().slice(0,10)` jogaria a aula da noite
   * para o dia errado, e a chamada apareceria como "de amanhã".
   */
  it("usa o dia civil da escola, não o de UTC", () => {
    const noiteEmSaoPaulo = new Date("2026-09-10T02:30:00Z"); // 23h30 do dia 9

    expect(toSchoolDate(noiteEmSaoPaulo)).toBe("2026-09-09");
    expect(noiteEmSaoPaulo.toISOString().slice(0, 10)).toBe("2026-09-10");
  });

  it("formata a hora no fuso da escola", () => {
    expect(toSchoolTime(new Date("2026-09-09T10:30:00Z"))).toBe("07:30");
  });

  it("escreve a data por extenso em português", () => {
    expect(longDate("2026-09-09")).toBe("quarta-feira, 9 de setembro");
    expect(longDate("2026-03-01")).toBe("domingo, 1 de março");
  });

  it("encurta para dia/mês", () => {
    expect(shortDate("2026-09-09")).toBe("09/09");
  });

  it("conta dias inteiros, com sinal", () => {
    expect(daysBetween("2026-09-09", "2026-09-21")).toBe(12);
    expect(daysBetween("2026-09-21", "2026-09-09")).toBe(-12);
    // Atravessa o horário de verão sem perder ou ganhar um dia.
    expect(daysBetween("2026-02-01", "2026-03-01")).toBe(28);
  });
});
