import type { Quadro } from "./face-extractor";

/**
 * "É gente de verdade na frente da câmera, ou uma reprodução?"
 *
 * Existe por um ataque confirmado: **uma foto do rosto na tela do celular
 * abriu a portaria.** Reconhecimento facial compara descritores, e o descritor
 * de uma foto é igual ao do rosto que a originou — nenhum limiar de
 * identidade resolve isso. Quem responde é um modelo próprio, treinado para
 * ver textura de tela e de papel.
 *
 * DECISÃO-JOÃO: `@vladmandic/human` para vivacidade.
 * Quebra se: ficar de fora, e aí a foto na tela continua abrindo o portão.
 * Fiz assim: mesmo autor do `face-api`, modelos prontos, roda no navegador.
 *   Entra **só** para dizer se é reprodução — a identidade continua com o
 *   `face-api`, que já está calibrado. São dois detectores por leitura, o que
 *   é desperdício conhecido e o preço de não recalibrar o limiar de identidade
 *   agora.
 * Alternativas: trocar tudo por `human`, com um detector só — recalibra o
 *   limiar e invalida os moldes já cadastrados · câmera com profundidade ou
 *   infravermelho, que tira o problema do navegador.
 *
 * **O que isto não faz:** máscara 3D e ataque dedicado continuam fora do
 * alcance de qualquer modelo que olhe só a imagem.
 */

const CAMINHO_DOS_PESOS = "/modelos-de-vivacidade/";

/**
 * O piso para aceitar como pessoa real.
 *
 * Meio a meio é o padrão do modelo. Subir isto barra mais reprodução e
 * também mais gente de verdade — e gente de verdade barrada não fica na
 * porta: cai na carteirinha, que é o caminho que nunca falha. Por isso o
 * ajuste, se vier, é para cima.
 */
export const PISO_DE_VIVACIDADE = 0.5;

/**
 * Prazo máximo de uma avaliação.
 *
 * Existe porque a primeira versão travou: a promessa não retornava, e o laço
 * de leitura do portão ficaria parado para sempre esperando por ela. Num
 * portão, "não respondeu" tem de virar "recusado" — e recusar aqui não barra
 * ninguém, manda para a carteirinha.
 */
export const PRAZO_DA_AVALIACAO_MS = 4000;

export interface Veredito {
  /** 0 a 1: quanto o modelo acha que não é reprodução. */
  real: number;
  /** 0 a 1: quanto o modelo acha que há vida no quadro. */
  vivo: number;
  aprovado: boolean;
}

export interface DetectorDeVivacidade {
  readonly disponivel: boolean;
  preparar(): Promise<void>;
  /** `null` quando não há rosto no quadro, ou quando o modelo não carregou. */
  avaliar(quadro: Quadro): Promise<Veredito | null>;
}

/** Sem o modelo, a portaria recusa o rosto e pede a carteirinha. */
export const DETECTOR_AUSENTE: DetectorDeVivacidade = {
  disponivel: false,
  preparar: async () => undefined,
  avaliar: async () => null,
};

/*
 * O apelido que leva este import à build de navegador está no `vite.config.ts`
 * — o `exports` do pacote manda o resolvedor para a build de Node, que importa
 * um binário nativo inexistente aqui.
 */
type HumanModulo = typeof import("@vladmandic/human");
type Instancia = InstanceType<HumanModulo["Human"]>;

let instancia: Instancia | null = null;
let carregando: Promise<Instancia | null> | null = null;

async function carregar(): Promise<Instancia | null> {
  if (instancia) return instancia;
  carregando ??= (async () => {
    try {
      const { Human } = await import("@vladmandic/human");
      const human = new Human({
        modelBasePath: CAMINHO_DOS_PESOS,
        // Só o que responde "é reprodução?". Malha, íris, emoção, corpo e mão
        // não dizem nada sobre isso e custariam megabytes e milissegundos.
        face: {
          enabled: true,
          detector: { modelPath: "blazeface.json", rotation: false },
          // A malha produz o recorte alinhado que o antispoof consome. Sem
          // ela a avaliação não retorna — e não retornar é pior que recusar.
          mesh: { enabled: true, modelPath: "facemesh.json" },
          iris: { enabled: false },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: true, modelPath: "antispoof.json" },
          liveness: { enabled: true, modelPath: "liveness.json" },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: false },
        filter: { enabled: false },
      });
      await human.load();
      /*
       * Aquecer aqui, não no portão.
       *
       * A primeira avaliação leva quase quatro segundos — é a compilação dos
       * tensores, paga uma vez. Deixá-la para a primeira pessoa que chegar
       * pareceria a portaria travada justo na hora de usar, e encostaria no
       * prazo acima. Aquecida, cada leitura fica na casa dos milissegundos.
       */
      await human.warmup();
      instancia = human;
      return human;
    } catch {
      return null;
    }
  })();
  return carregando;
}

export const detectorDeVivacidade: DetectorDeVivacidade = {
  disponivel: true,

  async preparar() {
    await carregar();
  },

  async avaliar(quadro) {
    const human = await carregar();
    if (!human) return null;

    /*
     * Com prazo, e o prazo recusa.
     *
     * Vivacidade é a única coisa entre um retrato e o portão: se ela não
     * responde, o certo é não abrir. Quem estiver ali passa a carteirinha, que
     * é o caminho que nunca falha.
     */
    const saida = await Promise.race([
      human.detect(quadro as HTMLVideoElement),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), PRAZO_DA_AVALIACAO_MS)),
    ]);
    if (!saida) return { real: 0, vivo: 0, aprovado: false };

    const rosto = saida.face?.[0];
    if (!rosto) return null;

    const real = rosto.real ?? 0;
    const vivo = rosto.live ?? 0;
    // Os dois, e não o melhor dos dois: são modelos independentes olhando
    // sinais diferentes, e exigir os dois é o que torna a barreira dupla.
    return { real, vivo, aprovado: real >= PISO_DE_VIVACIDADE && vivo >= PISO_DE_VIVACIDADE };
  },
};

export const vivacidadeDisponivel = (): boolean => detectorDeVivacidade.disponivel;
