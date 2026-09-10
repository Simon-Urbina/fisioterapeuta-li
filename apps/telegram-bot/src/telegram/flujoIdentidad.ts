import { estadoInicial } from "../conversation.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

/**
 * Identificación de un chat que no llegó por el bot: un paciente que reservó
 * por el sitio web y ahora escribe por Telegram para ver/cancelar/reprogramar
 * sus citas. El chat todavía no está en `personas.vinculo_telegram`, así que
 * `consultar_agenda` le devuelve `vinculado: false`. Se le piden cédula y los
 * últimos 4 dígitos del teléfono registrado; core-api valida y crea el vínculo
 * (`POST /vinculo-telegram`). Al terminar, el dispatcher retoma lo que el
 * paciente había pedido (`volverA`).
 *
 * No tiene callbacks: todo el flujo es texto, y lo enruta el dispatcher
 * mientras `ctx.session.identidadFlujo` esté activo.
 */

export type VolverA = "agenda" | "cancelar" | "reserva";

const TEL_CONSULTORIO = "311 398 1422";

const PEDIR_DOCUMENTO =
  "Para ver y gestionar sus citas primero necesito identificarlo.\n\n" +
  "Escríbame su número de documento (cédula), solo los números.";

/** Arranca el flujo: dispara la petición de la cédula y recuerda a dónde volver. */
export async function pedirIdentificacion(ctx: MiContexto, volverA: VolverA): Promise<void> {
  ctx.session = { ...estadoInicial(), identidadFlujo: { paso: "documento", volverA, intentos: 0 } };
  await ctx.reply(PEDIR_DOCUMENTO);
}

/**
 * Procesa un mensaje de texto mientras el flujo de identificación está activo.
 * Devuelve `{ reanudar }` con la acción original a retomar cuando la
 * verificación fue exitosa; `null` en cualquier otro caso (el propio flujo ya
 * respondió lo que corresponde).
 */
export async function identidadManejaTexto(
  ctx: MiContexto,
  deps: FlujoDeps,
  texto: string,
): Promise<{ reanudar: VolverA | null }> {
  const f = ctx.session.identidadFlujo;
  if (!f) return { reanudar: null };

  const soloNumeros = texto.replace(/\D/g, "");

  if (f.paso === "documento") {
    if (soloNumeros.length < 4) {
      await ctx.reply("Ese documento parece incompleto. Escríbame solo los números de su cédula.");
      return { reanudar: null };
    }
    ctx.session = { ...ctx.session, identidadFlujo: { ...f, paso: "telefono", documento: soloNumeros } };
    await ctx.reply("Gracias. Ahora, los últimos 4 dígitos del celular que tiene registrado con nosotros.");
    return { reanudar: null };
  }

  // paso "telefono"
  if (soloNumeros.length !== 4) {
    await ctx.reply("Necesito exactamente los últimos 4 dígitos de su celular. Por ejemplo: 8891");
    return { reanudar: null };
  }

  const r = await deps.cApi.vincularPorDocumento(deps.cfg, {
    chatId: ctx.chat?.id ?? 0,
    documento: f.documento ?? "",
    ultimos4: soloNumeros,
  });
  if (!r.ok) {
    ctx.session = estadoInicial();
    await ctx.reply("No pude verificar sus datos en este momento. Intente de nuevo en un rato.");
    return { reanudar: null };
  }

  const d = r.datos;
  if (d.tipo === "vinculado") {
    const { volverA } = f;
    ctx.session = estadoInicial();
    await ctx.reply(`¡Listo, ${d.paciente.nombreEnmascarado}! Ya lo tengo identificado. ✅`);
    return { reanudar: volverA };
  }

  if (d.tipo === "no_encontrado") {
    ctx.session = estadoInicial();
    await ctx.reply(
      "No encontré a nadie con esa cédula en nuestros registros.\n\n" +
        `Si es su primera vez, escríbame «quiero una cita» y le agendo su valoración inicial. ` +
        `Si cree que es un error, comuníquese al ${TEL_CONSULTORIO}.`,
    );
    return { reanudar: null };
  }

  if (d.tipo === "ambiguo" || d.tipo === "bloqueado") {
    ctx.session = estadoInicial();
    await ctx.reply(
      `No puedo completar la verificación por este medio. Por favor comuníquese al ${TEL_CONSULTORIO} y con gusto lo ayudamos.`,
    );
    return { reanudar: null };
  }

  // datos_no_coinciden
  const intentos = f.intentos + 1;
  if (intentos >= 2) {
    ctx.session = estadoInicial();
    await ctx.reply(
      `Los datos no coinciden. Por seguridad no puedo continuar por aquí; comuníquese al ${TEL_CONSULTORIO} y lo ayudamos.`,
    );
    return { reanudar: null };
  }
  ctx.session = {
    ...ctx.session,
    identidadFlujo: { paso: "documento", volverA: f.volverA, intentos },
  };
  await ctx.reply(
    "Esos datos no coinciden con nuestros registros. Probemos de nuevo: escríbame su número de documento (cédula).",
  );
  return { reanudar: null };
}
