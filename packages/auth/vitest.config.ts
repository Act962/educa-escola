import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // O limite de login é testado contra Postgres de verdade: cria e migra o
    // banco de teste, como no pacote do banco.
    globalSetup: ["../db/src/vitest-global-setup.ts"],
    hookTimeout: 60_000,
  },
});
