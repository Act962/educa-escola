import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Os testes de repository/service rodam contra Postgres real; cada teste
    // vive numa transação revertida, então paralelismo entre arquivos é seguro.
    globalSetup: ["../db/src/vitest-global-setup.ts"],
    hookTimeout: 60_000,
  },
});
