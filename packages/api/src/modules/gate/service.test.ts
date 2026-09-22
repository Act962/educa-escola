import { describe, expect, it } from "vitest";

import { ConflictError, ValidationError } from "../../errors";
import type { GateRepository } from "./repository";
import { cifrarMolde } from "./segredo";
import { createGateService } from "./service";

/** 32 bytes em base64, só para o teste. Não é segredo de lugar nenhum. */
const CHAVE = Buffer.alloc(32, 3).toString("base64");
const AGORA = new Date("2026-09-22T07:04:00");

const aluno = (over: Partial<Awaited<ReturnType<GateRepository["findStudent"]>>> = {}) => ({
  studentId: "a1",
  name: "Weydson Lima",
  registration: "2026-1284",
  shift: "manha" as const,
  status: "ativo" as const,
  classroomName: "9º C",
  ...over,
});

function fakeRepo(over: Partial<GateRepository> = {}): GateRepository {
  return {
    listTemplates: async () => [],
    findStudent: async () => aluno(),
    findByRegistration: async () => aluno(),
    hasBiometricConsent: async () => true,
    saveTemplate: async () => ({ id: "t1" }),
    deleteTemplate: async () => undefined,
    recordEntry: async () => ({ id: "e1", occurredAt: AGORA }),
    lastEntryOf: async () => null,
    presentCount: async () => 0,
    listEntries: async () => [],
    ...over,
  } as GateRepository;
}

/**
 * Opções num objeto, e não parâmetro com valor padrão.
 *
 * `(over, chave = CHAVE)` chamado com `undefined` explícito **usa o padrão** —
 * e o teste de "sem chave no servidor" passa a afirmar o contrário do que diz.
 * Já aconteceu no módulo do Astro; aqui o erro custaria um molde biométrico
 * gravado sem cifragem.
 */
const servico = (opcoes: { repo?: Partial<GateRepository>; semChave?: boolean } = {}) =>
  createGateService(fakeRepo(opcoes.repo ?? {}), {
    now: () => AGORA,
    chave: opcoes.semChave ? undefined : CHAVE,
    actor: { userId: "u1" },
  });

/** Um molde gravado de verdade: cifrado, como sai do banco. */
function moldeDe(studentId: string, descritor: number[], extractor = "ext-a") {
  const c = cifrarMolde(descritor, CHAVE);
  return {
    studentId,
    cipher: c.cipher,
    iv: c.iv,
    authTag: c.authTag,
    dimensions: descritor.length,
    extractor,
  };
}

describe("lote", () => {
  it("decifra os moldes e devolve prazo de validade", async () => {
    const s = servico({ repo: { listTemplates: async () => [moldeDe("a1", [0.1, 0.2, 0.3])] } });
    const lote = await s.lote();

    expect(lote.alunos).toEqual([{ studentId: "a1", descritor: [0.1, 0.2, 0.3] }]);
    expect(lote.extractor).toBe("ext-a");
    expect(lote.validoAte.getTime()).toBeGreaterThan(AGORA.getTime());
  });

  /**
   * O prazo é o que faz uma revogação chegar ao portão: passado ele, o
   * quiosque desliga o rosto e pede a carteirinha.
   */
  it("o prazo é curto o bastante para caber num turno", async () => {
    const lote = await servico().lote();
    const minutos = (lote.validoAte.getTime() - AGORA.getTime()) / 60_000;
    expect(minutos).toBeLessThanOrEqual(15);
  });

  /**
   * Molde de extrator diferente comparado com o do lote devolve distância sem
   * significado — e distância sem significado passa pelo limiar por acaso.
   */
  it("não mistura moldes de extratores diferentes", async () => {
    const s = servico({
      repo: {
        listTemplates: async () => [
          moldeDe("a1", [0, 0, 0], "ext-a"),
          moldeDe("a2", [1, 1, 1], "ext-b"),
        ],
      },
    });
    const lote = await s.lote();

    expect(lote.alunos.map((a) => a.studentId)).toEqual(["a1"]);
    expect(lote.pendentesDeRecadastro).toBe(1);
  });
});

describe("identificarRosto", () => {
  const comMolde = { listTemplates: async () => [moldeDe("a1", [0, 0, 0])] };

  it("acha o aluno e devolve o cartão da portaria", async () => {
    const saida = await servico({ repo: comMolde }).identificarRosto({
      descritor: [0.01, 0, 0],
      extractor: "ext-a",
    });

    expect(saida.encontrado).toBe(true);
    expect(saida.encontrado && saida.aluno.name).toBe("Weydson Lima");
  });

  /**
   * O cartão da portaria é só identidade: nome, turma, turno e matrícula.
   * Nota, frequência e responsável não entram numa tela que fica ligada num
   * corredor onde qualquer um passa.
   */
  it("o cartão não carrega nota, frequência nem responsável", async () => {
    const saida = await servico({ repo: comMolde }).identificarRosto({
      descritor: [0, 0, 0],
      extractor: "ext-a",
    });

    const campos = Object.keys(saida.encontrado ? saida.aluno : {});
    expect(campos.sort()).toEqual(
      ["classroomName", "name", "registration", "shift", "status", "studentId"].sort(),
    );
  });

  it("rosto desconhecido não vira o aluno mais parecido", async () => {
    const saida = await servico({ repo: comMolde }).identificarRosto({
      descritor: [9, 9, 9],
      extractor: "ext-a",
    });
    expect(saida).toEqual({ encontrado: false, motivo: "ninguem" });
  });

  it("recusa quando o tablet usa outro extrator", async () => {
    await expect(
      servico({ repo: comMolde }).identificarRosto({ descritor: [0, 0, 0], extractor: "ext-z" }),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("registrar", () => {
  it("grava a passagem e devolve o horário", async () => {
    const gravadas: unknown[] = [];
    const s = servico({
      repo: {
        recordEntry: async (data) => {
          gravadas.push(data);
          return { id: "e1", occurredAt: data.occurredAt };
        },
      },
    });

    const saida = await s.registrar({ studentId: "a1", direction: "entrada", method: "rosto" });

    expect(saida.repetida).toBe(false);
    expect(gravadas).toHaveLength(1);
    expect(saida.occurredAt).toEqual(AGORA);
  });

  /**
   * Fila de portão relê a mesma pessoa o tempo todo. Gravar as duas estragaria
   * a conta de quem está dentro — e para quem está no portão nada deu errado,
   * então a tela mostra o cartão do mesmo jeito.
   */
  it("ignora a segunda leitura igual dentro de um minuto", async () => {
    const gravadas: unknown[] = [];
    const s = servico({
      repo: {
        lastEntryOf: async () => ({
          direction: "entrada" as const,
          occurredAt: new Date(AGORA.getTime() - 5_000),
        }),
        recordEntry: async (data) => {
          gravadas.push(data);
          return { id: "e1", occurredAt: data.occurredAt };
        },
      },
    });

    const saida = await s.registrar({ studentId: "a1", direction: "entrada", method: "rosto" });

    expect(saida.repetida).toBe(true);
    // A tela mostra o cartão do mesmo jeito: para quem está no portão, nada
    // deu errado. O que não acontece é a segunda linha no banco.
    expect(saida.aluno.name).toBe("Weydson Lima");
    expect(gravadas).toHaveLength(0);
  });

  it("a saída logo depois da entrada é gravada, porque é outra direção", async () => {
    const gravadas: unknown[] = [];
    const s = servico({
      repo: {
        lastEntryOf: async () => ({
          direction: "entrada" as const,
          occurredAt: new Date(AGORA.getTime() - 5_000),
        }),
        recordEntry: async (data) => {
          gravadas.push(data);
          return { id: "e1", occurredAt: data.occurredAt };
        },
      },
    });

    await s.registrar({ studentId: "a1", direction: "saida", method: "carteirinha" });
    expect(gravadas).toHaveLength(1);
  });

  it("aluno com matrícula inativa não passa, e a mensagem diz o que fazer", async () => {
    const s = servico({ repo: { findStudent: async () => aluno({ status: "transferido" }) } });

    await expect(
      s.registrar({ studentId: "a1", direction: "entrada", method: "rosto" }),
    ).rejects.toThrow(/secretaria/i);
    await expect(
      s.registrar({ studentId: "a1", direction: "entrada", method: "rosto" }),
    ).rejects.toBeInstanceOf(ConflictError);
  });
});

describe("cadastrarMolde", () => {
  it("recusa sem consentimento de biometria, e manda para a carteirinha", async () => {
    const gravados: unknown[] = [];
    const s = servico({
      repo: {
        hasBiometricConsent: async () => false,
        saveTemplate: async (d) => {
          gravados.push(d);
          return { id: "t1" };
        },
      },
    });

    await expect(
      s.cadastrarMolde({ studentId: "a1", descritor: [0, 1], extractor: "ext-a" }),
    ).rejects.toThrow(/carteirinha/i);
    expect(gravados).toHaveLength(0);
  });

  it("grava cifrado, e o que vai ao banco não é o vetor em claro", async () => {
    const gravados: { cipher: string; dimensions: number }[] = [];
    const s = servico({
      repo: {
        saveTemplate: async (d) => {
          gravados.push(d);
          return { id: "t1" };
        },
      },
    });

    await s.cadastrarMolde({ studentId: "a1", descritor: [0.5, 0.25], extractor: "ext-a" });

    expect(gravados[0]?.dimensions).toBe(2);
    expect(gravados[0]?.cipher).not.toContain("0.5");
    expect(gravados[0]?.cipher).not.toContain("0.25");
  });

  it("sem a chave do servidor, não grava nada", async () => {
    const gravados: unknown[] = [];
    const s = servico({
      semChave: true,
      repo: {
        saveTemplate: async (d) => {
          gravados.push(d);
          return { id: "t1" };
        },
      },
    });

    await expect(
      s.cadastrarMolde({ studentId: "a1", descritor: [0, 1], extractor: "ext-a" }),
    ).rejects.toThrow(/MEDIA_ENCRYPTION_KEY/);
    expect(gravados).toHaveLength(0);
  });
});
