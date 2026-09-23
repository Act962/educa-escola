import { describe, expect, it } from "vitest";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { CONVERSAS_DE_SERVICO_GRATUITAS } from "../../messaging/whatsapp/billing";
import { createMemoryChannel, type MemoryChannel } from "../../messaging/whatsapp/memory";
import {
  CredencialRecusadaError,
  ForaDaJanelaError,
  type WhatsAppChannel,
} from "../../messaging/whatsapp/port";
import type { WhatsAppRepository } from "./repository";
import { encryptSecret } from "./secret";
import { createWhatsAppService } from "./service";

/** 32 bytes em base64, só para o teste. Não é segredo de lugar nenhum. */
const CHAVE = Buffer.alloc(32, 9).toString("base64");
const AGORA = new Date("2026-09-22T10:00:00");

type Conta = NonNullable<Awaited<ReturnType<WhatsAppRepository["findAccount"]>>>;
type Modelo = NonNullable<Awaited<ReturnType<WhatsAppRepository["findTemplate"]>>>;
type Mensagem = Awaited<ReturnType<WhatsAppRepository["insertMessage"]>>;

/**
 * O token do fixture é cifrado de verdade.
 *
 * Com `iv` inventado, `canalDa` estouraria em "Invalid initialization vector" e
 * o teste que deveria provar a regra passaria a provar que o fixture estava
 * errado — armadilha que já custou uma investigação no Astro.
 */
const TOKEN = encryptSecret("EAAtoken-de-teste-9K3Z", CHAVE);

const conta = (over: Partial<Conta> = {}): Conta =>
  ({
    id: "c1",
    schoolId: "e1",
    provider: "cloud",
    label: "Secretaria",
    phoneNumberId: "111",
    wabaId: "222",
    appId: "333",
    displayPhoneNumber: null,
    verifiedName: null,
    qualityRating: null,
    tokenCipher: TOKEN.cipher,
    tokenIv: TOKEN.iv,
    tokenTag: TOKEN.authTag,
    tokenHint: "••••9K3Z",
    appSecretCipher: null,
    appSecretIv: null,
    appSecretTag: null,
    status: "rascunho",
    lastError: null,
    checkedAt: null,
    isDefault: true,
    freeTierLimit: null,
    blockWhenExhausted: true,
    createdByUserId: "u1",
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  }) as Conta;

const modelo = (over: Partial<Modelo> = {}): Modelo =>
  ({
    id: "m1",
    schoolId: "e1",
    accountId: "c1",
    name: "aviso_de_reuniao",
    category: "UTILITY",
    language: "pt_BR",
    headerText: null,
    body: "Olá, {{responsavel}}. A reunião é dia {{data}}. Contamos com você.",
    footerText: "Órbita Edu",
    buttons: [],
    examples: ["Maria", "12/10"],
    status: "rascunho",
    providerTemplateId: null,
    rejectionReason: null,
    syncedAt: null,
    createdByUserId: "u1",
    createdAt: AGORA,
    updatedAt: AGORA,
    ...over,
  }) as Modelo;

/**
 * O dublê do repositório, tipado como o real.
 *
 * Sem `as unknown as`: assim ele quebra na compilação quando o repositório
 * muda, em vez de mentir. Guarda as linhas num array porque o que vários casos
 * checam é justamente **o que ficou gravado** — sobretudo a linha de falha, que
 * é a mais fácil de esquecer.
 */
function fakeRepo(inicial: { contas?: Conta[]; modelos?: Modelo[] } = {}) {
  const contas = inicial.contas ?? [];
  const modelos = inicial.modelos ?? [];
  const mensagens: Mensagem[] = [];

  const repo: WhatsAppRepository = {
    listAccounts: async () => contas,
    findAccount: async (id) => contas.find((c) => c.id === id) ?? null,
    defaultAccount: async () => contas.find((c) => c.isDefault) ?? contas[0] ?? null,
    insertAccount: async (values) => {
      const nova = conta({ ...(values as Partial<Conta>), id: `c${contas.length + 1}` });
      contas.push(nova);
      return nova;
    },
    updateAccount: async (id, patch) => {
      const i = contas.findIndex((c) => c.id === id);
      if (i < 0) return null;
      contas[i] = { ...contas[i], ...(patch as Partial<Conta>) } as Conta;
      return contas[i] as Conta;
    },
    clearDefault: async () => {
      for (const c of contas) c.isDefault = false;
    },
    deleteAccount: async (id) => {
      const i = contas.findIndex((c) => c.id === id);
      if (i < 0) return null;
      contas.splice(i, 1);
      return { id };
    },
    listTemplates: async () => modelos,
    findTemplate: async (id) => modelos.find((m) => m.id === id) ?? null,
    insertTemplate: async (values) => {
      const novo = modelo({ ...(values as Partial<Modelo>), id: `m${modelos.length + 1}` });
      modelos.push(novo);
      return novo;
    },
    updateTemplate: async (id, patch) => {
      const i = modelos.findIndex((m) => m.id === id);
      if (i < 0) return null;
      modelos[i] = { ...modelos[i], ...(patch as Partial<Modelo>) } as Modelo;
      return modelos[i] as Modelo;
    },
    deleteTemplate: async (id) => {
      const i = modelos.findIndex((m) => m.id === id);
      if (i < 0) return null;
      modelos.splice(i, 1);
      return { id };
    },
    insertMessage: async (values) => {
      const nova = { ...values, id: `msg${mensagens.length + 1}`, schoolId: "e1" } as Mensagem;
      mensagens.push(nova);
      return nova;
    },
    /** O dublê repete a regra do repositório: só serviço, e só o que não falhou. */
    lastServiceSendTo: async (accountId, phone) => {
      const dela = mensagens.filter(
        (m) =>
          m.accountId === accountId &&
          m.toPhoneE164 === phone &&
          m.billingCategory === "servico" &&
          m.status !== "falhou" &&
          m.sentAt,
      );
      return dela.at(-1)?.sentAt ?? null;
    },
    countBillingSince: async (accountId, desde) => {
      const dela = mensagens.filter(
        (m) =>
          m.accountId === accountId &&
          m.status !== "falhou" &&
          (m.createdAt ?? AGORA).getTime() >= desde.getTime(),
      );
      return {
        conversas: dela.filter((m) => m.openedConversation).length,
        mensagensPorModelo: dela.filter((m) => m.billingCategory === "modelo").length,
      };
    },
    listMessages: async () => mensagens,
  };

  return { repo, contas, modelos, mensagens };
}

function servicoCom(
  estado: ReturnType<typeof fakeRepo>,
  canal: WhatsAppChannel,
  over: { key?: string; simulacao?: boolean; relogio?: () => Date } = {},
) {
  return createWhatsAppService(estado.repo, {
    // `"key" in over` e não `?? CHAVE`: o caso que importa é passar `undefined`
    // de propósito — servidor sem a chave configurada.
    key: "key" in over ? over.key : CHAVE,
    canal: () => canal,
    now: over.relogio ?? (() => AGORA),
    simulacao: over.simulacao ?? false,
  });
}

/** Um relógio que anda, para os casos de janela de 24 horas. */
function relogioEm(inicio: Date) {
  let agora = inicio;
  return {
    agora: () => agora,
    avancarHoras: (horas: number) => {
      agora = new Date(agora.getTime() + horas * 60 * 60 * 1000);
    },
  };
}

describe("credencial", () => {
  it("nunca devolve o token — só a dica e se ele abre", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const visao = await servicoCom(estado, createMemoryChannel()).visao();

    expect(visao.conta?.tokenHint).toBe("••••9K3Z");
    expect(visao.conta?.credencialGravada).toBe(true);
    expect(visao.conta?.credencialAbre).toBe(true);
    expect(JSON.stringify(visao)).not.toContain("EAAtoken");
  });

  /**
   * O cenário de girar `WHATSAPP_ENCRYPTION_KEY`: o texto cifrado continua
   * íntegro no banco e simplesmente não abre mais. Sem este aviso a escola só
   * descobriria no primeiro envio, e descobriria como erro 500.
   */
  it("avisa quando a credencial não abre com a chave do servidor", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const outraChave = Buffer.alloc(32, 1).toString("base64");
    const visao = await servicoCom(estado, createMemoryChannel(), { key: outraChave }).visao();

    expect(visao.conta?.credencialGravada).toBe(true);
    expect(visao.conta?.credencialAbre).toBe(false);
  });

  /**
   * Campo vazio **mantém** o token. Tratar vazio como "apague" faria toda
   * edição de rótulo desconectar a escola.
   */
  it("salvar sem redigitar o token não derruba a integração", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const servico = servicoCom(estado, createMemoryChannel());

    await servico.salvarConta(
      { id: "c1", label: "Secretaria da manhã", provider: "cloud", token: "" },
      "u1",
    );

    expect(estado.contas[0]?.tokenCipher).toBe(TOKEN.cipher);
    expect(estado.contas[0]?.label).toBe("Secretaria da manhã");
  });

  it("limpa o nome da variável colado junto do token", async () => {
    const estado = fakeRepo();
    const servico = servicoCom(estado, createMemoryChannel());

    await servico.salvarConta(
      {
        id: undefined,
        label: "Secretaria",
        provider: "cloud",
        token: 'WHATSAPP_TOKEN="EAA-colado-do-env-ABCD"',
      },
      "u1",
    );

    // A dica prova que o valor cifrado terminou no token, não na aspa.
    expect(estado.contas[0]?.tokenHint).toBe("••••ABCD");
  });

  it("recusa gravar credencial sem a chave no servidor, em vez de gravar em claro", async () => {
    const estado = fakeRepo();
    const servico = servicoCom(estado, createMemoryChannel(), { key: undefined });

    await expect(
      servico.salvarConta({ label: "Secretaria", provider: "cloud", token: "EAA-x" }, "u1"),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(estado.contas).toHaveLength(0);
  });

  it("o primeiro número nasce principal", async () => {
    const estado = fakeRepo();
    const servico = servicoCom(estado, createMemoryChannel());

    await servico.salvarConta({ label: "Secretaria", provider: "cloud" }, "u1");
    expect(estado.contas[0]?.isDefault).toBe(true);
  });
});

describe("conexão", () => {
  it("grava o que a Meta respondeu", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const resultado = await servicoCom(estado, createMemoryChannel()).testarConexao();

    expect(resultado.conta.status).toBe("conectado");
    expect(estado.contas[0]?.checkedAt).toEqual(AGORA);
  });

  /**
   * O motivo da falha fica **gravado**. Sem isso ele sumiria no recarregar da
   * página, e a direção voltaria a uma tela que não explica por que não envia.
   */
  it("guarda o motivo quando a credencial é recusada", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const recusa: WhatsAppChannel = {
      ...createMemoryChannel(),
      verificar: async () => {
        throw new CredencialRecusadaError("O WhatsApp recusou a credencial.");
      },
    };

    await expect(servicoCom(estado, recusa).testarConexao()).rejects.toBeInstanceOf(
      ValidationError,
    );

    expect(estado.contas[0]?.status).toBe("erro");
    expect(estado.contas[0]?.lastError).toContain("recusou a credencial");
  });

  it("sem número configurado, é 404 e não erro de credencial", async () => {
    const estado = fakeRepo();
    await expect(servicoCom(estado, createMemoryChannel()).testarConexao()).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("modelos", () => {
  it("recusa salvar o que a Meta recusaria, antes de gastar a revisão", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const servico = servicoCom(estado, createMemoryChannel());

    await expect(
      servico.salvarModelo(
        {
          nome: "aviso",
          categoria: "UTILITY",
          idioma: "pt_BR",
          corpo: "A reunião é dia {{data}}",
          botoes: [],
          exemplos: ["12/10"],
        },
        "u1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * Modelo aprovado não se edita na Meta: apaga-se e cria-se outro. Deixar
   * editar aqui faria o texto do banco divergir do texto que sai no WhatsApp.
   */
  it("recusa editar modelo já enviado", async () => {
    const estado = fakeRepo({ modelos: [modelo({ status: "aprovado" })] });
    const servico = servicoCom(estado, createMemoryChannel());

    await expect(
      servico.salvarModelo(
        {
          id: "m1",
          nome: "aviso_de_reuniao",
          categoria: "UTILITY",
          idioma: "pt_BR",
          corpo: "Olá, {{responsavel}}. Mudou para {{data}}. Confirme, por favor.",
          botoes: [],
          exemplos: ["Maria", "13/10"],
        },
        "u1",
      ),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it("enviar para aprovação grava o id remoto e a data da conferência", async () => {
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo()] });
    const servico = servicoCom(estado, createMemoryChannel());

    await servico.enviarParaAprovacao("m1");

    expect(estado.modelos[0]?.providerTemplateId).toBe("simulado-aviso_de_reuniao");
    expect(estado.modelos[0]?.syncedAt).toEqual(AGORA);
  });

  it("não deixa enviar duas vezes o mesmo modelo", async () => {
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo({ status: "enviado" })] });

    await expect(
      servicoCom(estado, createMemoryChannel()).enviarParaAprovacao("m1"),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  /**
   * A verdade é da Meta e chega com atraso — `syncedAt` diz de quando é a
   * cópia. Tela que mostra "aprovado" sem dizer quando conferiu mente devagar.
   */
  it("sincronizar traz o estado remoto e carimba a hora", async () => {
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo()] });
    const canal = createMemoryChannel();
    const servico = servicoCom(estado, canal);

    await servico.enviarParaAprovacao("m1");
    estado.modelos[0] = { ...(estado.modelos[0] as Modelo), status: "enviado" } as Modelo;

    const resultado = await servico.sincronizar();

    expect(resultado.atualizados).toBe(1);
    expect(estado.modelos[0]?.status).toBe("aprovado");
  });

  /**
   * Modelo que a Meta não conhece volta a rascunho, e **não some**: alguém o
   * escreveu, e apagar o trabalho porque o fornecedor não o reconhece seria
   * decidir pelo usuário o que ele faz com o próprio texto.
   */
  it("modelo ausente na Meta volta a rascunho em vez de sumir", async () => {
    const estado = fakeRepo({
      contas: [conta()],
      modelos: [modelo({ status: "aprovado", providerTemplateId: "x" })],
    });

    await servicoCom(estado, createMemoryChannel()).sincronizar();

    expect(estado.modelos).toHaveLength(1);
    expect(estado.modelos[0]?.status).toBe("rascunho");
    expect(estado.modelos[0]?.providerTemplateId).toBeNull();
  });
});

describe("envio", () => {
  async function comModeloAprovado() {
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo()] });
    const canal = createMemoryChannel();
    const servico = servicoCom(estado, canal);
    await servico.enviarParaAprovacao("m1");
    return { estado, canal, servico };
  }

  it("grava o texto renderizado, não o esqueleto", async () => {
    const { estado, servico } = await comModeloAprovado();

    await servico.enviarTeste(
      { templateId: "m1", para: "+5586998122039", valores: { responsavel: "Ana", data: "13/10" } },
      "u1",
    );

    expect(estado.mensagens[0]?.renderedText).toContain("Olá, Ana. A reunião é dia 13/10.");
    expect(estado.mensagens[0]?.status).toBe("enviado");
  });

  it("valor que falta cai no exemplo do modelo", async () => {
    const { estado, servico } = await comModeloAprovado();

    await servico.enviarTeste({ templateId: "m1", para: "+5586998122039", valores: {} }, "u1");

    expect(estado.mensagens[0]?.renderedText).toContain("Olá, Maria. A reunião é dia 12/10.");
  });

  it("manda as variáveis na ordem posicional que a Meta espera", async () => {
    const { canal, servico } = await comModeloAprovado();

    await servico.enviarTeste(
      { templateId: "m1", para: "+5586998122039", valores: { responsavel: "Ana", data: "13/10" } },
      "u1",
    );

    expect((canal as MemoryChannel).enviados()[0]).toMatchObject({
      tipo: "modelo",
      para: "+5586998122039",
    });
  });

  /**
   * A falha vira linha no histórico. "Não apareceu em lugar nenhum" é a pior
   * resposta possível para quem clicou em enviar e não sabe se saiu.
   */
  it("registra também o envio que falhou", async () => {
    // O modelo consta como aprovado no banco e nunca foi criado no canal: é o
    // estado em que uma escola cai depois de trocar de conta na Meta.
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo({ status: "aprovado" })] });
    const servico = servicoCom(estado, createMemoryChannel());

    await expect(
      servico.enviarTeste({ templateId: "m1", para: "+5586998122039", valores: {} }, "u1"),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(estado.mensagens[0]?.status).toBe("falhou");
    expect(estado.mensagens[0]?.error).toContain("aviso_de_reuniao");
  });

  it("sem token gravado, recusa antes de bater na rede", async () => {
    const estado = fakeRepo({
      contas: [conta({ tokenCipher: null, tokenIv: null, tokenTag: null })],
      modelos: [modelo({ status: "aprovado" })],
    });

    await expect(
      servicoCom(estado, createMemoryChannel()).enviarTeste(
        { templateId: "m1", para: "+5586998122039", valores: {} },
        "u1",
      ),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  /**
   * Em simulação nada sai — e a visão diz isso. "Enviado" sem mensagem
   * nenhuma saindo é a pior tela possível numa apresentação.
   */
  it("simulação é declarada na visão", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const visao = await servicoCom(estado, createMemoryChannel(), { simulacao: true }).visao();

    expect(visao.simulacao).toBe(true);
  });
});

describe("a cota gratuita da Meta", () => {
  const mensagem = { para: "+5586998122039", texto: "Bom dia, a reunião foi confirmada." };

  it("a visão traz o consumo do mês com o teto padrão", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const visao = await servicoCom(estado, createMemoryChannel()).visao();

    expect(visao.consumo).toMatchObject({
      conversas: 0,
      teto: CONVERSAS_DE_SERVICO_GRATUITAS,
      estado: "tranquilo",
      bloqueado: false,
    });
  });

  it("sem número configurado, não há consumo a mostrar", async () => {
    const visao = await servicoCom(fakeRepo(), createMemoryChannel()).visao();
    expect(visao.consumo).toBeNull();
  });

  /**
   * O ponto da contagem: cinco mensagens para a mesma família em duas horas
   * são **uma** conversa para a Meta. Contar mensagens faria o painel acusar
   * cinco, e a escola se conteria por causa de um número inventado por nós.
   */
  it("mensagem dentro das 24 horas não abre conversa nova", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const relogio = relogioEm(AGORA);
    const servico = servicoCom(estado, createMemoryChannel(), { relogio: relogio.agora });

    await servico.enviarTexto(mensagem, "u1");
    relogio.avancarHoras(2);
    await servico.enviarTexto({ ...mensagem, texto: "Só confirmando o horário." }, "u1");

    expect(estado.mensagens.map((m) => m.openedConversation)).toEqual([true, false]);
    expect((await servico.consumo()).conversas).toBe(1);
  });

  it("passadas as 24 horas, a conversa seguinte é nova", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const relogio = relogioEm(AGORA);
    const servico = servicoCom(estado, createMemoryChannel(), { relogio: relogio.agora });

    await servico.enviarTexto(mensagem, "u1");
    relogio.avancarHoras(25);
    await servico.enviarTexto(mensagem, "u1");

    expect((await servico.consumo()).conversas).toBe(2);
  });

  it("cada família é uma conversa", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const servico = servicoCom(estado, createMemoryChannel());

    await servico.enviarTexto(mensagem, "u1");
    await servico.enviarTexto({ ...mensagem, para: "+5586998122040" }, "u1");

    expect((await servico.consumo()).conversas).toBe(2);
  });

  /**
   * Mensagem por modelo é cobrada por mensagem e **não** sai desta cota.
   * Somar as duas faria o painel dizer que a cota acabou quando o que acabou
   * foi o dinheiro.
   */
  it("mensagem por modelo não consome a cota, mas é contada", async () => {
    const estado = fakeRepo({ contas: [conta()], modelos: [modelo()] });
    const servico = servicoCom(estado, createMemoryChannel());
    await servico.enviarParaAprovacao("m1");

    await servico.enviarTeste({ templateId: "m1", para: "+5586998122039", valores: {} }, "u1");

    const consumo = await servico.consumo();
    expect(consumo.conversas).toBe(0);
    expect(consumo.mensagensPorModelo).toBe(1);
    expect(consumo.restantes).toBe(CONVERSAS_DE_SERVICO_GRATUITAS);
  });

  it("envio que falhou não consome cota", async () => {
    const estado = fakeRepo({ contas: [conta()] });
    const canal: WhatsAppChannel = {
      ...createMemoryChannel(),
      enviarTexto: async () => {
        throw new ForaDaJanelaError("Faz mais de 24 horas desde a última mensagem.");
      },
    };

    const servico = servicoCom(estado, canal);
    await expect(servico.enviarTexto(mensagem, "u1")).rejects.toBeInstanceOf(ValidationError);

    expect(estado.mensagens[0]?.status).toBe("falhou");
    expect((await servico.consumo()).conversas).toBe(0);
  });

  it("esgotada a cota e com bloqueio ligado, recusa abrir conversa nova", async () => {
    const estado = fakeRepo({ contas: [conta({ freeTierLimit: 1 })] });
    const relogio = relogioEm(AGORA);
    const servico = servicoCom(estado, createMemoryChannel(), { relogio: relogio.agora });

    await servico.enviarTexto(mensagem, "u1");
    relogio.avancarHoras(25);

    await expect(servico.enviarTexto(mensagem, "u1")).rejects.toBeInstanceOf(ConflictError);
    // Recusada antes de sair: nada de linha "enviado" no histórico.
    expect(estado.mensagens).toHaveLength(1);
  });

  /**
   * Bloquear quem pega carona cortaria a conversa pela metade — a família
   * pergunta e a escola fica muda — sem economizar um centavo, porque a
   * conversa já estava aberta e paga.
   */
  it("esgotada a cota, quem pega carona na janela aberta ainda passa", async () => {
    const estado = fakeRepo({ contas: [conta({ freeTierLimit: 1 })] });
    const relogio = relogioEm(AGORA);
    const servico = servicoCom(estado, createMemoryChannel(), { relogio: relogio.agora });

    await servico.enviarTexto(mensagem, "u1");
    relogio.avancarHoras(3);

    await expect(
      servico.enviarTexto({ ...mensagem, texto: "Respondendo à sua dúvida." }, "u1"),
    ).resolves.toBeDefined();
    expect(estado.mensagens).toHaveLength(2);
  });

  /** Passar do teto é decisão legítima da escola, desde que consciente. */
  it("com o bloqueio desligado, a mensagem sai e passa a ser cobrada", async () => {
    const estado = fakeRepo({
      contas: [conta({ freeTierLimit: 1, blockWhenExhausted: false })],
    });
    const relogio = relogioEm(AGORA);
    const servico = servicoCom(estado, createMemoryChannel(), { relogio: relogio.agora });

    await servico.enviarTexto(mensagem, "u1");
    relogio.avancarHoras(25);

    await expect(servico.enviarTexto(mensagem, "u1")).resolves.toBeDefined();
    const consumo = await servico.consumo();
    expect(consumo.conversas).toBe(2);
    expect(consumo.estado).toBe("esgotado");
    expect(consumo.recado).toContain("cobra");
  });

  it("o teto da conta pode ser apagado e volta ao padrão", async () => {
    const estado = fakeRepo({ contas: [conta({ freeTierLimit: 50 })] });
    const servico = servicoCom(estado, createMemoryChannel());

    expect((await servico.consumo()).teto).toBe(50);

    await servico.salvarConta(
      { id: "c1", label: "Secretaria", provider: "cloud", freeTierLimit: null },
      "u1",
    );

    expect((await servico.consumo()).teto).toBe(CONVERSAS_DE_SERVICO_GRATUITAS);
  });
});
