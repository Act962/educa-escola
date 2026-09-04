import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Cria e migra o banco de teste antes da suíte.
    globalSetup: ["./src/vitest-global-setup.ts"],
    hookTimeout: 60_000,
  },
});
