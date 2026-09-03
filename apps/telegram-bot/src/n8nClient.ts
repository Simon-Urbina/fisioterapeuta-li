import { z } from "zod";
import type { Config } from "./config.js";

/**
 * Cliente del webhook de n8n que recibe una intención ya confirmada y la
 * reenvía a `core-api` (`POST /comandos`). El bot NUNCA le habla a core-api
 * directamente — n8n orquesta, core-api decide y ejecuta (README raíz,
 * sección 2). El webhook responde con el mismo cuerpo que core-api le dio.
 *
 * No confía en la respuesta: la valida contra una forma mínima antes de
 * usarla, igual que `nluClient.ts`.
 */

const RespuestaComando = z
  .object({
    ok: z.boolean(),
    datos: z.unknown().optional(),
    error: z.string().optional(),
    mensaje: z.string().optional(),
  })
  .passthrough();

export type ResultadoEjecucion =
  | { tipo: "ok"; datos: unknown }
  // n8n/core-api respondieron con una razón de negocio (datos incompletos,
  // no encontrado, cliente ambiguo, regla violada...). `mensaje` ya viene
  // en español, listo para mostrar.
  | { tipo: "error_negocio"; codigo: string; mensaje: string; datos?: unknown }
  // No se pudo completar el viaje de ida y vuelta con n8n.
  | { tipo: "error_transporte"; motivo: "timeout" | "red" | "respuesta_invalida" };

export async function ejecutarComando(
  cfg: Config,
  intencion: string,
  entidades: Record<string, string | number>,
  creadoPor: string,
): Promise<ResultadoEjecucion> {
  const url = new URL(cfg.N8N_COMANDOS_PATH, cfg.N8N_URL);
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cfg.INTERNAL_API_KEY !== undefined) headers["x-internal-key"] = cfg.INTERNAL_API_KEY;

  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ intencion, entidades, creado_por: creadoPor }),
      signal: AbortSignal.timeout(cfg.BOT_N8N_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      return { tipo: "error_transporte", motivo: "timeout" };
    }
    return { tipo: "error_transporte", motivo: "red" };
  }

  const cuerpo: unknown = await resp.json().catch(() => null);
  const parsed = RespuestaComando.safeParse(cuerpo);
  if (!parsed.success) return { tipo: "error_transporte", motivo: "respuesta_invalida" };

  if (parsed.data.ok) {
    return { tipo: "ok", datos: parsed.data.datos ?? null };
  }
  return {
    tipo: "error_negocio",
    codigo: parsed.data.error ?? "error_desconocido",
    mensaje: parsed.data.mensaje ?? "No se pudo completar la acción.",
    datos: parsed.data.datos,
  };
}
