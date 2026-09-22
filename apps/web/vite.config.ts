import { cpSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";

/**
 * Só o que a portaria usa: detectar o rosto, achar os pontos e extrair o
 * descritor. O pacote traz também idade, expressão e um detector grande — nada
 * disso serve para dizer quem é a pessoa, e cada megabyte a mais é tempo de
 * abertura no tablet do portão.
 */
const MODELOS_DE_ROSTO = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model.bin",
  "face_landmark_68_tiny_model-weights_manifest.json",
  "face_landmark_68_tiny_model.bin",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model.bin",
];

/**
 * Os modelos da vivacidade: detectar o rosto, e dizer se é gente de verdade.
 *
 * `blazeface` acha o rosto e `facemesh` produz o recorte alinhado que o
 * antispoof consome — sem a malha, a avaliação simplesmente não retorna, e um
 * `await` pendurado congelaria a leitura do portão. Íris, emoção, corpo e mão
 * ficam de fora: nada disso responde "é uma foto na tela?".
 */
const MODELOS_DE_VIVACIDADE = [
  "blazeface.json",
  "blazeface.bin",
  "facemesh.json",
  "facemesh.bin",
  "antispoof.json",
  "antispoof.bin",
  "liveness.json",
  "liveness.bin",
];

/**
 * Copia os pesos do modelo de `node_modules` para `public/`.
 *
 * Plugin, e não 6 MB de binário commitado: o peso vem com a versão fixada no
 * catálogo, então o arquivo servido é sempre o da versão instalada, e trocar
 * de biblioteca não deixa peso órfão no histórico do git.
 *
 * Também não é CDN de propósito — o app precisa funcionar sem rede externa, e
 * portaria de escola é exatamente onde a rede falta.
 */
function pesosDoReconhecimentoFacial(): Plugin {
  return {
    name: "orbita-pesos-de-rosto",
    enforce: "pre",
    buildStart() {
      const require = createRequire(import.meta.url);
      let origem: string;
      try {
        origem = join(dirname(require.resolve("@vladmandic/face-api/package.json")), "model");
      } catch (error) {
        // Sem a biblioteca o quiosque atende pela carteirinha. Falhar o build
        // por causa do rosto seria derrubar a portaria inteira — mas sumir
        // sem dizer nada foi o que já escondeu um defeito aqui.
        this.warn(`Reconhecimento sem pesos: ${String(error)}. A portaria usa só carteirinha.`);
        return;
      }

      const destino = join(import.meta.dirname, "public", "modelos-de-rosto");
      mkdirSync(destino, { recursive: true });
      for (const arquivo of MODELOS_DE_ROSTO) {
        const de = join(origem, arquivo);
        if (existsSync(de)) cpSync(de, join(destino, arquivo));
      }

      let vivacidade: string;
      try {
        /*
         * Pelo arquivo de entrada, e não pelo `package.json`.
         *
         * O `exports` do `human` não expõe o `package.json`, então resolvê-lo
         * lança — e a primeira versão engolia isso em silêncio e seguia sem
         * copiar peso nenhum. O resultado seria a vivacidade desligada sem
         * ninguém saber, que é o pior desfecho possível para uma camada de
         * segurança. O aviso abaixo existe por isso.
         */
        const entrada = require.resolve("@vladmandic/human");
        vivacidade = join(dirname(dirname(entrada)), "models");
      } catch (error) {
        // Sem a vivacidade a portaria recusa o rosto e pede a carteirinha —
        // nunca o contrário. Falhar o build derrubaria a portaria inteira por
        // causa de uma camada ausente, mas o silêncio é pior: ela ficaria
        // desligada sem aviso.
        this.warn(`Vivacidade sem pesos: ${String(error)}. A portaria vai recusar rosto.`);
        return;
      }

      const destinoVivo = join(import.meta.dirname, "public", "modelos-de-vivacidade");
      mkdirSync(destinoVivo, { recursive: true });
      for (const arquivo of MODELOS_DE_VIVACIDADE) {
        const de = join(vivacidade, arquivo);
        if (existsSync(de)) cpSync(de, join(destinoVivo, arquivo));
      }
    },
  };
}

export default defineConfig({
  server: {
    port: 3001,
  },
  resolve: {
    tsconfigPaths: true,
  },
  /**
   * O detector de vivacidade fica fora do bundle do servidor.
   *
   * O `exports` do `human` resolve a condição `node` antes da de navegador, e
   * a build de Node importa `@tensorflow/tfjs-node` — binário nativo que não
   * existe aqui. No cliente o resolvedor já pega a build ESM certa, pelo campo
   * `browser`; o servidor só precisa não tentar empacotá-la.
   *
   * É seguro porque o import é dinâmico e só acontece dentro de um efeito: o
   * servidor nunca executa esta linha, ele apenas não deve tropeçar nela ao
   * montar o pacote.
   */
  ssr: {
    external: ["@vladmandic/human"],
  },
  build: {
    rolldownOptions: {
      /*
       * O `human` tem uma build de Node que importa este binário nativo, e o
       * `exports` do pacote faz o empacotador do servidor cair nela. Declarar
       * como externo é dizer "não tente resolver": no cliente o resolvedor já
       * pega a build de navegador pelo campo `browser`, e no servidor a linha
       * nunca chega a executar — o import é dinâmico, dentro de um efeito.
       */
      external: ["@tensorflow/tfjs-node"],
    },
  },
  plugins: [
    pesosDoReconhecimentoFacial(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
