import type { Bot } from "grammy";
import { logger } from "../logger.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

type DepsVigilancia = Pick<FlujoDeps, "cfg" | "cApi">;

/**
 * Avisos "simples" por Telegram: core-api deja el cuerpo ya redactado en
 * `integracion.notificacion` (hoy: la felicitación al paciente que llegó a
 * los 5 referidos y ganó su descuento). Cada `intervaloMs` el bot los barre,
 * los reenvía tal cual al chat y reporta el resultado.
 */
export function iniciarVigilanciaAvisos(
  bot: Bot<MiContexto>,
  deps: DepsVigilancia,
  opts: { intervaloMs?: number } = {},
): () => void {
  const intervaloMs = opts.intervaloMs ?? 20_000;
  let corriendo = false;

  async function revisar(): Promise<void> {
    if (corriendo) return;
    corriendo = true;
    try {
      const r = await deps.cApi.avisosTelegramPendientes(deps.cfg);
      if (!r.ok) return;

      for (const a of r.datos.avisos) {
        try {
          await bot.api.sendMessage(Number(a.chatId), a.texto);
          await deps.cApi.marcarAvisoTelegram(deps.cfg, { id: a.id, ok: true });
        } catch (err) {
          const mensaje = err instanceof Error ? err.message : "desconocido";
          logger.warn({ avisoId: a.id, err: mensaje }, "no pude mandar un aviso por Telegram");
          await deps.cApi.marcarAvisoTelegram(deps.cfg, { id: a.id, ok: false, error: mensaje });
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : "desconocido" },
        "vigilancia de avisos: vuelta fallida",
      );
    } finally {
      corriendo = false;
    }
  }

  const timer = setInterval(() => void revisar(), intervaloMs);
  timer.unref();
  void revisar();

  return () => {
    clearInterval(timer);
  };
}
