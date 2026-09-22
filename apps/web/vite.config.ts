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
      } catch {
        // Sem a biblioteca o quiosque atende pela carteirinha. Falhar o build
        // por causa do rosto seria derrubar a portaria inteira.
        return;
      }

      const destino = join(import.meta.dirname, "public", "modelos-de-rosto");
      mkdirSync(destino, { recursive: true });
      for (const arquivo of MODELOS_DE_ROSTO) {
        const de = join(origem, arquivo);
        if (existsSync(de)) cpSync(de, join(destino, arquivo));
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
  plugins: [
    pesosDoReconhecimentoFacial(),
    tailwindcss(),
    tanstackStart(),
    nitro({ preset: "node-server" }),
    viteReact(),
  ],
});
