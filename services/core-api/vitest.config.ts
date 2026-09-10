import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    env: {
      NODE_ENV: "test",
      INTERNAL_API_KEY: "clave-de-pruebas-0123456789",
      DATABASE_URL: "postgresql://127.0.0.1:5432/fisio_li_test",
      TIMEZONE: "America/Bogota",
      LOG_LEVEL: "silent",
      CORE_API_RATE_LIMIT_MAX: "1000",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/db.ts"],
    },
  },
});
