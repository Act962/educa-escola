import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { ENROLLED_STATUSES } from "../student/schema";
import { identificar, type Veredito } from "./reconhecimento";
import type { GateRepository } from "./repository";
import type {
  CadastrarMoldeInput,
  ExcluirPassagemInput,
  PassagensInput,
  RegistrarInput,
} from "./schema";
import { cifrarMolde, decifrarMolde } from "./segredo";

export interface DepsDaPortaria {
  now: () => Date;
  /** A chave de cifragem dos moldes. Vive fora do banco, como a da foto. */
  chave: string | undefined;
  actor: { userId: string };
}

/**
 * Quanto tempo o tablet pode confiar no que baixou.
 *
 * É a peça que sustenta o cache local. Se uma família revogar a autorização, o
 * tablet com cache velho continuaria reconhecendo aquela criança — então o
 * lote vem com prazo, e passado o prazo o quiosque **desliga o modo rosto** e
 * passa a pedir a carteirinha. Degradar para o modo que sempre funciona é
 * melhor que seguir lendo rosto que talvez já não se possa ler.
 *
 * Dez minutos: curto o bastante para uma revogação chegar no mesmo turno,
 * longo o bastante para a portaria atravessar uma queda de rede.
 */
export const VALIDADE_DO_LOTE_MS = 10 * 60 * 1000;

/**
 * Duas leituras do mesmo aluno dentro desta janela são a mesma passagem.
 *
 * Um minuto porque é o que cobre a fila do portão sem cobrir uma ida e volta
 * de verdade: ninguém entra na escola e sai dela em cinquenta segundos.
 */
export const JANELA_DE_RELEITURA_MS = 60_000;

/**
 * A portaria.
 *
 * Duas regras atravessam tudo aqui. **Passagem não é chamada** — o registro
 * diz que o aluno cruzou o portão, e quem marca presença continua sendo o
 * professor. E **a carteirinha é o modo que nunca falha**: qualquer caminho
 * que dê errado no rosto termina pedindo o QR, nunca barrando a criança.
 */
/**
 * Teto da lista.
 *
 * Um portão de escola faz centenas de passagens por dia, e a tela é para
 * conferir movimento, não para exportar histórico. Quando virar exportação, o
 * caminho é outro — página, e não uma lista maior.
 */
const LIMITE_DA_LISTA = 300;

export function createGateService(repo: GateRepository, deps: DepsDaPortaria) {
  function inicioDoDia(): Date {
    const agora = deps.now();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  }

  /** O dia seguinte, à meia-noite: o fim aberto da janela do dia. */
  function fimDoDia(inicio: Date): Date {
    return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + 1);
  }

  /**
   * "2026-09-22" vira a meia-noite local daquele dia.
   *
   * Montado componente a componente, e não `new Date("2026-09-22")`: essa
   * forma é interpretada como UTC, e numa escola em UTC-3 a lista do dia 22
   * começaria às 21h do dia 21.
   */
  function diaCivil(texto: string): Date {
    const [ano, mes, dia] = texto.split("-").map(Number);
    return new Date(ano as number, (mes as number) - 1, dia as number);
  }

  /** Aluno fora de `ENROLLED_STATUSES` não abre portão. */
  function matriculado(status: string): boolean {
    return (ENROLLED_STATUSES as readonly string[]).includes(status);
  }

  return {
    /**
     * O lote de moldes que o tablet leva para comparar sozinho.
     *
     * Decifrar aqui e mandar o descritor é deliberado: o quiosque precisa
     * comparar **sem ida e volta à rede**, que é o que torna a leitura
     * instantânea e mantém a portaria de pé quando a internet cai. O que viaja
     * são números, nunca a foto.
     *
     * DECISÃO-JOÃO: o molde sai do servidor para o tablet.
     * Quebra se: o tablet guardar isso em disco, vira biometria de criança
     *   num equipamento de corredor.
     * Fiz assim: o cliente mantém em memória e nada persiste; recarregar a
     *   página busca de novo, e o lote vence em dez minutos.
     * Alternativas: comparar no servidor a cada leitura (depende da rede) ·
     *   cache cifrado em IndexedDB (mais resiliente, com dado em repouso).
     */
    async lote() {
      const gravados = await repo.listTemplates();
      const alunos: { studentId: string; descritor: number[] }[] = [];

      let extractor: string | null = null;
      for (const molde of gravados) {
        // Moldes de extratores diferentes não se comparam. Em vez de misturar
        // e devolver distância sem significado, o lote fica com o extrator do
        // primeiro e o resto espera recadastro.
        extractor ??= molde.extractor;
        if (molde.extractor !== extractor) continue;

        alunos.push({
          studentId: molde.studentId,
          descritor: decifrarMolde(
            { cipher: molde.cipher, iv: molde.iv, authTag: molde.authTag },
            deps.chave,
          ),
        });
      }

      return {
        extractor,
        alunos,
        pendentesDeRecadastro: gravados.length - alunos.length,
        validoAte: new Date(deps.now().getTime() + VALIDADE_DO_LOTE_MS),
      };
    },

    /**
     * Identifica um rosto no servidor.
     *
     * Existe ao lado do lote porque o tablet nem sempre pode comparar: lote
     * vencido, memória perdida numa recarga, ou aparelho fraco demais para
     * segurar os moldes. O caminho é o mesmo e a regra é a mesma — `identificar`
     * é a única implementação, nos dois lados.
     */
    async identificarRosto(entrada: { descritor: number[]; extractor: string }) {
      const { alunos, extractor } = await this.lote();

      if (extractor && entrada.extractor !== extractor) {
        throw new ValidationError(
          "O tablet e o servidor usam extratores diferentes. Recadastre os moldes ou atualize o tablet.",
        );
      }

      const veredito = identificar(entrada.descritor, alunos);
      return this.cartaoDoVeredito(veredito);
    },

    /** Traduz o veredito em algo que a tela possa mostrar sem decidir nada. */
    async cartaoDoVeredito(veredito: Veredito) {
      if (veredito.tipo !== "reconhecido") {
        // Ambíguo e desconhecido dão o mesmo resultado na tela de propósito:
        // "não identificado, use a carteirinha". Dizer "você parece com outro
        // aluno" na frente da fila não ajuda ninguém e expõe as duas crianças.
        return { encontrado: false as const, motivo: veredito.tipo };
      }

      const aluno = await repo.findStudent(veredito.studentId);
      if (!aluno) return { encontrado: false as const, motivo: "ninguem" as const };

      return { encontrado: true as const, aluno, distancia: veredito.distancia };
    },

    /** O caminho da carteirinha: o QR carrega o número de matrícula. */
    async porMatricula(registration: string) {
      const aluno = await repo.findByRegistration(registration);
      if (!aluno) return { encontrado: false as const, motivo: "ninguem" as const };
      return { encontrado: true as const, aluno, distancia: null };
    },

    /**
     * Grava a passagem.
     *
     * **O sentido é do portão, não de um botão.** Câmera de entrada manda
     * `entrada`, câmera de saída manda `saida`. Onde houver só uma câmera, o
     * sentido vem da alternância: sem passagem hoje, entrou; a anterior foi
     * entrada, agora é saída; foi saída, entrou de novo.
     *
     * A alternância tem um defeito que a câmera dupla resolve e ela não: uma
     * releitura minutos depois da chegada vira "saiu da escola". A janela de
     * repetição abaixo cobre a fila; acima dela, quem garante é ter as duas
     * câmeras.
     *
     * A segunda leitura igual dentro de um minuto é ignorada em silêncio — a
     * tela mostra o cartão do mesmo jeito, porque para quem está no portão
     * nada deu errado.
     */
    async registrar(input: RegistrarInput & { deviceLabel?: string | null }) {
      const aluno = await repo.findStudent(input.studentId);
      if (!aluno) throw new NotFoundError("Aluno não encontrado nesta escola.");

      if (!matriculado(aluno.status)) {
        throw new ConflictError(
          `A matrícula de ${aluno.name} não está ativa. Encaminhe à secretaria.`,
        );
      }

      const agora = deps.now();
      const ultima = await repo.lastEntryOf(input.studentId, inicioDoDia());
      const direcao = input.direction ?? (ultima?.direction === "entrada" ? "saida" : "entrada");

      /*
       * Duas leituras do mesmo aluno em menos de um minuto são a fila, não uma
       * ida e volta: ninguém entra na escola e sai dela em cinquenta segundos.
       *
       * A regra ignora o sentido de propósito. A primeira versão comparava com
       * `ultima.direction`, e na alternância isso nunca batia — porque ali o
       * sentido já vem invertido por construção. O resultado era o pior caso
       * possível: releitura na fila gravada como "saiu da escola", e a lista
       * de quem está dentro mentindo justamente no dia em que alguém precisar
       * dela.
       */
      const repetida =
        !!ultima && agora.getTime() - ultima.occurredAt.getTime() < JANELA_DE_RELEITURA_MS;

      if (!repetida) {
        await repo.recordEntry({
          studentId: input.studentId,
          direction: direcao,
          method: input.method,
          operatorUserId: deps.actor.userId,
          deviceLabel: input.deviceLabel ?? null,
          occurredAt: agora,
        });
      }

      return {
        aluno,
        direction: direcao,
        method: input.method,
        occurredAt: agora,
        /** `true` quando a leitura foi ignorada por repetição. */
        repetida,
      };
    },

    /**
     * Cadastra o molde do aluno.
     *
     * **Sem consentimento de biometria não grava** — é a mesma regra da foto, e
     * pelo mesmo motivo: autorizar foto no mural não é autorizar
     * reconhecimento na entrada. A checagem é aqui e não na tela porque tela
     * se contorna.
     */
    async cadastrarMolde(input: CadastrarMoldeInput) {
      const aluno = await repo.findStudent(input.studentId);
      if (!aluno) throw new NotFoundError("Aluno não encontrado nesta escola.");

      if (!(await repo.hasBiometricConsent(input.studentId))) {
        throw new ValidationError(
          `A família de ${aluno.name} não autorizou identificação biométrica. ` +
            "Ele entra pela carteirinha.",
        );
      }

      const cifrado = cifrarMolde(input.descritor, deps.chave);
      await repo.saveTemplate({
        studentId: input.studentId,
        cipher: cifrado.cipher,
        iv: cifrado.iv,
        authTag: cifrado.authTag,
        dimensions: input.descritor.length,
        extractor: input.extractor,
        enrolledByUserId: deps.actor.userId,
      });

      return { studentId: input.studentId, dimensions: input.descritor.length };
    },

    /**
     * Apaga o molde.
     *
     * Chamado pela revogação da foto: meia revogação — que apaga a imagem e
     * deixa o molde — seria pior que não revogar, porque a catraca continuaria
     * reconhecendo a criança cuja família pediu para parar.
     */
    async apagarMolde(studentId: string) {
      await repo.deleteTemplate(studentId);
    },

    /** O rodapé do quiosque: quantos estão dentro, e o movimento de hoje. */
    async situacao() {
      const desde = inicioDoDia();
      const [dentro, passagens] = await Promise.all([
        repo.presentCount(desde),
        repo.listEntries({ desde, ate: fimDoDia(desde), limite: LIMITE_DA_LISTA }),
      ]);
      return { dentro, passagens };
    },

    /**
     * As passagens de um dia, com filtro por aluno.
     *
     * Sem `dia`, hoje: quem abre a tela quer o movimento de agora, e obrigar a
     * escolher data antes de ver qualquer coisa é ruído no caminho comum.
     */
    async passagens(input: PassagensInput) {
      const desde = input.dia ? diaCivil(input.dia) : inicioDoDia();
      return repo.listEntries({
        desde,
        ate: fimDoDia(desde),
        studentId: input.studentId,
        excluidas: input.excluidas,
        limite: LIMITE_DA_LISTA,
      });
    },

    /**
     * Exclui uma passagem — marcando, nunca apagando.
     *
     * Devolve `NotFound` também para a que já estava excluída: para quem
     * chamou, o efeito é o mesmo, e sobrescrever o autor apagaria justamente
     * o registro que uma conferência vai procurar.
     */
    async excluir(input: ExcluirPassagemInput) {
      const removida = await repo.softDelete(input.id, deps.actor.userId, deps.now());
      if (!removida) {
        throw new NotFoundError("Esta passagem não existe ou já foi excluída.");
      }
      return { id: removida.id };
    },
  };
}

export type GateService = ReturnType<typeof createGateService>;
