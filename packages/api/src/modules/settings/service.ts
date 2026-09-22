import { DEFAULT_TIMEZONE } from "../../dates";
import { NotFoundError } from "../../errors";
import { CURRENT_TERM_VERSION } from "../enrollment/schema";
import { ENROLLED_STATUSES } from "../student/schema";
import { MINIMUM_ATTENDANCE_RATE } from "../student/service";
import { PENDING_FOR_OVERDUE } from "../teacher/service";
import { MANAGEMENT_ROLES, type SettingsRepository } from "./repository";
import type { UpdateSchoolInput } from "./schema";

/**
 * As regras que a escola opera e **não** pode mudar por tela.
 *
 * A lista existe para não mentir por omissão: uma tela de configurações sem
 * elas faz a direção procurar um botão que não há, e uma tela *com* elas como
 * campo editável prometeria o que o código não cumpre. São lidas das mesmas
 * constantes que o resto do sistema usa — se o limiar mudar no service, esta
 * tela muda junto, porque não há segunda cópia do número.
 *
 * DECISÃO-JOÃO: quais destas regras viram configuração por escola.
 * Quebra se: tornar a frequência mínima editável contraria a LDB art. 24, VI
 *   quando alguém baixar de 75%; e tornar o fuso editável hoje é campo morto —
 *   `toSchoolDate` usa `DEFAULT_TIMEZONE` fixo em oito pontos do servidor, e o
 *   valor de `school.timezone` não é lido em lugar nenhum.
 * Fiz assim: leitura, com a origem de cada regra escrita ao lado, para a
 *   decisão de abrir cada uma ser consciente em vez de herdada.
 * Alternativas: coluna de política por escola com validação de piso legal ·
 *   `timezone` no `TenantContext`, que obriga a passar o fuso em toda chamada
 *   de data do servidor.
 */
export interface RegraEmVigor {
  chave: string;
  titulo: string;
  valor: string;
  porque: string;
  onde: string;
}

const ROTULO_DA_SITUACAO: Record<(typeof ENROLLED_STATUSES)[number], string> = {
  ativo: "Ativo",
  documentacao_pendente: "Documentação pendente",
};

export function regrasEmVigor(): RegraEmVigor[] {
  return [
    {
      chave: "frequencia_minima",
      titulo: "Frequência mínima para aprovação",
      valor: `${Math.round(MINIMUM_ATTENDANCE_RATE * 100)}% das aulas dadas`,
      porque: "Piso legal da LDB, art. 24, VI. Atraso conta como presença.",
      onde: "student/service.ts",
    },
    {
      chave: "prazo_da_chamada",
      titulo: "Prazo para registrar a chamada",
      valor: "até o fim do dia da aula",
      porque:
        "Depois disso o registro vira correção de histórico, e passa a exigir justificativa escrita.",
      onde: "lesson/service.ts",
    },
    {
      chave: "nota_publicada",
      titulo: "Nota visível ao aluno",
      valor: "só depois de publicada",
      porque:
        "Rascunho é do professor. E avaliação sem lançamento não vale zero: fica de fora da média.",
      onde: "assessment/service.ts",
    },
    {
      chave: "quem_esta_na_sala",
      titulo: "Quem entra na chamada e na grade de notas",
      // Rótulo legível, e não o valor cru do enum: "documentacao_pendente"
      // numa tela da direção parece vazamento de banco.
      valor: ENROLLED_STATUSES.map((e) => ROTULO_DA_SITUACAO[e]).join(" · "),
      porque:
        "Documentação pendente não tira o aluno da turma: ele assiste à aula, recebe nota e conta como pendência.",
      onde: "student/schema.ts",
    },
    {
      chave: "pendencias_para_atraso",
      titulo: "Pendências que marcam um professor como atrasado",
      valor: `${PENDING_FOR_OVERDUE} ou mais`,
      porque: "É limiar de acompanhamento da coordenação, não avaliação de desempenho (§10.6).",
      onde: "teacher/service.ts",
    },
    {
      chave: "fuso",
      titulo: "Fuso horário do dia letivo",
      valor: DEFAULT_TIMEZONE,
      porque:
        "O dia letivo é civil e local. Hoje é fixo no servidor — a coluna da escola ainda não é lida.",
      onde: "dates.ts",
    },
    {
      chave: "versao_dos_termos",
      titulo: "Versão dos termos de matrícula",
      valor: CURRENT_TERM_VERSION,
      porque: "É o que fica gravado no consentimento do responsável, para o aceite ser auditável.",
      onde: "enrollment/schema.ts",
    },
  ];
}

export interface SettingsView {
  escola: NonNullable<Awaited<ReturnType<SettingsRepository["find"]>>>;
  acessos: { role: string; total: number }[];
  administradores: Awaited<ReturnType<SettingsRepository["administrators"]>>;
  regras: RegraEmVigor[];
}

export function createSettingsService(repo: SettingsRepository) {
  return {
    async overview(): Promise<SettingsView> {
      const [escola, porPapel, administradores] = await Promise.all([
        repo.find(),
        repo.countByRole(),
        repo.administrators(),
      ]);

      if (!escola) throw new NotFoundError("Escola não encontrada");

      return { escola, acessos: porPapel, administradores, regras: regrasEmVigor() };
    },

    /**
     * Grava os atributos escolares. **O nome da escola não passa por aqui.**
     *
     * Ele vive em `organization`, que é do Better Auth: a tela o altera por
     * `authClient.organization.update`, para a checagem de permissão e os
     * hooks da auth valerem. Escrever nessa tabela a partir do domínio faria
     * as duas coisas passarem ao largo.
     */
    async updateSchool(input: UpdateSchoolInput) {
      const inepCode = input.inepCode?.trim() ? input.inepCode.trim() : null;

      const atualizada = await repo.update({ inepCode });
      if (!atualizada) throw new NotFoundError("Escola não encontrada");
      return atualizada;
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
export { MANAGEMENT_ROLES };
