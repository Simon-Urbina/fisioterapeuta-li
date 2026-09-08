import type { Bot } from "grammy";
import { logger } from "../logger.js";
import { horaCorta } from "../resultados.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

type DepsVigilancia = Pick<FlujoDeps, "cfg" | "cApi">;

/**
 * Indicaciones previas por tipo de servicio (contenido real de Lina, ver
 * services/nlu/conocimiento/primera-cita.md). Duplicado a propósito en varios
 * módulos, igual que otros textos chicos de este proyecto.
 */
function indicacionesPara(servicio: string | null): string {
  const s = (servicio ?? "").toLowerCase();
  if (/punci[oó]n|neural|prp|plasma|suero/.test(s)) {
    return "Venga con ropa holgada y cómoda que dé acceso fácil a la zona a tratar, y le pedimos puntualidad estricta.";
  }
  if (/descarga|modulaci[oó]n/.test(s)) {
    return "Venga con ropa cómoda que permita trabajar la zona a tratar. Si gusta, traiga hidratación y una toalla, y llegue con un poco de anticipación.";
  }
  return "Venga con ropa cómoda o deportiva y calzado adecuado para ejercicio. Si gusta, traiga hidratación y una toalla, y por favor llegue de 5 a 10 minutos antes.";
}

/**
 * Aviso "su cita quedó confirmada" cuando la confirmación se hizo desde el
 * panel web (que no le habla al bot). core-api deja el aviso 'pendiente' en
 * `integracion.notificacion`; cada `intervaloMs` el bot lo barre, le escribe
 * al paciente por su chat y reporta el resultado. La verificación de pago POR
 * Telegram ya avisa directo y marca su fila como enviada, así que acá nunca
 * llega dos veces.
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
        const texto = [
          "¡Su cita quedó confirmada! ✅",
          `${c.servicio ?? "Su cita"} · ${horaCorta(c.iniciaEn)}`,
          c.sede ?? "",
          "",
          indicacionesPara(c.servicio),
          "",
          "¡Le esperamos! 💛",
        ]
          .filter((l) => l.length > 0)
          .join("\n");

        try {
          await bot.api.sendMessage(Number(c.chatId), texto);
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
