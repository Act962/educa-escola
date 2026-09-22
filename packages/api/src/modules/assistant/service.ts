import type { AppRole } from "@educa-escola/auth";

import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { ErroDoModelo, type ModeloDeLinguagem } from "../../integrations/modelo/cliente";
import type { AssistantRepository } from "./repository";
import type { AskInput, UpdateSettingsInput } from "./schema";
import {
  cifrarCredencial,
  credencialAbre,
  decifrarCredencial,
  dicaDaCredencial,
  limparCredencial,
} from "./segredo";

/** Como a escola encontra o Astro antes de configurar qualquer coisa. */
export const CONFIGURACAO_PADRAO = {
  enabled: false,
  providerLabel: null,
  baseUrl: null,
  model: null,
  organizationId: null,
  apiKeyHint: null,
  maxTokens: 600,
  dailyLimit: 200,
  allowTeachers: true,
  // Desligado para aluno: é o público que a escola precisa decidir
  // conscientemente, não herdar de um padrão.
  allowStudents: false,
};

export interface DepsDoAssistente {
  now: () => Date;
  chave: string | undefined;
  /** Constrói o cliente com a credencial já decifrada. Injetado para testar. */
  modelo: (config: {
    baseUrl: string;
    apiKey: string;
    model: string;
    organizationId?: string | null;
  }) => ModeloDeLinguagem;
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
export function montarInstrucao(input: {
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

export function createAssistantService(repo: AssistantRepository, deps: DepsDoAssistente) {
  async function configuracaoBruta() {
    return (await repo.find()) ?? null;
  }

  /** Meia-noite de hoje. O teto é por dia civil, que é como a escola pensa. */
  function inicioDoDia(): Date {
    const agora = deps.now();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
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
          ...CONFIGURACAO_PADRAO,
          credencialGravada: false,
          credencialAbre: false,
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
        credencialAbre: credencialAbre(gravada, deps.chave),
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
        allowTeachers: input.allowTeachers,
        allowStudents: input.allowStudents,
        updatedByUserId: userId,
      };

      // `undefined` mantém a chave; `""` apaga; texto substitui. É o que
      // permite editar o nome do modelo sem redigitar a credencial.
      if (input.apiKey !== undefined) {
        const valor = limparCredencial(input.apiKey);

        if (valor === "") {
          patch.apiKeyCipher = null;
          patch.apiKeyIv = null;
          patch.apiKeyTag = null;
          patch.apiKeyHint = null;
        } else {
          const cifrada = cifrarCredencial(valor, deps.chave);
          patch.apiKeyCipher = cifrada.cipher;
          patch.apiKeyIv = cifrada.iv;
          patch.apiKeyTag = cifrada.authTag;
          patch.apiKeyHint = dicaDaCredencial(valor);
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

      const apiKey = decifrarCredencial(
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
        if (erro instanceof ErroDoModelo) throw new ValidationError(erro.message);
        throw erro;
      }
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

      const usadas = await repo.countUsageSince(inicioDoDia());
      if (usadas >= salva.dailyLimit) {
        throw new ConflictError(
          `A escola chegou ao limite de ${salva.dailyLimit} perguntas hoje. O contador zera amanhã.`,
        );
      }

      let apiKey: string;
      try {
        apiKey = decifrarCredencial(
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

      const sistema = montarInstrucao({
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

        return { texto, restantesHoje: Math.max(0, salva.dailyLimit - usadas - 1) };
      } catch (erro) {
        // Falha de provedor vira erro de domínio para sair como 4xx com texto
        // legível, em vez de 500 com pilha. Quem lê é a secretaria.
        if (erro instanceof ErroDoModelo) throw new ValidationError(erro.message);
        throw erro;
      }
    },
  };
}

export type AssistantService = ReturnType<typeof createAssistantService>;
