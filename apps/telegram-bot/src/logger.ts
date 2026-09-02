import { pino, type LoggerOptions } from "pino";
import { loadConfig } from "./config.js";

const cfg = loadConfig();

const base: LoggerOptions = {
  level: cfg.LOG_LEVEL,
  redact: {
    paths: [
      "token",
      "*.token",
      "texto",
      "*.texto",
      "mensaje",
      "*.mensaje",
      "update.message.text",
      "update.message.from",
    ],
    censor: "«oculto»",
  },
};
if (!cfg.isProd) {
  base.transport = {
    target: "pino-pretty",
    options: { translateTime: "HH:MM:ss", ignore: "pid,hostname" },
  };
}

export const logger = pino(base);
