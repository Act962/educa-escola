import { describe, expect, it } from "vitest";

import {
  abreConversa,
  CONVERSAS_DE_SERVICO_GRATUITAS,
  consumoDoMes,
  estadoDaCota,
  inicioDoMesDeCobranca,
  JANELA_DE_ATENDIMENTO_MS,
  proximaRenovacao,
  recadoDaCota,
  restaDaJanelaMs,
} from "./billing";

const AGORA = new Date("2026-09-23T14:00:00.000Z");

describe("a janela de atendimento", () => {
  /**
   * Várias mensagens para a mesma pessoa dentro de 24 horas são **uma**
   * conversa para a Meta. Contar mensagens faria o painel acusar consumo de
   * cinco onde houve um — e a escola pararia de falar com a família por causa
   * de um número inventado por nós.
   */
  it("mensagem dentro das 24 horas pega carona na conversa aberta", () => {
    const haDuasHoras = new Date(AGORA.getTime() - 2 * 60 * 60 * 1000);
    expect(abreConversa(haDuasHoras, AGORA)).toBe(false);
  });

  it("passadas as 24 horas, abre conversa nova", () => {
    const limite = new Date(AGORA.getTime() - JANELA_DE_ATENDIMENTO_MS);
    expect(abreConversa(limite, AGORA)).toBe(true);
    expect(abreConversa(new Date(limite.getTime() - 1), AGORA)).toBe(true);
    expect(abreConversa(new Date(limite.getTime() + 1), AGORA)).toBe(false);
  });

  it("número nunca contatado abre conversa", () => {
    expect(abreConversa(null, AGORA)).toBe(true);
  });

  it("diz quanto falta para a janela fechar", () => {
    const haVinteHoras = new Date(AGORA.getTime() - 20 * 60 * 60 * 1000);
    expect(restaDaJanelaMs(haVinteHoras, AGORA)).toBe(4 * 60 * 60 * 1000);
    // Fechada não devolve negativo: a tela mostraria "-3h".
    expect(restaDaJanelaMs(new Date("2026-09-01T00:00:00Z"), AGORA)).toBe(0);
  });
});

describe("o mês de cobrança", () => {
  /**
   * UTC e não `America/Sao_Paulo`: o mês que importa é o da Meta. Usar o fuso
   * da escola faria a virada do painel acontecer três horas depois da virada
   * da fatura, e nessas três horas o contador mostraria zero restante com a
   * cota nova já valendo.
   */
  it("começa à meia-noite UTC do dia 1º", () => {
    expect(inicioDoMesDeCobranca(AGORA).toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("renova na virada para o mês seguinte", () => {
    expect(proximaRenovacao(AGORA).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });

  it("vira o ano em dezembro", () => {
    const dezembro = new Date("2026-12-20T10:00:00Z");
    expect(proximaRenovacao(dezembro).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  /**
   * A borda que erra em silêncio: 23h de São Paulo no dia 30 já é dia 1º em
   * UTC, e a cota daquele envio sai do mês novo.
   */
  it("envio da virada conta no mês da Meta, não no da escola", () => {
    const viradaEmSaoPaulo = new Date("2026-09-30T23:30:00-03:00");
    expect(inicioDoMesDeCobranca(viradaEmSaoPaulo).toISOString()).toBe("2026-10-01T00:00:00.000Z");
  });
});

describe("o semáforo", () => {
  it("acende amarelo aos 75% e vermelho aos 90%", () => {
    expect(estadoDaCota(740, 1000)).toBe("tranquilo");
    expect(estadoDaCota(750, 1000)).toBe("atencao");
    expect(estadoDaCota(900, 1000)).toBe("critico");
    expect(estadoDaCota(1000, 1000)).toBe("esgotado");
    expect(estadoDaCota(1200, 1000)).toBe("esgotado");
  });

  /** Teto zero é cota inexistente, não divisão por zero na tela. */
  it("teto zero é esgotado", () => {
    expect(estadoDaCota(0, 0)).toBe("esgotado");
  });
});

describe("o consumo do mês", () => {
  const base = {
    conversas: 0,
    mensagensPorModelo: 0,
    teto: null,
    bloquearAoEsgotar: true,
    agora: AGORA,
  };

  it("sem teto próprio, usa o padrão da Meta", () => {
    expect(consumoDoMes(base).teto).toBe(CONVERSAS_DE_SERVICO_GRATUITAS);
  });

  it("teto próprio ganha do padrão", () => {
    expect(consumoDoMes({ ...base, teto: 250 }).teto).toBe(250);
  });

  it("restantes nunca fica negativo", () => {
    const consumo = consumoDoMes({ ...base, conversas: 1200 });
    expect(consumo.restantes).toBe(0);
    // A fração passa de 1 de propósito: a barra satura, o número não mente.
    expect(consumo.fracao).toBeCloseTo(1.2);
  });

  /**
   * Bloqueio é escolha da escola, não do código. Esgotada a cota sem bloqueio,
   * a mensagem sai e passa a ser cobrada — o que é uma decisão legítima.
   */
  it("só bloqueia quando a escola pediu e a cota acabou", () => {
    expect(consumoDoMes({ ...base, conversas: 1000 }).bloqueado).toBe(true);
    expect(consumoDoMes({ ...base, conversas: 1000, bloquearAoEsgotar: false }).bloqueado).toBe(
      false,
    );
    expect(consumoDoMes({ ...base, conversas: 999 }).bloqueado).toBe(false);
  });

  /**
   * Mensagem por modelo é cobrada por mensagem e não sai da cota. Somar as
   * duas faria o painel dizer que a cota acabou quando o que acabou foi o
   * dinheiro — ou o contrário.
   */
  it("mensagem por modelo não consome a cota", () => {
    const consumo = consumoDoMes({ ...base, mensagensPorModelo: 5000 });
    expect(consumo.conversas).toBe(0);
    expect(consumo.restantes).toBe(CONVERSAS_DE_SERVICO_GRATUITAS);
    expect(consumo.mensagensPorModelo).toBe(5000);
  });
});

describe("o recado", () => {
  const recadoCom = (conversas: number, bloquear = true) =>
    recadoDaCota(
      consumoDoMes({
        conversas,
        mensagensPorModelo: 0,
        teto: 1000,
        bloquearAoEsgotar: bloquear,
        agora: AGORA,
      }),
    );

  it("muda de tom conforme a cota aperta", () => {
    expect(recadoCom(10)).toContain("990 das 1.000");
    expect(recadoCom(800)).toContain("800 das 1.000");
    expect(recadoCom(950)).toContain("Restam 50");
    expect(recadoCom(1000)).toContain("bloqueadas");
  });

  /**
   * Sem bloqueio a frase não pode falar em travar: diria à direção que o
   * sistema a protegeu quando ele não protegeu.
   */
  it("esgotada sem bloqueio, avisa do custo em vez de prometer trava", () => {
    const frase = recadoCom(1000, false);
    expect(frase).toContain("cobra");
    expect(frase).not.toContain("bloqueadas");
  });
});
