import { pino, type LoggerOptions } from "pino";
import { loadConfig } from "./config.js";

const cfg = loadConfig();

/** Opciones de pino compartidas por el logger propio y por el de Fastify. */
export function opcionesLog(): LoggerOptions {
  const base: LoggerOptions = {
    level: cfg.LOG_LEVEL,
    // Nunca serializar headers de auth, la cadena de conexión ni datos de
    // pacientes por accidente.
    redact: {
      paths: [
        "req.headers.authorization",
        'req.headers["x-internal-key"]',
        'headers["x-internal-key"]',
        "databaseUrl",
        "entidades",
        "*.entidades",
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
  return base;
}

export const logger = pino(opcionesLog());
