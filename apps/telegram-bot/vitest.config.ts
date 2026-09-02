import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
    env: {
      NODE_ENV: "test",
      TELEGRAM_ENTORNO: "dev",
      TELEGRAM_BOT_TOKEN_DEV: `1234567890:${"A".repeat(35)}`,
      TELEGRAM_ALLOWED_CHAT_IDS: "111,222",
      NLU_URL: "http://127.0.0.1:59998",
      INTERNAL_API_KEY: "clave-de-pruebas-0123456789",
      TIMEZONE: "America/Bogota",
      LOG_LEVEL: "silent",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts"],
    },
  },
});
