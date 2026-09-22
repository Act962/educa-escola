/**
 * O extrator: transforma um quadro da câmera nos "códigos do rosto".
 *
 * DECISÃO-JOÃO: `@vladmandic/face-api` é a escolha de agora, não a definitiva.
 * Quebra se: for trocada depois de a escola cadastrar rostos — descritor de
 *   extrator diferente não se compara, e todo mundo recadastra. É por isso que
 *   `NOME_DO_EXTRATOR` vai gravado junto de cada molde: a troca fica
 *   detectável em vez de silenciosa.
 * Fiz assim: entrou para o teste local pedido pelo usuário, com versão fixa no
 *   catálogo e os pesos servidos do próprio pacote — sem CDN, porque portaria
 *   de escola é onde a rede falta. Trocar é reescrever este arquivo; nada no
 *   resto do sistema conhece a biblioteca.
 * Alternativas: `@mediapipe/tasks-vision` (mais leve, acelerado por GPU) ·
 *   extrair no servidor, sem lib no navegador, mandando a imagem pela rede.
 */

/** Vai gravado em cada molde. Mude junto com o modelo, sempre. */
export const NOME_DO_EXTRATOR = "face-api/1.7.15/tiny+resnet";

/** De onde o Vite serve os pesos (ver `pesosDoReconhecimentoFacial`). */
const CAMINHO_DOS_PESOS = "/modelos-de-rosto";

/**
 * Confiança mínima para considerar que há um rosto no quadro.
 *
 * Alta de propósito: a portaria roda sobre vídeo contínuo, e um detector
 * frouxo acha rosto em casaco, cartaz e sombra. Cada falso rosto vira uma
 * comparação contra a escola inteira, e uma comparação a mais é uma chance a
 * mais de identificar a criança errada.
 */
const CONFIANCA_MINIMA = 0.6;

/**
 * O lado do quadro que vai ao detector.
 *
 * O padrão da biblioteca é 416, e a câmera entrega 720. Reduzir é a alavanca
 * mais direta sobre o tempo de leitura — o custo cresce com a área, então cair
 * para 320 tira mais da metade do trabalho. Rosto de portaria chega perto da
 * câmera e ocupa boa parte do quadro; é o caso em que a resolução menor não
 * atrapalha. Se um dia deixar de achar rosto de longe, é aqui que se mexe.
 */
const LADO_DO_DETECTOR = 320;

/**
 * O que se pode ler: o vídeo ao vivo ou um quadro já congelado.
 *
 * O canvas existe aqui por um defeito que custou caro. A captura da foto
 * extraía do `<video>` **depois** de mostrar a prévia — e mostrar a prévia
 * desmonta o vídeo. O elemento solto fica com `videoWidth` zero, a leitura
 * desistia na guarda, e a tela dizia "não foi possível ler o rosto" numa foto
 * nítida, de frente e bem iluminada. Ler do canvas é ler exatamente o quadro
 * que virou a foto, sem depender de nada continuar na tela.
 */
export type Quadro = HTMLVideoElement | HTMLCanvasElement;

export interface ExtratorDeRosto {
  readonly nome: string;
  readonly disponivel: boolean;
  /** Carrega o modelo. Chamado uma vez, na abertura do quiosque. */
  preparar(): Promise<void>;
  /**
   * Há alguém na frente da câmera?
   *
   * É o sensor que acorda a portaria, e existe separado de `extrair` porque
   * custa uma fração dele: aqui roda só o detector, e não os pontos do rosto
   * nem a rede que gera o descritor. Numa portaria vazia — que é o estado
   * quase o tempo todo — é a diferença entre o tablet esquentando à toa e o
   * tablet esperando quieto.
   */
  temRosto(quadro: Quadro): Promise<boolean>;
  /**
   * Os códigos do rosto que estiver no quadro, ou `null` se não houver rosto.
   *
   * `null` é resposta legítima e frequente: a maior parte dos quadros de uma
   * portaria não tem ninguém na frente da câmera.
   */
  extrair(quadro: Quadro): Promise<number[] | null>;
}

/**
 * O extrator quando a biblioteca não está instalada.
 *
 * Não lança: a portaria precisa subir e atender pela carteirinha mesmo sem
 * rosto. `disponivel` é o que a tela lê para não prometer o que não tem.
 */
export const EXTRATOR_AUSENTE: ExtratorDeRosto = {
  nome: "nenhum",
  disponivel: false,
  preparar: async () => undefined,
  temRosto: async () => false,
  extrair: async () => null,
};

type FaceApi = typeof import("@vladmandic/face-api");

let modulo: FaceApi | null = null;
let carregando: Promise<FaceApi | null> | null = null;

/**
 * Carrega biblioteca e pesos uma vez só.
 *
 * Import dinâmico porque são megabytes que só a portaria usa: deixá-lo
 * estático colocaria o modelo no pacote de quem abre o boletim.
 */
async function carregar(): Promise<FaceApi | null> {
  if (modulo) return modulo;
  carregando ??= (async () => {
    try {
      const api = await import("@vladmandic/face-api");
      await Promise.all([
        api.nets.tinyFaceDetector.loadFromUri(CAMINHO_DOS_PESOS),
        api.nets.faceLandmark68TinyNet.loadFromUri(CAMINHO_DOS_PESOS),
        api.nets.faceRecognitionNet.loadFromUri(CAMINHO_DOS_PESOS),
      ]);

      /*
       * Aquece antes de alguém chegar.
       *
       * Carregar os pesos não compila os núcleos de GPU: isso acontece na
       * primeira detecção, e custa segundos. Deixá-la para a primeira pessoa
       * do dia é entregar a pior leitura logo a quem está olhando a câmera —
       * e foi essa demora que apareceu no uso real. Um quadro em branco não
       * tem rosto, mas paga a compilação do detector, que é a parte cara.
       */
      const aquecimento = document.createElement("canvas");
      aquecimento.width = LADO_DO_DETECTOR;
      aquecimento.height = LADO_DO_DETECTOR;
      try {
        /*
         * As três redes, uma a uma.
         *
         * Aquecer só o detector não bastava: o quadro em branco não tem rosto,
         * então os pontos e o descritor nunca rodavam e a compilação deles
         * caía na primeira pessoa do dia — **1,3 segundo**, medido. Chamadas
         * direto em cada rede compilam sem precisar de rosto nenhum; depois
         * disso cada leitura fica em algumas dezenas de milissegundos.
         */
        await api.detectSingleFace(
          aquecimento,
          new api.TinyFaceDetectorOptions({ inputSize: LADO_DO_DETECTOR }),
        );
        const recorte = document.createElement("canvas");
        recorte.width = 150;
        recorte.height = 150;
        await api.nets.faceLandmark68TinyNet.detectLandmarks(recorte);
        await api.nets.faceRecognitionNet.computeFaceDescriptor(recorte);
      } catch {
        // Quadro em branco não tem rosto; o que importa aqui é a compilação
        // ter acontecido, não o resultado.
      }

      modulo = api;
      return api;
    } catch {
      // Pesos ausentes, WebGL indisponível, aparelho fraco: a portaria cai
      // para a carteirinha em vez de mostrar tela de erro no corredor.
      return null;
    }
  })();
  return carregando;
}

/**
 * Vídeo sem quadro ainda devolveria tensor vazio, e a biblioteca estouraria
 * dentro do laço da câmera. Canvas já é um quadro: basta ter tamanho.
 */
export function quadroPronto(quadro: Quadro): boolean {
  if (quadro instanceof HTMLCanvasElement) return quadro.width > 0 && quadro.height > 0;
  return quadro.readyState >= 2 && quadro.videoWidth > 0;
}

export const extratorDeRosto: ExtratorDeRosto = {
  nome: NOME_DO_EXTRATOR,
  disponivel: true,

  async preparar() {
    await carregar();
  },

  async temRosto(quadro) {
    const api = await carregar();
    if (!api || !quadroPronto(quadro)) return false;

    const achado = await api.detectSingleFace(
      quadro,
      new api.TinyFaceDetectorOptions({
        scoreThreshold: CONFIANCA_MINIMA,
        inputSize: LADO_DO_DETECTOR,
      }),
    );
    return !!achado;
  },

  async extrair(quadro) {
    const api = await carregar();
    if (!api || !quadroPronto(quadro)) return null;

    const achado = await api
      .detectSingleFace(
        quadro,
        new api.TinyFaceDetectorOptions({
          scoreThreshold: CONFIANCA_MINIMA,
          inputSize: LADO_DO_DETECTOR,
        }),
      )
      .withFaceLandmarks(true)
      .withFaceDescriptor();

    return achado ? Array.from(achado.descriptor) : null;
  },
};

export const rostoDisponivel = (): boolean => extratorDeRosto.disponivel;
