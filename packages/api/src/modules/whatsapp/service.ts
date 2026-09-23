import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import type { CanalConfig } from "../../messaging/whatsapp";
import { type WhatsAppChannel, WhatsAppError } from "../../messaging/whatsapp/port";
import {
  type Botao,
  type ModeloDeMensagem,
  ModeloMalFormadoError,
  problemasDoModelo,
  renderizar,
  textoRenderizado,
  valoresDeExemplo,
  variaveisDoModelo,
} from "../../messaging/whatsapp/template";
import type { WhatsAppRepository } from "./repository";
import type { SaveAccountInput, SaveTemplateInput, SendTestInput, SendTextInput } from "./schema";
import {
  clearSecret,
  decryptSecret,
  encryptSecret,
  envelope,
  secretHint,
  secretOpens,
} from "./secret";

export interface WhatsAppDeps {
  /** `WHATSAPP_ENCRYPTION_KEY`. Separada do env para o service ser testável. */
  key: string | undefined;
  /**
   * A fábrica do canal, injetada.
   *
   * O service não constrói `createCloudChannel` — recebe quem constrói. É o que
   * permite testar a regra inteira com o dublê sem rede, e é a mesma razão de
   * o repositório vir por parâmetro.
   */
  canal: (config: CanalConfig) => WhatsAppChannel;
  now: () => Date;
  /** `true` quando `WHATSAPP_DRIVER=memoria` está forçando simulação. */
  simulacao: boolean;
}

type Conta = Awaited<ReturnType<WhatsAppRepository["findAccount"]>>;
type Modelo = Awaited<ReturnType<WhatsAppRepository["findTemplate"]>>;

/**
 * A conta como a tela a recebe: **sem os segredos**.
 *
 * Nenhum caminho devolve o token. O que volta é a dica dos quatro últimos
 * caracteres e dois booleanos — se há credencial e se ela ainda abre com a
 * chave do servidor. É o bastante para a direção reconhecer o que está lá e
 * para a tela avisar antes de um erro 500 na primeira mensagem.
 */
export interface ContaVisivel {
  id: string;
  label: string;
  provider: "cloud" | "memoria";
  phoneNumberId: string | null;
  wabaId: string | null;
  appId: string | null;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  qualityRating: string | null;
  status: "rascunho" | "conectado" | "erro";
  lastError: string | null;
  checkedAt: Date | null;
  isDefault: boolean;
  tokenHint: string | null;
  credencialGravada: boolean;
  credencialAbre: boolean;
  appSecretGravado: boolean;
}

function visivel(conta: NonNullable<Conta>, key: string | undefined): ContaVisivel {
  const token = envelope(conta.tokenCipher, conta.tokenIv, conta.tokenTag);

  return {
    id: conta.id,
    label: conta.label,
    provider: conta.provider,
    phoneNumberId: conta.phoneNumberId,
    wabaId: conta.wabaId,
    appId: conta.appId,
    displayPhoneNumber: conta.displayPhoneNumber,
    verifiedName: conta.verifiedName,
    qualityRating: conta.qualityRating,
    status: conta.status,
    lastError: conta.lastError,
    checkedAt: conta.checkedAt,
    isDefault: conta.isDefault,
    tokenHint: conta.tokenHint,
    credencialGravada: token !== null,
    credencialAbre: secretOpens(token, key),
    appSecretGravado: conta.appSecretCipher !== null,
  };
}

/** O modelo do banco de volta na forma pura de `template.ts`. */
export function modeloDe(linha: NonNullable<Modelo>): ModeloDeMensagem {
  return {
    nome: linha.name,
    categoria: linha.category,
    idioma: linha.language,
    cabecalho: linha.headerText,
    corpo: linha.body,
    rodape: linha.footerText,
    botoes: (linha.buttons ?? []) as Botao[],
    exemplos: linha.examples ?? [],
  };
}

export function createWhatsAppService(repo: WhatsAppRepository, deps: WhatsAppDeps) {
  /**
   * Monta o canal da conta, decifrando o token na hora.
   *
   * O token decifrado **não é guardado em lugar nenhum** — nem em campo de
   * objeto, nem em cache. Ele existe dentro desta função e morre com ela.
   */
  async function canalDa(conta: NonNullable<Conta>): Promise<WhatsAppChannel> {
    const cifrado = envelope(conta.tokenCipher, conta.tokenIv, conta.tokenTag);

    // Em simulação o token nem é lido: é o que permite apresentar o fluxo numa
    // instalação sem `WHATSAPP_ENCRYPTION_KEY` configurada. Vale para as duas
    // origens de simulação — a variável do servidor e a conta marcada como
    // `memoria` pela própria escola.
    if (deps.simulacao || conta.provider === "memoria") {
      // A chave separa o dublê de uma escola do de outra: sem ela, duas
      // escolas em simulação disputariam o mesmo nome de modelo.
      return deps.canal({ provider: "memoria", chave: conta.id });
    }

    if (!cifrado) {
      throw new ValidationError(
        "Este número ainda não tem token de acesso. Cadastre a credencial antes de enviar.",
      );
    }

    if (!secretOpens(cifrado, deps.key)) {
      throw new ValidationError(
        "A credencial gravada não abre com a chave deste servidor. " +
          "Regrave o token na aba WhatsApp.",
      );
    }

    return deps.canal({
      provider: conta.provider,
      phoneNumberId: conta.phoneNumberId,
      wabaId: conta.wabaId,
      token: decryptSecret(cifrado, deps.key),
    });
  }

  async function contaOuFalha(id?: string) {
    const conta = id ? await repo.findAccount(id) : await repo.defaultAccount();
    if (!conta) {
      throw new NotFoundError("Nenhum número de WhatsApp configurado para esta escola.");
    }
    return conta;
  }

  /**
   * Erro do canal vira 400, com a frase do canal.
   *
   * Mesma escolha que o Astro faz com `ModelError`, e pela mesma razão: a
   * mensagem é acionável — "o token expirou", "use um modelo aprovado" — e um
   * 500 a substituiria por "erro interno", mandando a direção abrir chamado
   * para algo que ela resolve em dois cliques.
   */
  function traduzir(error: unknown): never {
    if (error instanceof ModeloMalFormadoError) throw new ValidationError(error.message);
    if (error instanceof WhatsAppError) throw new ValidationError(error.message);
    throw error;
  }

  return {
    /**
     * Tudo o que a aba precisa, numa consulta.
     *
     * Uma chamada e não quatro porque as quatro partes aparecem juntas na
     * mesma tela: conta, modelos, envios e o que o canal sabe fazer. Quatro
     * queries seriam quatro estados de carregamento numa tela só.
     */
    async visao() {
      const [contas, modelos, mensagens] = await Promise.all([
        repo.listAccounts(),
        repo.listTemplates(),
        repo.listMessages(),
      ]);

      const principal = contas.find((c) => c.isDefault) ?? contas[0] ?? null;

      return {
        contas: contas.map((c) => visivel(c, deps.key)),
        conta: principal ? visivel(principal, deps.key) : null,
        modelos: modelos.map((linha) => ({
          id: linha.id,
          nome: linha.name,
          categoria: linha.category,
          idioma: linha.language,
          cabecalho: linha.headerText,
          corpo: linha.body,
          rodape: linha.footerText,
          botoes: (linha.buttons ?? []) as Botao[],
          exemplos: linha.examples ?? [],
          status: linha.status,
          motivoDaRecusa: linha.rejectionReason,
          sincronizadoEm: linha.syncedAt,
          variaveis: variaveisDoModelo(modeloDe(linha)),
          atualizadoEm: linha.updatedAt,
        })),
        mensagens: mensagens.map((m) => ({
          id: m.id,
          para: m.toPhoneE164,
          tipo: m.kind,
          texto: m.renderedText,
          status: m.status,
          erro: m.error,
          em: m.createdAt,
        })),
        /** Sem a chave no servidor, gravar credencial é recusado — e a tela avisa antes. */
        chaveNoServidor: Boolean(deps.key),
        /**
         * Duas origens, uma bandeira: a variável do servidor e a conta que a
         * própria escola marcou como simulada. A tela precisa avisar nos dois
         * casos — "enviado" sem mensagem nenhuma saindo é a pior tela possível.
         */
        simulacao: deps.simulacao || principal?.provider === "memoria",
      };
    },

    async salvarConta(input: SaveAccountInput, userId: string) {
      const token = input.token ? clearSecret(input.token) : "";
      const appSecret = input.appSecret ? clearSecret(input.appSecret) : "";

      if ((token || appSecret) && !deps.key && input.provider !== "memoria") {
        throw new ValidationError(
          "O servidor não tem WHATSAPP_ENCRYPTION_KEY configurada, " +
            "e sem ela a credencial só poderia ser gravada em claro. Fale com quem administra o servidor.",
        );
      }

      const segredos = {
        ...(token
          ? (() => {
              const cifrado = encryptSecret(token, deps.key);
              return {
                tokenCipher: cifrado.cipher,
                tokenIv: cifrado.iv,
                tokenTag: cifrado.authTag,
                tokenHint: secretHint(token),
              };
            })()
          : {}),
        ...(appSecret
          ? (() => {
              const cifrado = encryptSecret(appSecret, deps.key);
              return {
                appSecretCipher: cifrado.cipher,
                appSecretIv: cifrado.iv,
                appSecretTag: cifrado.authTag,
              };
            })()
          : {}),
      };

      const campos = {
        label: input.label,
        provider: input.provider,
        phoneNumberId: input.phoneNumberId || null,
        wabaId: input.wabaId || null,
        appId: input.appId || null,
        ...segredos,
      };

      if (input.id) {
        const atualizada = await repo.updateAccount(input.id, campos);
        if (!atualizada) throw new NotFoundError("Número não encontrado.");
        return visivel(atualizada, deps.key);
      }

      const contas = await repo.listAccounts();
      const criada = await repo.insertAccount({
        ...campos,
        createdByUserId: userId,
        // O primeiro número nasce principal. Exigir o clique faria a
        // integração parecer quebrada logo depois de configurada.
        isDefault: contas.length === 0,
      });

      return visivel(criada, deps.key);
    },

    async definirPrincipal(id: string) {
      const conta = await repo.findAccount(id);
      if (!conta) throw new NotFoundError("Número não encontrado.");

      // Limpa antes de marcar: o índice parcial só admite um principal por
      // escola, e marcar primeiro esbarraria nele.
      await repo.clearDefault();
      const atualizada = await repo.updateAccount(id, { isDefault: true });
      return visivel(atualizada as NonNullable<Conta>, deps.key);
    },

    async removerConta(id: string) {
      const apagada = await repo.deleteAccount(id);
      if (!apagada) throw new NotFoundError("Número não encontrado.");
      return { removido: true };
    },

    /**
     * Bate na Meta e grava o que ela respondeu.
     *
     * É o passo que transforma "salvei uns campos" em "está no ar" — e o único
     * lugar onde um token expirado aparece **antes** de alguém contar com uma
     * mensagem que não saiu. O erro fica gravado em `lastError` para a tela
     * continuar mostrando o motivo depois de recarregada.
     */
    async testarConexao(id?: string) {
      const conta = await contaOuFalha(id);

      try {
        const canal = await canalDa(conta);
        const numero = await canal.verificar();

        const atualizada = await repo.updateAccount(conta.id, {
          status: "conectado",
          displayPhoneNumber: numero.numero || null,
          verifiedName: numero.nomeVerificado,
          qualityRating: numero.qualidade,
          lastError: null,
          checkedAt: deps.now(),
        });

        return { ok: true as const, conta: visivel(atualizada as NonNullable<Conta>, deps.key) };
      } catch (error) {
        const mensagem =
          error instanceof WhatsAppError || error instanceof ValidationError
            ? error.message
            : "Não foi possível conferir a conexão agora.";

        await repo.updateAccount(conta.id, {
          status: "erro",
          lastError: mensagem,
          checkedAt: deps.now(),
        });

        throw new ValidationError(mensagem);
      }
    },

    /**
     * Grava o modelo como rascunho. **Não manda nada para a Meta.**
     *
     * Duas operações separadas de propósito: escrever um comunicado é trabalho
     * de rascunho, com idas e vindas, e enviar para aprovação é irreversível —
     * modelo aprovado não se edita na Meta, se apaga e se cria outro. Juntar os
     * dois num botão só faria cada correção de vírgula gastar uma revisão.
     */
    async salvarModelo(input: SaveTemplateInput, userId: string) {
      const modelo: ModeloDeMensagem = {
        nome: input.nome,
        categoria: input.categoria,
        idioma: input.idioma,
        cabecalho: input.cabecalho ?? null,
        corpo: input.corpo,
        rodape: input.rodape ?? null,
        botoes: input.botoes as Botao[],
        exemplos: input.exemplos,
      };

      const problemas = problemasDoModelo(modelo);
      if (problemas.length > 0) throw new ValidationError(problemas.join(" "));

      const campos = {
        name: input.nome,
        category: input.categoria,
        language: input.idioma,
        headerText: input.cabecalho || null,
        body: input.corpo,
        footerText: input.rodape || null,
        buttons: input.botoes,
        examples: input.exemplos,
      };

      if (input.id) {
        const atual = await repo.findTemplate(input.id);
        if (!atual) throw new NotFoundError("Modelo não encontrado.");
        if (atual.status === "aprovado" || atual.status === "enviado") {
          throw new ConflictError(
            "Modelo já enviado à Meta não pode ser editado. Duplique-o com outro nome.",
          );
        }
        const atualizado = await repo.updateTemplate(input.id, campos);
        return atualizado as NonNullable<Modelo>;
      }

      const conta = await repo.defaultAccount();
      return repo.insertTemplate({
        ...campos,
        accountId: conta?.id ?? null,
        status: "rascunho",
        createdByUserId: userId,
      });
    },

    async enviarParaAprovacao(id: string) {
      const linha = await repo.findTemplate(id);
      if (!linha) throw new NotFoundError("Modelo não encontrado.");
      if (linha.status !== "rascunho" && linha.status !== "recusado") {
        throw new ConflictError("Este modelo já foi enviado para aprovação.");
      }

      const conta = await contaOuFalha(linha.accountId ?? undefined);
      const canal = await canalDa(conta);

      try {
        const remoto = await canal.criarModelo(modeloDe(linha));

        return await repo.updateTemplate(id, {
          status: remoto.status === "aprovado" ? "aprovado" : "enviado",
          providerTemplateId: remoto.id,
          rejectionReason: null,
          accountId: conta.id,
          syncedAt: deps.now(),
        });
      } catch (error) {
        traduzir(error);
      }
    },

    /**
     * Traz de volta o estado dos modelos na Meta.
     *
     * Existe porque a aprovação é assíncrona e ela não nos avisa — sem webhook,
     * a única forma de saber é perguntar. O que está aqui é **cópia**, e
     * `syncedAt` diz de quando é: tela que mostra "aprovado" sem dizer quando
     * conferiu mente devagar.
     *
     * Modelo que sumiu lá vira `rascunho` aqui, e não some: alguém o escreveu,
     * e apagar o trabalho porque a Meta não o reconhece mais seria decidir pelo
     * usuário o que ele faz com o próprio texto.
     */
    async sincronizar(id?: string) {
      const conta = await contaOuFalha(id);
      const canal = await canalDa(conta);

      if (!canal.recursos.gestaoDeModelos) {
        throw new ValidationError("Este fornecedor não gerencia modelos aprovados.");
      }

      let remotos: Awaited<ReturnType<WhatsAppChannel["listarModelos"]>>;
      try {
        remotos = await canal.listarModelos();
      } catch (error) {
        traduzir(error);
      }

      const locais = await repo.listTemplates();
      const agora = deps.now();
      let atualizados = 0;

      for (const local of locais) {
        const remoto = remotos.find((r) => r.nome === local.name && r.idioma === local.language);

        // Rascunho que a Meta nunca viu não é "sumiu": é rascunho.
        if (!remoto) {
          if (local.status !== "rascunho") {
            await repo.updateTemplate(local.id, {
              status: "rascunho",
              providerTemplateId: null,
              syncedAt: agora,
            });
            atualizados += 1;
          }
          continue;
        }

        await repo.updateTemplate(local.id, {
          status: remoto.status,
          providerTemplateId: remoto.id,
          rejectionReason: remoto.motivo,
          syncedAt: agora,
        });
        atualizados += 1;
      }

      return { conferidos: locais.length, atualizados, em: agora };
    },

    async removerModelo(id: string) {
      const linha = await repo.findTemplate(id);
      if (!linha) throw new NotFoundError("Modelo não encontrado.");

      // Só vai à Meta o que chegou a existir lá. Rascunho some daqui e pronto.
      if (linha.providerTemplateId) {
        const conta = await repo.findAccount(linha.accountId ?? "");
        if (conta) {
          try {
            const canal = await canalDa(conta);
            await canal.apagarModelo(linha.name);
          } catch (error) {
            // Apagar lá pode falhar — token vencido, modelo já removido pela
            // Meta. A remoção local segue: deixar a linha presa porque o
            // fornecedor não respondeu não devolve controle a ninguém.
            if (!(error instanceof WhatsAppError)) throw error;
          }
        }
      }

      await repo.deleteTemplate(id);
      return { removido: true };
    },

    /**
     * Manda um modelo para um número.
     *
     * O texto gravado no log sai da **mesma** `renderizar` que alimenta a
     * prévia da tela. Duas implementações fariam a direção aprovar uma coisa e
     * o histórico guardar outra — e a divergência só apareceria numa
     * reclamação, que é quando ninguém quer descobrir que a prévia mentia.
     */
    async enviarTeste(input: SendTestInput, userId: string) {
      const linha = await repo.findTemplate(input.templateId);
      if (!linha) throw new NotFoundError("Modelo não encontrado.");

      const modelo = modeloDe(linha);
      const conta = await contaOuFalha(linha.accountId ?? undefined);
      const canal = await canalDa(conta);

      const valores = { ...valoresDeExemplo(modelo), ...input.valores };
      const nomes = variaveisDoModelo(modelo);
      const doCabecalho = modelo.cabecalho
        ? nomes.filter((n) => modelo.cabecalho?.includes(`{{${n}}}`))
        : [];
      const doCorpo = nomes.filter((n) => modelo.corpo.includes(`{{${n}}}`));

      const texto = textoRenderizado(renderizar(modelo, valores));

      try {
        const aceito = await canal.enviarModelo({
          para: input.para,
          nome: modelo.nome,
          idioma: modelo.idioma,
          variaveis: doCorpo.map((n) => valores[n] ?? ""),
          variaveisDoCabecalho: doCabecalho.map((n) => valores[n] ?? ""),
        });

        return await repo.insertMessage({
          accountId: conta.id,
          templateId: linha.id,
          toPhoneE164: input.para,
          kind: "modelo",
          renderedText: texto,
          status: "enviado",
          providerMessageId: aceito.providerMessageId,
          sentByUserId: userId,
          sentAt: deps.now(),
        });
      } catch (error) {
        // A falha também vira linha: "não apareceu no histórico" é a pior
        // resposta possível para quem clicou em enviar e não sabe se saiu.
        await repo.insertMessage({
          accountId: conta.id,
          templateId: linha.id,
          toPhoneE164: input.para,
          kind: "modelo",
          renderedText: texto,
          status: "falhou",
          error: error instanceof Error ? error.message : "Falha desconhecida.",
          sentByUserId: userId,
        });

        traduzir(error);
      }
    },

    /** Texto livre. Só chega a quem escreveu para a escola nas últimas 24h. */
    async enviarTexto(input: SendTextInput, userId: string) {
      const conta = await contaOuFalha();
      const canal = await canalDa(conta);

      if (!canal.recursos.textoLivre) {
        throw new ValidationError("Este fornecedor não manda texto livre.");
      }

      try {
        const aceito = await canal.enviarTexto({ para: input.para, texto: input.texto });

        return await repo.insertMessage({
          accountId: conta.id,
          toPhoneE164: input.para,
          kind: "texto",
          renderedText: input.texto,
          status: "enviado",
          providerMessageId: aceito.providerMessageId,
          sentByUserId: userId,
          sentAt: deps.now(),
        });
      } catch (error) {
        await repo.insertMessage({
          accountId: conta.id,
          toPhoneE164: input.para,
          kind: "texto",
          renderedText: input.texto,
          status: "falhou",
          error: error instanceof Error ? error.message : "Falha desconhecida.",
          sentByUserId: userId,
        });

        traduzir(error);
      }
    },
  };
}

export type WhatsAppService = ReturnType<typeof createWhatsAppService>;
