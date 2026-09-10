import type { Bot } from "grammy";
import { logger } from "../logger.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

type DepsVigilancia = Pick<FlujoDeps, "cfg" | "cApi">;

/**
 * Aviso "su cita quedó confirmada" cuando la confirmación se hizo desde el
 * panel web (que no le habla al bot). core-api deja el aviso 'pendiente' en
 * `integracion.notificacion`; cada `intervaloMs` el bot lo barre, le escribe
 * al paciente por su chat y reporta el resultado. La verificación de pago POR
 * Telegram ya avisa directo y marca su fila como enviada, así que acá nunca
 * llega dos veces.
 *
 * El cuerpo viene ya redactado en `c.mensajeTelegram` (lo arma core-api, ver
 * dominio/notificaciones.ts): acá solo se reenvía.
 */
export function iniciarVigilanciaConfirmaciones(
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
      const r = await deps.cApi.confirmacionesTelegramPendientes(deps.cfg);
      if (!r.ok) return;

      for (const c of r.datos.confirmaciones) {
        try {
          await bot.api.sendMessage(Number(c.chatId), c.mensajeTelegram);
          await deps.cApi.marcarConfirmacionTelegram(deps.cfg, {
            reservaId: c.reservaId,
            pacienteId: c.pacienteId,
            ok: true,
          });
        } catch (err) {
          const mensaje = err instanceof Error ? err.message : "desconocido";
          logger.warn({ reservaId: c.reservaId, err: mensaje }, "no pude avisar de la confirmación por Telegram");
          await deps.cApi.marcarConfirmacionTelegram(deps.cfg, {
            reservaId: c.reservaId,
            pacienteId: c.pacienteId,
            ok: false,
            error: mensaje,
          });
        }
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : "desconocido" },
        "vigilancia de confirmaciones: vuelta fallida",
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
