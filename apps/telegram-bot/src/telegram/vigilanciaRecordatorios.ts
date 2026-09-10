import type { Bot } from "grammy";
import { logger } from "../logger.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

type DepsVigilancia = Pick<FlujoDeps, "cfg" | "cApi">;

/**
 * Recordatorio de cita 24h antes. Cada `intervaloMs` le pide a core-api que
 * reclame (inserte de forma atómica) las citas confirmadas que caen en esa
 * ventana y todavía no tienen recordatorio. Por cada una: si la paciente
 * tiene el chat de Telegram vinculado, el bot le escribe directo y reporta
 * el resultado; si no, le pide a core-api que encole el correo (mismo
 * mecanismo que el correo de "cita confirmada").
 *
 * El cuerpo del mensaje viene ya redactado en `rec.mensajeTelegram` (lo
 * arma core-api, ver dominio/notificaciones.ts): acá solo se reenvía, así
 * el texto es el mismo lo mande el bot o n8n.
 */
export function iniciarVigilanciaRecordatorios(
  bot: Bot<MiContexto>,
  deps: DepsVigilancia,
  opts: { intervaloMs?: number } = {},
): () => void {
  const intervaloMs = opts.intervaloMs ?? 15 * 60_000;
  let corriendo = false;

  async function revisar(): Promise<void> {
    if (corriendo) return;
    corriendo = true;
    try {
      const r = await deps.cApi.recordatoriosReclamar(deps.cfg);
      if (!r.ok) return;

      for (const rec of r.datos.recordatorios) {
        if (rec.chatId) {
          try {
            await bot.api.sendMessage(Number(rec.chatId), rec.mensajeTelegram);
            await deps.cApi.recordatorioMarcarEnviado(deps.cfg, {
              reservaId: rec.reservaId,
              pacienteId: rec.pacienteId,
              ok: true,
            });
          } catch (err) {
            const mensaje = err instanceof Error ? err.message : "desconocido";
            logger.warn({ reservaId: rec.reservaId, err: mensaje }, "no pude mandar el recordatorio por Telegram");
            await deps.cApi.recordatorioMarcarEnviado(deps.cfg, {
              reservaId: rec.reservaId,
              pacienteId: rec.pacienteId,
              ok: false,
              error: mensaje,
            });
          }
          continue;
        }

        await deps.cApi.recordatorioEnviarEmail(deps.cfg, { reservaId: rec.reservaId, pacienteId: rec.pacienteId });
      }
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : "desconocido" },
        "vigilancia de recordatorios: vuelta fallida",
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
