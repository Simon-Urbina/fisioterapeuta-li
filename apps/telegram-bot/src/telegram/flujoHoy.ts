import type { Bot } from "grammy";
import { esAutorizado } from "../auth.js";
import { etiquetaEstado, horaCorta } from "../resultados.js";
import type { CitaHoy } from "../coreApiClient.js";
import type { FlujoDeps, MiContexto } from "./contexto.js";

/**
 * `/hoy`: agenda completa del día para el personal del consultorio. Comando
 * directo (no pasa por NLU) porque es algo que Lina va a usar todos los días
 * y no debería depender de que el modelo interprete bien la pregunta.
 */

function lineaCita(c: CitaHoy): string {
  return `${horaCorta(c.iniciaEn)} · ${c.paciente ?? "Sin paciente"} · ${c.servicio ?? "?"} · ${c.sede} · ${etiquetaEstado(c.estado)}`;
}

/** Estados que NO sirven para planear el día: canceladas, expiradas, rechazadas. */
const ESTADOS_OCULTOS_HOY = new Set(["cancelada_a_tiempo", "cancelada_tarde", "expirada", "rechazada"]);

/** Reutilizable por el comando `/hoy` y el botón "📅 Agenda de hoy" del menú de personal. */
export async function mostrarAgendaHoy(ctx: MiContexto, deps: FlujoDeps): Promise<void> {
  const r = await deps.cApi.citasHoy(deps.cfg);
  if (!r.ok) {
    await ctx.reply("No pude consultar la agenda de hoy en este momento.");
    return;
  }
  // Las canceladas/expiradas no ayudan a planear el día: fuera de la lista.
  const citas = r.datos.citas
    .filter((c) => !ESTADOS_OCULTOS_HOY.has(c.estado))
    .sort((a, b) => a.iniciaEn.localeCompare(b.iniciaEn));
  if (citas.length === 0) {
    await ctx.reply("No hay citas activas para hoy.");
    return;
  }
  const fecha = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  const texto = [
    `📅 Agenda de hoy — ${fecha}`,
    "",
    ...citas.map(lineaCita),
    "",
    `${citas.length} ${citas.length === 1 ? "cita" : "citas"} en total.`,
  ].join("\n");
  await ctx.reply(texto);
}

export function registrarFlujoHoy(bot: Bot<MiContexto>, deps: FlujoDeps): void {
  bot.command("hoy", async (ctx) => {
    if (!esAutorizado(deps.cfg, ctx.chat.id)) {
      await ctx.reply("Este comando es solo para el personal del consultorio.");
      return;
    }
    await mostrarAgendaHoy(ctx, deps);
  });

  bot.callbackQuery("admin:hoy", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!esAutorizado(deps.cfg, ctx.chat?.id ?? 0)) return;
    await mostrarAgendaHoy(ctx, deps);
  });
}
