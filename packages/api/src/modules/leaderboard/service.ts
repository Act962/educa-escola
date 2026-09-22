import { ValidationError } from "../../errors";
import { indicatorsFor } from "./indicators";
import type { LeaderboardLookup, LeaderboardRepository } from "./repository";

/**
 * Regra do placar entre escolas.
 *
 * O consentimento manda em tudo: sem adesão ativa a escola não publica número
 * nenhum, e sair apaga o que já estava publicado.
 */
export function createLeaderboardService(deps: {
  repo: LeaderboardRepository;
  lookup: LeaderboardLookup;
  schoolId: string;
}) {
  return {
    /** A situação da própria escola: aderiu? com que nome? quantos pontos? */
    async status(academicYear: number) {
      const adesao = await deps.repo.currentOptIn();
      const contagens = await deps.repo.contagens(academicYear);

      return {
        aderiu: adesao?.status === "ativa",
        displayName: adesao?.displayName ?? null,
        // Os indicadores aparecem mesmo sem adesão: a direção precisa ver o
        // que seria publicado **antes** de decidir publicar.
        indicadores: indicatorsFor(contagens),
      };
    },

    async optIn(input: { displayName: string; academicYear: number; userId: string }) {
      const adesao = await deps.repo.optIn(input);
      await this.publicar(input.academicYear);
      return adesao;
    },

    optOut: () => deps.repo.optOut(),

    /**
     * Recalcula e publica o número desta escola.
     *
     * Recusa sem adesão ativa em vez de publicar em silêncio: publicar é o
     * ato que expõe a escola, e ele não pode acontecer por efeito colateral
     * de outra coisa.
     */
    async publicar(academicYear: number) {
      const adesao = await deps.repo.currentOptIn();
      if (!adesao || adesao.status !== "ativa") {
        throw new ValidationError("A escola não aderiu ao placar entre escolas.");
      }

      const indicadores = indicatorsFor(await deps.repo.contagens(academicYear));
      return deps.repo.publish({
        displayName: adesao.displayName,
        academicYear,
        ...indicadores,
      });
    },

    /**
     * O placar, com a posição da própria escola marcada.
     *
     * Só escolas que aderiram entram — e a marcação de "esta é a sua" é feita
     * aqui, com o `schoolId` do tenant, não por id vindo da tela.
     */
    async scoreboard(academicYear: number) {
      const linhas = await deps.lookup.scoreboard(academicYear);
      return linhas.map((linha, indice) => ({
        posicao: indice + 1,
        displayName: linha.displayName,
        points: linha.points,
        chamadaNoPrazo: linha.chamadaNoPrazo,
        notasSemPendencia: linha.notasSemPendencia,
        frequenciaMedia: linha.frequenciaMedia,
        // O id da escola não vai para a tela: quem precisa dele é esta linha,
        // para dizer "esta é a sua". Mandar o id de todas seria devolver uma
        // chave de outro tenant sem necessidade nenhuma.
        propria: linha.schoolId === deps.schoolId,
      }));
    },
  };
}

export type LeaderboardService = ReturnType<typeof createLeaderboardService>;
