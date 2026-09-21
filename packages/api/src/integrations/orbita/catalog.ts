/**
 * O catálogo de preços e o saldo da escola no Órbita.
 *
 * A interface existe antes da porta: hoje o Órbita só expõe suas procedures
 * atrás de sessão por cookie, então não há de onde ler isto de fora. Enquanto
 * a superfície máquina-a-máquina não existe lá, roda o dublê — e a tela já
 * mostra custo e saldo com a forma certa.
 *
 * Quando a porta existir, é outra implementação atrás da mesma interface. O
 * service, o router e a tela não mudam.
 */

/**
 * Preço de um app, como o Órbita o guarda em `AppStarCost` por `appSlug`.
 *
 * `setupCost` é o débito da ativação; `monthlyCost` é o recorrente. No Órbita
 * `monthlyCost` também é usado como preço por ação em alguns apps (IA, envio),
 * e nesses casos `unitLabel` diz do que se trata — "por pergunta", "por
 * mensagem". Mostrar "30/mês" onde o certo é "5 por pergunta" faria a escola
 * planejar gasto errado.
 */
export interface AppCost {
  appKey: string;
  setupCost: number;
  monthlyCost: number;
  /** Quando o custo é por evento e não por mês. Nulo = mensalidade. */
  unitLabel: string | null;
  /** `false` desliga a cobrança no Órbita sem apagar a linha de preço. */
  isEnabled: boolean;
}

/**
 * Saldo da escola. Bônus vem separado de propósito: há ação no Órbita que não
 * aceita saldo de bônus, então somar os dois mostraria dinheiro que a escola
 * não pode gastar ali.
 */
export interface StarBalance {
  balance: number;
  bonusBalance: number;
}

export interface OrbitaCatalog {
  /** Preço dos apps pedidos. App sem linha de preço não volta no mapa. */
  costs(appKeys: string[]): Promise<Map<string, AppCost>>;
  /** `null` quando a escola ainda não conectou a conta no Órbita. */
  balance(orbitaOrganizationId: string | null): Promise<StarBalance | null>;
}

/**
 * Catálogo de demonstração, com valores plausíveis.
 *
 * **Estes números não são os do Órbita.** O catálogo de verdade é preenchido
 * pelo admin em `/admin/stars` e vive no banco de lá. Isto existe para a tela
 * ter forma e para os testes rodarem sem rede.
 */
const CUSTOS_DEMONSTRACAO: Record<string, Omit<AppCost, "appKey">> = {
  "crm-tracking": { setupCost: 120, monthlyCost: 80, unitLabel: null, isEnabled: true },
  chat: { setupCost: 70, monthlyCost: 45, unitLabel: null, isEnabled: true },
  agendas: { setupCost: 40, monthlyCost: 25, unitLabel: null, isEnabled: true },
  forms: { setupCost: 40, monthlyCost: 25, unitLabel: null, isEnabled: true },
  workspace: { setupCost: 60, monthlyCost: 2, unitLabel: "por execução", isEnabled: true },
  payment: { setupCost: 100, monthlyCost: 60, unitLabel: null, isEnabled: true },
  nbox: { setupCost: 30, monthlyCost: 20, unitLabel: null, isEnabled: true },
  disparo: { setupCost: 50, monthlyCost: 1, unitLabel: "por mensagem", isEnabled: true },
  linnker: { setupCost: 0, monthlyCost: 30, unitLabel: null, isEnabled: true },
  pages: { setupCost: 80, monthlyCost: 40, unitLabel: null, isEnabled: true },
  route: { setupCost: 90, monthlyCost: 20, unitLabel: "por vídeo", isEnabled: true },
  trafego: { setupCost: 150, monthlyCost: 100, unitLabel: null, isEnabled: true },
  astro: { setupCost: 0, monthlyCost: 5, unitLabel: "por pergunta", isEnabled: true },
};

export function createDemoCatalog(saldo: StarBalance = { balance: 1240, bonusBalance: 100 }) {
  return {
    async costs(appKeys: string[]) {
      const mapa = new Map<string, AppCost>();
      for (const appKey of appKeys) {
        const custo = CUSTOS_DEMONSTRACAO[appKey];
        if (custo) mapa.set(appKey, { appKey, ...custo });
      }
      return mapa;
    },

    async balance(orbitaOrganizationId: string | null) {
      // Sem conta conectada não há saldo — e não há como inventar um.
      return orbitaOrganizationId ? saldo : null;
    },
  } satisfies OrbitaCatalog;
}
