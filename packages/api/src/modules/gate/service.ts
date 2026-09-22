import { ConflictError, NotFoundError, ValidationError } from "../../errors";
import { ENROLLED_STATUSES } from "../student/schema";
import { identificar, type Veredito } from "./reconhecimento";
import type { GateRepository } from "./repository";
import type { CadastrarMoldeInput, RegistrarInput } from "./schema";
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
 * A portaria.
 *
 * Duas regras atravessam tudo aqui. **Passagem não é chamada** — o registro
 * diz que o aluno cruzou o portão, e quem marca presença continua sendo o
 * professor. E **a carteirinha é o modo que nunca falha**: qualquer caminho
 * que dê errado no rosto termina pedindo o QR, nunca barrando a criança.
 */
export function createGateService(repo: GateRepository, deps: DepsDaPortaria) {
  function inicioDoDia(): Date {
    const agora = deps.now();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
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
     * A direção é conferida contra a última passagem do dia: duas entradas
     * seguidas quase sempre são o mesmo aluno lido duas vezes na fila, e
     * gravar as duas estragaria a conta de quem está dentro. A segunda leitura
     * dentro de um minuto é ignorada em silêncio — a tela mostra o cartão do
     * mesmo jeito, porque para quem está no portão nada deu errado.
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
      const repetida =
        ultima?.direction === input.direction &&
        agora.getTime() - ultima.occurredAt.getTime() < 60_000;

      if (!repetida) {
        await repo.recordEntry({
          studentId: input.studentId,
          direction: input.direction,
          method: input.method,
          operatorUserId: deps.actor.userId,
          deviceLabel: input.deviceLabel ?? null,
          occurredAt: agora,
        });
      }

      return {
        aluno,
        direction: input.direction,
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

    /** O rodapé do quiosque e a tela da gestão. */
    async situacao() {
      const desde = inicioDoDia();
      const [dentro, passagens] = await Promise.all([
        repo.presentCount(desde),
        repo.listEntries(desde, 50),
      ]);
      return { dentro, passagens };
    },
  };
}

export type GateService = ReturnType<typeof createGateService>;
