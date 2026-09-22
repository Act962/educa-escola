import { NotFoundError, ValidationError } from "../../errors";
import { type ContagemDeDiasLetivos, contarDiasLetivos } from "./dias-letivos";
import type { CalendarRepository } from "./repository";
import type { CreateEventInput, DefineYearInput } from "./schema";

export interface VisaoDoAno {
  /** `null` quando o ano letivo ainda não foi definido. */
  ano: { startsOn: string; endsOn: string; minimumSchoolDays: number } | null;
  contagem: ContagemDeDiasLetivos | null;
  eventos: Awaited<ReturnType<CalendarRepository["listEvents"]>>;
}

export function createCalendarService(repo: CalendarRepository) {
  return {
    /**
     * O ano letivo inteiro: período, eventos e a contagem de dias letivos.
     *
     * **Sem ano definido, a contagem é `null`, não zero.** Contar a partir de
     * 1º de janeiro daria um número plausível e errado, e número errado sobre
     * obrigação legal é pior que número nenhum — a tela pede a definição em
     * vez de mostrar um total que ninguém pode usar.
     */
    async year(academicYear: number): Promise<VisaoDoAno> {
      const [ano, eventos] = await Promise.all([
        repo.findYear(academicYear),
        repo.listEvents(academicYear),
      ]);

      if (!ano) return { ano: null, contagem: null, eventos };

      return {
        ano: {
          startsOn: ano.startsOn,
          endsOn: ano.endsOn,
          minimumSchoolDays: ano.minimumSchoolDays,
        },
        contagem: contarDiasLetivos({
          startsOn: ano.startsOn,
          endsOn: ano.endsOn,
          minimo: ano.minimumSchoolDays,
          eventos,
        }),
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

      return repo.createEvent({ ...input, endsOn, createdByUserId: userId });
    },

    async removeEvent(id: string) {
      const removido = await repo.removeEvent(id);
      if (!removido) throw new NotFoundError("Evento não encontrado");
      return removido;
    },
  };
}

export type CalendarService = ReturnType<typeof createCalendarService>;
