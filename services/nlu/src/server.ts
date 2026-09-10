import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";
import { z } from "zod";
import { loadConfig, type Config } from "./config.js";
import { opcionesLog } from "./logger.js";
import { interpretar } from "./interpret.js";
import { ollamaSalud } from "./ollama.js";
import { mensajeParaLog } from "./redact.js";

const CuerpoInterpretar = z
  .object({
    mensaje: z.string(),
    hoy: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  })
  .strict();

/** Comparación de tiempo constante entre el header y el secreto esperado. */
function claveValida(recibida: string | undefined, esperada: string): boolean {
  if (typeof recibida !== "string" || recibida.length === 0) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function construirServidor(cfg: Config = loadConfig()): FastifyInstance {
  const app: FastifyInstance = Fastify({
    logger: opcionesLog(),
    bodyLimit: cfg.NLU_MAX_BODY_BYTES,
    trustProxy: false,
  });

  app.addHook("onRequest", async (req, reply) => {
    if (req.url === "/health" || req.url === "/") return;
    if (!cfg.INTERNAL_API_KEY) return; // solo permitido fuera de producción
    const header = req.headers["x-internal-key"];
    const valor = Array.isArray(header) ? header[0] : header;
    if (!claveValida(valor, cfg.INTERNAL_API_KEY)) {
      await reply.code(401).send({ error: "no_autorizado" });
    }
  });

  void app.register(rateLimit, {
    max: cfg.NLU_RATE_LIMIT_MAX,
    timeWindow: cfg.NLU_RATE_LIMIT_WINDOW,
  });

  app.get("/health", async () => {
    const ollama = await ollamaSalud();
    return { servicio: "nlu", ok: true, ollama };
  });

  app.post("/interpretar", async (req, reply) => {
    const cuerpo = CuerpoInterpretar.safeParse(req.body);
    if (!cuerpo.success) {
      return reply.code(422).send({ error: "cuerpo_invalido" });
    }

    const r = await interpretar(cuerpo.data.mensaje, cuerpo.data.hoy !== undefined ? { hoy: cuerpo.data.hoy } : {});

    req.log.info(
      {
        intencion: r.intencion.intencion,
        confianza: r.intencion.confianza,
        uso_fallback: r.usoFallback,
        motivo_fallback: r.motivoFallback,
        modelo: r.modelo,
        latencia_ms: r.latenciaMs,
        entrada: mensajeParaLog(cuerpo.data.mensaje),
      },
      "interpretacion",
    );

    // La respuesta es el objeto del contrato + metadatos de operación.
    return {
      ...r.intencion,
      _meta: {
        uso_fallback: r.usoFallback,
        motivo_fallback: r.motivoFallback,
        modelo: r.modelo,
        latencia_ms: r.latenciaMs,
        recorte_entrada: r.recorteEntrada,
      },
    };
  });

  app.setErrorHandler((err: FastifyError, req, reply) => {
    req.log.error({ err: err.message, code: err.code }, "error no controlado");
    const status =
      typeof err.statusCode === "number" && err.statusCode >= 400 ? err.statusCode : 500;
    void reply.code(status).send({ error: status === 500 ? "error_interno" : "solicitud_invalida" });
  });

  app.setNotFoundHandler((_req, reply) => {
    void reply.code(404).send({ error: "no_encontrado" });
  });

  return app;
}
