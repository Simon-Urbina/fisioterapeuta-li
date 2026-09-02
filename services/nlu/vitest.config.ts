import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    env: {
      NODE_ENV: "test",
      INTERNAL_API_KEY: "clave-de-pruebas-0123456789",
      OLLAMA_HOST: "http://127.0.0.1:59999",
      OLLAMA_MODEL: "modelo-test",
      TIMEZONE: "America/Bogota",
      LOG_LEVEL: "silent",
      NLU_RATE_LIMIT_MAX: "1000",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
