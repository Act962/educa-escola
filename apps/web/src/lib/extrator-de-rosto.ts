/**
 * O extrator: transforma um quadro da câmera nos "códigos do rosto".
 *
 * DECISÃO-JOÃO: qual biblioteca de reconhecimento facial entra no projeto.
 * Quebra se: a escolha errada trava o navegador do tablet, ou baixa dezenas de
 *   megabytes de modelo em rede de escola. Também é a primeira dependência do
 *   sistema que processa biometria de menor — entra com o encarregado de dados
 *   sabendo.
 * Fiz assim: uma interface com implementação nula. A portaria **funciona
 *   inteira pela carteirinha** sem ela; ligar o rosto é registrar um extrator
 *   aqui, e nada mais no resto do código muda.
 * Alternativas: `@vladmandic/face-api` (sucessor mantido do face-api.js,
 *   descritor de 128 dimensões, ~6 MB de modelo) · MediaPipe Face Embedder do
 *   Google (mais leve e acelerado por GPU, descritor de outro tamanho) ·
 *   extrair no servidor, que evita lib no navegador e manda a imagem da
 *   criança pela rede a cada leitura.
 *
 * O nome do extrator vai gravado junto de cada molde: descritor de
 * bibliotecas diferentes não se compara, e trocar de biblioteca é recadastrar
 * todo mundo. A coluna `extractor` é o que torna isso detectável em vez de
 * silencioso.
 */
export interface ExtratorDeRosto {
  /** Identificador gravado junto do molde. Mude ao trocar de modelo. */
  readonly nome: string;
  /** Carrega o modelo. Chamado uma vez, na abertura do quiosque. */
  preparar(): Promise<void>;
  /**
   * Os códigos do rosto que estiver no quadro, ou `null` se não houver rosto.
   *
   * `null` é resposta legítima e frequente: a maior parte dos quadros de uma
   * portaria não tem ninguém na frente da câmera.
   */
  extrair(quadro: HTMLVideoElement): Promise<number[] | null>;
}

/**
 * O extrator enquanto não há biblioteca escolhida.
 *
 * Não lança: a portaria precisa subir e atender pela carteirinha mesmo sem
 * rosto. `disponivel` é o que a tela lê para não prometer o que não tem.
 */
export const EXTRATOR_AUSENTE: ExtratorDeRosto & { disponivel: false } = {
  nome: "nenhum",
  disponivel: false,
  preparar: async () => undefined,
  extrair: async () => null,
};

/**
 * O extrator em uso. Trocar isto é o único ponto a mexer quando a biblioteca
 * for escolhida.
 */
export const extratorDeRosto: ExtratorDeRosto & { disponivel?: boolean } = EXTRATOR_AUSENTE;

export const rostoDisponivel = (): boolean => extratorDeRosto.disponivel !== false;
