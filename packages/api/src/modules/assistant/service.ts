import type { AppRole } from "@educa-escola/auth";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { type LanguageModel, ModelError } from "../../integrations/model/client";
import type { AssistantRepository } from "./repository";
import type { AskInput, UpdateSettingsInput } from "./schema";
import {
  clearCredential,
  credentialHint,
  credentialOpens,
  decryptCredential,
  encryptCredential,
} from "./secret";
import { type UsageLevel, usageLevel, worstLevel } from "./usage";

/** Como a escola encontra o Astro antes de configurar qualquer coisa. */
export const DEFAULT_SETTINGS = {
  enabled: false,
  providerLabel: null,
  baseUrl: null,
  model: null,
  organizationId: null,
  apiKeyHint: null,
  maxTokens: 600,
  dailyLimit: 200,
  monthlyTokenBudget: null,
  allowTeachers: true,
  // Desligado para aluno: é o público que a escola precisa decidir
  // conscientemente, não herdar de um padrão.
  allowStudents: false,
};

export interface AssistantDeps {
  now: () => Date;
  chave: string | undefined;
  /** Constrói o cliente com a credencial já decifrada. Injetado para testar. */
  modelo: (config: {
    baseUrl: string;
    apiKey: string;
    model: string;
    organizationId?: string | null;
  }) => LanguageModel;
}

/**
 * A instrução que vai ao modelo.
 *
 * **É aqui que mora a fronteira de permissão.** O assistente não consulta
 * banco: ele só enxerga o texto de `fatos`, que o router monta a partir do
 * painel do papel de quem perguntou. Um aluno pergunta "qual a média da
 * turma" e o modelo não tem a nota de ninguém no contexto — não porque
 * pedimos que ele não conte, mas porque não está lá.
 *
 * O pedido de não inventar existe pelo resto: fora dos fatos, modelo de
 * linguagem preenche lacuna com plausibilidade, e número plausível sobre
 * frequência de criança é pior que "não sei".
 */
export function buildInstruction(input: {
  escola: string;
  papel: AppRole;
  nome: string;
  fatos: string;
}): string {
  const comoTratar: Record<AppRole, string> = {
    owner: "responde pela escola inteira",
    admin: "é da secretaria e opera a escola inteira",
    teacher: "dá aula e enxerga apenas as próprias turmas",
    student: "é estudante e enxerga apenas o que é dele",
  };

  return [
    `Você é o Astro, assistente do Órbita Edu, dentro da escola ${input.escola}.`,
    `Está falando com ${input.nome}, que ${comoTratar[input.papel]}.`,
    "",
    "Responda em português do Brasil, em no máximo cinco frases, com o número na frente.",
    "Use SOMENTE os fatos abaixo. Se a resposta não estiver neles, diga que não tem esse dado",
    "e sugira em qual tela da escola ele aparece. Nunca estime, nunca complete com suposição.",
    "Não repita nome de aluno que não esteja nos fatos.",
    "",
    "Fatos disponíveis agora:",
    input.fatos,
  ].join("\n");
}

export function createAssistantService(repo: AssistantRepository, deps: AssistantDeps) {
  async function configuracaoBruta() {
    return (await repo.find()) ?? null;
  }

  /** Meia-noite de hoje. O teto é por dia civil, que é como a escola pensa. */
  function inicioDoDia(): Date {
    const agora = deps.now();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }

  /**
   * O mês corrente começa no dia 1.
   *
   * Mês de calendário e não trinta dias corridos: o orçamento existe para a
   * direção comparar com a fatura, e a fatura do provedor fecha por mês.
   * Janela deslizante daria um número que não bate com nenhum extrato.
   */
  function inicioDoMes(): Date {
    const agora = deps.now();
    return new Date(agora.getFullYear(), agora.getMonth(), 1);
  }

  return {
    /**
     * O que a tela de configuração mostra. **Nunca a credencial.**
     *
     * `credencialGravada` e `apiKeyHint` juntos respondem "tem chave?" e
     * "qual?" sem a chave sair do servidor. Devolvê-la para preencher um
     * campo seria expô-la a qualquer extensão de navegador da máquina da
     * secretaria.
     */
    async configuracao() {
      const salva = await configuracaoBruta();
      if (!salva) {
        return {
          ...DEFAULT_SETTINGS,
          credencialGravada: false,
          credentialOpens: false,
          chaveDoServidor: !!deps.chave,
        };
      }

      const { apiKeyCipher, apiKeyIv, apiKeyTag, ...resto } = salva;
      const gravada =
        apiKeyCipher && apiKeyIv && apiKeyTag
          ? { cipher: apiKeyCipher, iv: apiKeyIv, authTag: apiKeyTag }
          : null;

      return {
        ...resto,
        credencialGravada: !!gravada,
        /**
         * `false` quando a chave do servidor girou: o texto cifrado continua
         * lá, íntegro, e não abre mais. A tela avisa antes da primeira
         * pergunta, em vez de a escola descobrir por um erro 500.
         */
        credentialOpens: credentialOpens(gravada, deps.chave),
        /** Sem a chave do servidor, gravar credencial é recusado. A tela avisa antes. */
        chaveDoServidor: !!deps.chave,
      };
    },

    async salvar(input: UpdateSettingsInput, userId: string) {
      const patch: Record<string, unknown> = {
        enabled: input.enabled,
        providerLabel: input.providerLabel?.trim() || null,
        baseUrl: input.baseUrl?.trim() || null,
        model: input.model?.trim() || null,
        organizationId: input.organizationId?.trim() || null,
        maxTokens: input.maxTokens,
        dailyLimit: input.dailyLimit,
        // `null` é escolha, não omissão: apagar o campo devolve a escola ao
        // estado de "não declarei orçamento", e o Astro volta a ser barrado
        // só pelo teto diário.
        monthlyTokenBudget: input.monthlyTokenBudget ?? null,
        allowTeachers: input.allowTeachers,
        allowStudents: input.allowStudents,
        updatedByUserId: userId,
      };

      // `undefined` mantém a chave; `""` apaga; texto substitui. É o que
      // permite editar o nome do modelo sem redigitar a credencial.
      if (input.apiKey !== undefined) {
        const valor = clearCredential(input.apiKey);

        if (valor === "") {
          patch.apiKeyCipher = null;
          patch.apiKeyIv = null;
          patch.apiKeyTag = null;
          patch.apiKeyHint = null;
        } else {
          const cifrada = encryptCredential(valor, deps.chave);
          patch.apiKeyCipher = cifrada.cipher;
          patch.apiKeyIv = cifrada.iv;
          patch.apiKeyTag = cifrada.authTag;
          patch.apiKeyHint = credentialHint(valor);
        }
      }

      /*
       * Valida **antes** de gravar.
       *
       * Na primeira versão a checagem vinha depois do `save`, e a recusa
       * deixava no banco exatamente o estado que ela diz não aceitar:
       * `enabled = true` com o modelo vazio. Nada quebrava — `situacao`
       * confere as três peças —, mas a linha ficava mentindo, e quem abrisse
       * o banco leria "ligado".
       *
       * O resultado é o que já está gravado mais o que veio: `patch` só traz
       * as colunas da credencial quando a direção digitou uma, então a mescla
       * é o que de fato ficaria na linha.
       */
      const resultado = { ...(await configuracaoBruta()), ...patch } as {
        enabled?: boolean;
        baseUrl?: string | null;
        model?: string | null;
        apiKeyCipher?: string | null;
      };

      // Ligar sem as três peças deixaria um botão no canto da tela que só
      // sabe dar erro. Recusar aqui é mais barato que descobrir na pergunta.
      if (resultado.enabled) {
        // Nomeia o que falta em vez de listar os três. Mensagem que manda
        // preencher campo já preenchido faz a pessoa duvidar da tela, não do
        // campo — e foi exatamente o que aconteceu quando só o modelo vinha
        // vazio.
        const faltando = [
          !resultado.baseUrl && "o endereço da API",
          !resultado.model && "o modelo",
          !resultado.apiKeyCipher && "a credencial",
        ].filter((item): item is string => typeof item === "string");

        if (faltando.length > 0) {
          const lista =
            faltando.length === 1
              ? faltando[0]
              : `${faltando.slice(0, -1).join(", ")} e ${faltando.at(-1)}`;
          throw new ValidationError(`Para ligar o Astro, falta preencher ${lista}.`);
        }
      }

      await repo.save(patch);

      return this.configuracao();
    },

    /**
     * A lista de modelos, perguntada ao próprio provedor.
     *
     * Exige endereço e credencial salvos: a consulta é autenticada. É o que
     * mantém a tela sem nome de modelo envelhecido escrito no código — quem
     * responde o que existe hoje é o provedor, não este repositório.
     */
    async modelosDisponiveis() {
      const salva = await configuracaoBruta();

      if (!(salva?.baseUrl && salva.apiKeyCipher && salva.apiKeyIv && salva.apiKeyTag)) {
        throw new ValidationError(
          "Salve o endereço e a credencial antes de buscar a lista de modelos.",
        );
      }

      const apiKey = decryptCredential(
        { cipher: salva.apiKeyCipher, iv: salva.apiKeyIv, authTag: salva.apiKeyTag },
        deps.chave,
      );

      try {
        return await deps
          .modelo({
            baseUrl: salva.baseUrl,
            apiKey,
            model: salva.model ?? "",
            organizationId: salva.organizationId,
          })
          .listarModelos();
      } catch (erro) {
        if (erro instanceof ModelError) throw new ValidationError(erro.message);
        throw erro;
      }
    },

    /**
     * O consumo da escola, para o painel da barra lateral.
     *
     * Devolve os dois tetos juntos porque o alerta é um só: a direção precisa
     * saber que *alguma coisa* está acabando, e ver qual — não ler duas
     * porcentagens e decidir qual delas importa.
     *
     * É `assistant: ["manage"]` no router. Gasto da escola é número de
     * direção; professor e aluno recebem o que lhes serve — quantas perguntas
     * ainda cabem hoje — pela própria resposta do Astro.
     */
    async uso() {
      const salva = await configuracaoBruta();
      const teto = {
        perguntas: salva?.dailyLimit ?? DEFAULT_SETTINGS.dailyLimit,
        tokens: salva?.monthlyTokenBudget ?? null,
      };

      const [hoje, mes] = await Promise.all([
        repo.usoDesde(inicioDoDia()),
        repo.usoDesde(inicioDoMes()),
      ]);

      const nivelPerguntas = usageLevel(hoje.perguntas, teto.perguntas);
      const nivelTokens = usageLevel(mes.tokens, teto.tokens);

      return {
        ligado: !!salva?.enabled,
        perguntas: { usadas: hoje.perguntas, teto: teto.perguntas, nivel: nivelPerguntas },
        tokens: {
          usados: mes.tokens,
          teto: teto.tokens,
          nivel: nivelTokens,
          /** Respostas do mês em que o provedor não informou o consumo. */
          semContagem: mes.semContagem,
        },
        nivel: worstLevel(nivelPerguntas, nivelTokens) satisfies UsageLevel,
      };
    },

    /** O que o botão do Astro precisa saber, sem revelar configuração. */
    async situacao(papel: AppRole) {
      const salva = await configuracaoBruta();
      const pronto = !!(salva?.enabled && salva.baseUrl && salva.model && salva.apiKeyCipher);
      const liberado =
        papel === "owner" ||
        papel === "admin" ||
        (papel === "teacher" && !!salva?.allowTeachers) ||
        (papel === "student" && !!salva?.allowStudents);

      return { disponivel: pronto && liberado, ligado: pronto };
    },

    /**
     * Uma pergunta ao modelo.
     *
     * `fatos` vem pronto do router, recortado pelo papel. O serviço não
     * consulta banco de domínio de propósito: se ele fosse buscar o dado,
     * teria de reimplementar o recorte de cada papel — e um esquecimento ali
     * é um vazamento, não um defeito de tela.
     */
    async perguntar(
      input: AskInput & { fatos: string },
      quem: { userId: string; role: AppRole; nome: string; escola: string },
    ) {
      const salva = await configuracaoBruta();
      if (!salva?.enabled) throw new NotFoundError("O Astro não está ligado nesta escola.");

      const { disponivel } = await this.situacao(quem.role);
      if (!disponivel) {
        throw new ValidationError("Seu perfil não tem acesso ao Astro nesta escola.");
      }

      if (
        !(salva.baseUrl && salva.model && salva.apiKeyCipher && salva.apiKeyIv && salva.apiKeyTag)
      ) {
        throw new ValidationError("O Astro está ligado, mas a configuração está incompleta.");
      }

      const hoje = await repo.usoDesde(inicioDoDia());
      if (hoje.perguntas >= salva.dailyLimit) {
        throw new ConflictError(
          `A escola chegou ao limite de ${salva.dailyLimit} perguntas hoje. O contador zera amanhã.`,
        );
      }

      /*
       * O orçamento de tokens barra como o teto diário barra.
       *
       * Ele só vale quando a escola declarou um — nulo é "não disse quanto
       * aceita gastar", e parar o Astro num número que ninguém escolheu seria
       * inventar a decisão dela.
       *
       * A checagem é antes da chamada e sobre o já gasto: não dá para saber o
       * custo de uma resposta antes de pedi-la, então a última pergunta do mês
       * passa um pouco do teto. Recusar por estimativa deixaria de fora
       * perguntas que cabiam.
       */
      if (salva.monthlyTokenBudget) {
        const mes = await repo.usoDesde(inicioDoMes());
        if (mes.tokens >= salva.monthlyTokenBudget) {
          throw new ConflictError(
            `A escola chegou ao orçamento de ${salva.monthlyTokenBudget.toLocaleString("pt-BR")} tokens deste mês. ` +
              "A direção pode ampliá-lo em Configurações; o contador zera no dia 1º.",
          );
        }
      }

      let apiKey: string;
      try {
        apiKey = decryptCredential(
          { cipher: salva.apiKeyCipher, iv: salva.apiKeyIv, authTag: salva.apiKeyTag },
          deps.chave,
        );
      } catch {
        // Chave do servidor girou: o texto cifrado está íntegro e não abre
        // mais. Erro de domínio com o que fazer, e não um 500 com pilha do
        // `node:crypto`.
        throw new ValidationError(
          "A credencial gravada não abre com a chave de cifragem atual do servidor. " +
            "Regrave a credencial do modelo em Configurações.",
        );
      }

      const modelo = deps.modelo({
        baseUrl: salva.baseUrl,
        apiKey,
        model: salva.model,
        organizationId: salva.organizationId,
      });

      const sistema = buildInstruction({
        escola: quem.escola,
        papel: quem.role,
        nome: quem.nome,
        fatos: input.fatos,
      });

      try {
        const { texto, tokens } = await modelo.responder({
          sistema,
          pergunta: input.pergunta,
          maxTokens: salva.maxTokens,
        });

        await repo.recordUsage({ userId: quem.userId, role: quem.role, tokens });

        return { texto, restantesHoje: Math.max(0, salva.dailyLimit - hoje.perguntas - 1) };
      } catch (erro) {
        // Falha de provedor vira erro de domínio para sair como 4xx com texto
        // legível, em vez de 500 com pilha. Quem lê é a secretaria.
        if (erro instanceof ModelError) throw new ValidationError(erro.message);
        throw erro;
      }
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
