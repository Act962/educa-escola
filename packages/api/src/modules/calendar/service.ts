import { NotFoundError, ValidationError } from "../../errors";
import { calendarioBrasileiro } from "./holidays";
import type { CalendarRepository } from "./repository";
import type { CreateEventInput, DefineYearInput, EventScope, UpdateEventInput } from "./schema";
import { type ContagemDeDiasLetivos, contarDiasLetivos } from "./school-days";

type Evento = Awaited<ReturnType<CalendarRepository["listEvents"]>>[number];

export interface VisaoDoAno {
  /** `null` quando o ano letivo ainda não foi definido. */
  ano: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  /** A contagem da **escola**: só o que vale para todo mundo. */
  contagem: ContagemDeDiasLetivos | null;
  /**
   * A contagem da turma filtrada: institucional mais o que é só dela.
   *
   * `null` sem filtro. Fica ao lado da contagem da escola em vez de
   * substituí-la, porque são dois números que a direção precisa ver juntos —
   * o oficial, que a secretaria de educação cobra, e o real daquela turma.
   */
  contagemDaTurma: ContagemDeDiasLetivos | null;
  eventos: Evento[];
}

/**
 * Só evento institucional conta dia letivo da escola.
 *
 * **É a regra que faz o filtro por turma valer alguma coisa.** Um conselho de
 * classe do 9º C marcado como não letivo tira aula do 9º C, não da escola: se
 * entrasse na conta geral, a escola apareceria devendo dias letivos que só uma
 * turma deve, e a direção iria repor aula para todo mundo.
 */
const institucionais = (eventos: Evento[]) => eventos.filter((e) => e.scope === "institucional");

export function createCalendarService(repo: CalendarRepository) {
  /**
   * Resolve o alvo do evento e recusa turma que não é desta escola.
   *
   * O Zod já garante que escopo e turma são coerentes entre si; o que ele não
   * tem como saber é se a turma existe *aqui*. Sem esta consulta, um id de
   * turma de outra escola entraria — a chave estrangeira aceitaria, porque a
   * turma existe — e o evento sumiria de toda tela, filtrando por uma turma
   * que ninguém desta escola consegue escolher.
   */
  async function alvoDe(input: {
    scope: EventScope;
    classroomId?: string | null;
  }): Promise<{ scope: EventScope; classroomId: string | null }> {
    if (input.scope !== "turma") return { scope: "institucional", classroomId: null };

    const id = input.classroomId ?? "";
    const turma = await repo.findClassroom(id);
    if (!turma) throw new ValidationError("A turma escolhida não existe nesta escola.");

    return { scope: "turma", classroomId: turma.id };
  }

  return {
    /**
     * O ano letivo inteiro: período, eventos e a contagem de dias letivos.
     *
     * **Sem ano definido, a contagem é `null`, não zero.** Contar a partir de
     * 1º de janeiro daria um número plausível e errado, e número errado sobre
     * obrigação legal é pior que número nenhum — a tela pede a definição em
     * vez de mostrar um total que ninguém pode usar.
     */
    async year(academicYear: number, classroomId?: string): Promise<VisaoDoAno> {
      const [ano, eventos] = await Promise.all([
        repo.findYear(academicYear),
        repo.listEvents(academicYear, classroomId),
      ]);

      if (!ano) return { ano: null, contagem: null, contagemDaTurma: null, eventos };

      const periodo = {
        startsOn: ano.startsOn,
        endsOn: ano.endsOn,
        minimo: ano.minimumSchoolDays,
      };

      return {
        ano: {
          startsOn: ano.startsOn,
          endsOn: ano.endsOn,
          minimumSchoolDays: ano.minimumSchoolDays,
        },
        contagem: contarDiasLetivos({ ...periodo, eventos: institucionais(eventos) }),
        // `eventos` já vem recortado pelo repositório: institucional mais o
        // que é da turma. Por isso a conta da turma é sobre a lista inteira.
        contagemDaTurma: classroomId ? contarDiasLetivos({ ...periodo, eventos }) : null,
        eventos,
      };
    },

    defineYear: (input: DefineYearInput) => repo.defineYear(input),

    /**
     * Cria um evento no calendário.
     *
     * Exige o ano letivo definido: evento fora do período não entra na
     * contagem e viraria uma linha que a escola vê mas que não conta para
     * nada — o tipo de dado que faz a pessoa desconfiar do sistema inteiro.
     */
    async createEvent(input: CreateEventInput, userId: string) {
      const ano = await repo.findYear(input.academicYear);
      if (!ano) {
        throw new ValidationError(
          "Defina o período do ano letivo antes de criar eventos no calendário.",
        );
      }

      const endsOn = input.endsOn ?? input.startsOn;
      if (input.startsOn < ano.startsOn || endsOn > ano.endsOn) {
        throw new ValidationError(
          `O evento precisa estar entre ${ano.startsOn} e ${ano.endsOn}, que é o ano letivo de ${input.academicYear}.`,
        );
      }

      const alvo = await alvoDe(input);

      return repo.createEvent({ ...input, ...alvo, endsOn, createdByUserId: userId });
    },

    /**
     * O calendário brasileiro do ano, marcando o que já está no sistema.
     *
     * Mostra **antes de importar** o que vai entrar e o que vai ficar de fora:
     * confirmar uma importação de quarenta linhas às cegas é o tipo de clique
     * de que a pessoa se arrepende.
     */
    async sugestoes(academicYear: number) {
      const [ano, existentes] = await Promise.all([
        repo.findYear(academicYear),
        repo.listEvents(academicYear),
      ]);

      const jaNoSistema = new Set(existentes.map((e) => `${e.startsOn}|${e.title}`));

      return calendarioBrasileiro(academicYear).map((data) => ({
        ...data,
        jaExiste: jaNoSistema.has(`${data.startsOn}|${data.title}`),
        // Fora do período letivo não entra: 1º de janeiro e o Natal caem
        // fora de quase todo ano letivo, e um evento que não conta para nada
        // é linha que a escola vê e não usa.
        foraDoPeriodo: ano ? data.startsOn < ano.startsOn || data.endsOn > ano.endsOn : true,
      }));
    },

    /**
     * Importa o calendário brasileiro do ano.
     *
     * Idempotente por data e título: rodar de novo depois de acrescentar um
     * feriado municipal à mão não duplica nada. Pula silenciosamente o que
     * está fora do período letivo, e devolve a conta — para a tela dizer "10
     * entraram, 3 ficaram de fora" em vez de só "pronto".
     */
    async importar(academicYear: number, userId: string) {
      const ano = await repo.findYear(academicYear);
      if (!ano) {
        throw new ValidationError("Defina o período do ano letivo antes de importar o calendário.");
      }

      const sugestoes = await this.sugestoes(academicYear);
      const aCriar = sugestoes.filter((s) => !s.jaExiste && !s.foraDoPeriodo);

      for (const data of aCriar) {
        await repo.createEvent({
          academicYear,
          type: data.type,
          dayEffect: data.dayEffect,
          title: data.title,
          description: data.fonte,
          startsOn: data.startsOn,
          endsOn: data.endsOn,
          // Feriado nacional é da escola inteira, por definição.
          scope: "institucional",
          classroomId: null,
          createdByUserId: userId,
        });
      }

      return {
        criados: aCriar.length,
        jaExistiam: sugestoes.filter((s) => s.jaExiste).length,
        foraDoPeriodo: sugestoes.filter((s) => !s.jaExiste && s.foraDoPeriodo).length,
      };
    },

    /**
     * Edita um evento.
     *
     * Passa pela mesma checagem de período da criação: corrigir a data de uma
     * reunião para fora do ano letivo tiraria o evento da contagem sem avisar
     * ninguém, o que é pior que recusar.
     */
    async updateEvent(input: UpdateEventInput) {
      const atual = await repo.findEvent(input.id);
      if (!atual) throw new NotFoundError("Evento não encontrado");

      const ano = await repo.findYear(atual.academicYear);
      if (!ano) {
        throw new ValidationError("O ano letivo deste evento não está mais definido.");
      }

      const endsOn = input.endsOn ?? input.startsOn;
      if (input.startsOn < ano.startsOn || endsOn > ano.endsOn) {
        throw new ValidationError(
          `O evento precisa estar entre ${ano.startsOn} e ${ano.endsOn}, que é o ano letivo de ${atual.academicYear}.`,
        );
      }

      const alvo = await alvoDe(input);

      const { id, ...resto } = input;
      const atualizado = await repo.updateEvent(id, { ...resto, ...alvo, endsOn });
      if (!atualizado) throw new NotFoundError("Evento não encontrado");
      return atualizado;
    },

    async removeEvent(id: string) {
      const removido = await repo.removeEvent(id);
      if (!removido) throw new NotFoundError("Evento não encontrado");
      return removido;
    },
  };
}

export type CalendarService = ReturnType<typeof createCalendarService>;
