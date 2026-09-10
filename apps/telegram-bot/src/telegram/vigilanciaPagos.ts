import type { Bot } from "grammy";
import { logger } from "../logger.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";
import { tarjetaPago } from "./flujoPagos.js";

type DepsVigilancia = Pick<FlujoDeps, "cfg" | "cApi">;

/**
 * Vigilancia de pagos por verificar. El checkout web y las fotos de
 * comprobante del bot dejan un `comercial.pago` `registrado`; cada
 * `intervaloMs` el bot consulta los pendientes y:
 *  - por cada pago NUEVO, le manda a Lina (y staff) la tarjeta de `/pagos`
 *    con `[✓ Verificar]` / `[✗ Rechazar]`, y guarda el id de ese mensaje;
 *  - por cada pago que YA notificó y ahora DESAPARECIÓ de la lista (lo
 *    verificaron/rechazaron desde la web o desde `/pagos`), BORRA la tarjeta
 *    que había mandado — así no queda un botón muerto en el chat.
 *
 * `vistos`/`tarjetas` viven en memoria; un reinicio del bot los pierde y
 * `/pagos` sigue mostrando lo pendiente.
 */
export function iniciarVigilanciaPagos(
  bot: Bot<MiContexto>,
  deps: DepsVigilancia,
  opts: { intervaloMs?: number } = {},
): () => void {
  const intervaloMs = opts.intervaloMs ?? 15_000;
  const staff = [...deps.cfg.allowedChatIds];
  if (staff.length === 0) {
    logger.warn("vigilancia de pagos web deshabilitada: no hay chats de staff configurados");
    return () => undefined;
  }

  const vistos = new Set<number>();
  // pagoId -> mensajes de tarjeta enviados (para borrarlos si el pago se
  // resuelve por otra vía).
  const tarjetas = new Map<number, { chatId: number; messageId: number }[]>();
  let sembrado = false;
  let corriendo = false;

  async function revisar(): Promise<void> {
    if (corriendo) return; // evita solaparse si una vuelta se demora
    corriendo = true;
    try {
      const r = await deps.cApi.pagosPendientes(deps.cfg);
      if (!r.ok) return;

      const pendientesAhora = new Set(r.datos.pagos.map((p) => p.pagoId));

      // Tarjetas de pagos que ya no están pendientes: se desvanecen.
      for (const [pagoId, msgs] of tarjetas) {
        if (pendientesAhora.has(pagoId)) continue;
        for (const m of msgs) {
          await bot.api.deleteMessage(m.chatId, m.messageId).catch(() => undefined);
        }
        tarjetas.delete(pagoId);
        vistos.delete(pagoId);
      }

      if (!sembrado) {
        for (const p of r.datos.pagos) vistos.add(p.pagoId);
        sembrado = true;
        return;
      }

      for (const p of r.datos.pagos) {
        if (vistos.has(p.pagoId)) continue;
        vistos.add(p.pagoId);
        const { caption, teclado, comprobanteRef } = tarjetaPago(p);
        // Con comprobante = lo mandó el paciente por Telegram (una foto);
        // sin comprobante = pago desde el checkout de la web.
        const encabezado = comprobanteRef ? "Nuevo comprobante de pago 📸" : "Nuevo pago desde la web 🌐";
        const texto = `${encabezado}\n${caption}`;
        const enviados: { chatId: number; messageId: number }[] = [];
        for (const chatId of staff) {
          try {
            const msg = comprobanteRef
              ? await bot.api.sendPhoto(chatId, comprobanteRef, { caption: texto, reply_markup: teclado })
              : await bot.api.sendMessage(chatId, texto, { reply_markup: teclado });
            enviados.push({ chatId, messageId: msg.message_id });
          } catch (err) {
            logger.warn(
              { chatId, err: err instanceof Error ? err.message : "desconocido" },
              "no pude avisar del pago a un chat de staff; reintento como texto",
            );
            try {
              const msg = await bot.api.sendMessage(chatId, texto, { reply_markup: teclado });
              enviados.push({ chatId, messageId: msg.message_id });
            } catch {
              /* el chat no está disponible: se ignora, /pagos lo sigue mostrando */
            }
          }
        }
        if (enviados.length > 0) tarjetas.set(p.pagoId, enviados);
      }
    } catch (err) {
      logger.warn({ err: err instanceof Error ? err.message : "desconocido" }, "vigilancia de pagos: vuelta fallida");
    } finally {
      corriendo = false;
    }
  }

  const timer = setInterval(() => void revisar(), intervaloMs);
  timer.unref(); // no debe impedir que el proceso termine
  void revisar(); // siembra inmediata

  return () => {
    clearInterval(timer);
  };
}
