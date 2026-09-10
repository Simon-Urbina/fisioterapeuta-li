import type { Bot } from "grammy";
import { esAutorizado, nivelDeAcceso } from "../auth.js";
import {
  AYUDA,
  AYUDA_ADMIN,
  CANCELADO,
  INFO_ACCIONES,
  INFO_CITA,
  INFO_HORARIOS,
  INFO_PAGO,
  INFO_QUIENES,
  MENU_ACCIONES,
  MENU_ACCIONES_ADMIN,
  PONG,
  inicio,
  miId,
} from "../commands.js";
import { estadoInicial } from "../conversation.js";
import { formatearResultado } from "../resultados.js";
import { InlineKeyboard } from "grammy";
import type { FlujoDeps, MiContexto } from "./contexto.js";
import { citasCancelablesDeResultado, estaVinculado } from "./parsers.js";
import { tecladoDe } from "./teclados.js";
import { iniciarReservaGuiada } from "./flujoReserva.js";
import { iniciarCancelarGuiado } from "./flujoCancelar.js";
import { pedirIdentificacion } from "./flujoIdentidad.js";

const INFO_TEXTOS: Record<string, string> = {
  "info:horarios": INFO_HORARIOS,
  "info:quienes": INFO_QUIENES,
  "info:pago": INFO_PAGO,
  "info:cita": INFO_CITA,
};

/**
 * Menú principal: comandos nativos de Telegram y los botones equivalentes de
 * `/start` (`menu:*`) y del submenú de información (`info:*`). Las tres acciones
 * de consulta (`verCatalogo` / `verMisCitas` / `verInfo`) las comparten comando
 * y botón, por eso viven como closures aquí.
 */
/**
 * El menú de `/start`, extraído para poder mostrarlo también justo después
 * de que un paciente nuevo acepta el tratamiento de datos (ver
 * flujoConsentimiento.ts) sin duplicar la lógica de qué botones le
 * corresponden.
 */
/**
 * "Mis citas" del paciente. Si el chat todavía no está vinculado a un paciente
 * (`vinculado: false` — típico de quien reservó por la web), arranca la
 * identificación por cédula en vez de decir "no tiene citas". Reutilizable por
 * el comando `/miscitas`, el botón del menú y el retomar de `flujoIdentidad`.
 */
export async function mostrarMisCitas(ctx: MiContexto, deps: FlujoDeps): Promise<void> {
  const resultado = await deps.n8n(deps.cfg, "consultar_agenda", {}, String(ctx.chat?.id ?? ""));
  if (!estaVinculado(resultado)) {
    await pedirIdentificacion(ctx, "agenda");
    return;
  }
  const cancelables = citasCancelablesDeResultado(resultado);
  await ctx.reply(formatearResultado("consultar_agenda", resultado), {
    ...(cancelables.length > 0
      ? { reply_markup: new InlineKeyboard().text("✕ Cancelar una cita", "cxl:start") }
      : {}),
  });
}

export async function enviarMenuPrincipal(ctx: MiContexto, cfg: FlujoDeps["cfg"]): Promise<void> {
  ctx.session = estadoInicial();
  const nivel = nivelDeAcceso(cfg, ctx.chat?.id);
  const teclado =
    nivel === "autorizado"
      ? (() => {
          const k = new InlineKeyboard();
          for (const a of MENU_ACCIONES_ADMIN) k.text(a.texto, a.data).row();
          return k;
        })()
      : tecladoDe(MENU_ACCIONES);
  await ctx.reply(inicio(nivel), { reply_markup: teclado });
}

export function registrarMenu(bot: Bot<MiContexto>, deps: FlujoDeps): void {
  const { cfg, n8n } = deps;

  const verCatalogo = async (ctx: MiContexto): Promise<void> => {
    await ctx.reply(
      formatearResultado("consultar_catalogo", await n8n(cfg, "consultar_catalogo", {}, String(ctx.chat?.id ?? ""))),
    );
  };
  const verMisCitas = (ctx: MiContexto): Promise<void> => mostrarMisCitas(ctx, deps);
  const verInfo = async (ctx: MiContexto): Promise<void> => {
    await ctx.reply("¿Sobre qué desea información?", { reply_markup: tecladoDe(INFO_ACCIONES) });
  };

  const verMiCodigoReferido = async (ctx: MiContexto): Promise<void> => {
    const r = await deps.cApi.miCodigoReferido(cfg, ctx.chat?.id ?? 0);
    if (!r.ok) {
      await ctx.reply("No pude consultar su código en este momento. Intente de nuevo en un rato.");
      return;
    }
    const d = r.datos;
    if (!d.vinculado || !d.codigo) {
      await ctx.reply(
        "Todavía no tiene un código de referido. Se le asigna cuando reserve su primera cita (la valoración inicial).",
      );
      return;
    }
    const req = d.requeridos ?? 5;
    const pct = d.porcentaje ?? 10;
    const pctTxt = Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
    const avance = d.yaGanado
      ? `Ya llegó a los ${String(req)} referidos: tiene su ${pctTxt}% de descuento para su próxima cita. 🎉`
      : `Va ${String(d.efectivos ?? 0)} de ${String(req)}.`;
    await ctx.reply(
      [
        "Su código de referido (tóquelo para copiarlo):",
        "",
        "`" + d.codigo + "`",
        "",
        `Compártalo con quien quiera. Cuando ${String(req)} personas que usted refiera agenden y asistan a su cita, gana un ${pctTxt}% de descuento en su próxima cita.`,
        "",
        avance,
      ].join("\n"),
      { parse_mode: "Markdown" },
    );
  };

  bot.command("start", async (ctx) => {
    await enviarMenuPrincipal(ctx, cfg);
  });
  bot.command(["agendar", "cita", "citas"], async (ctx) => {
    await iniciarReservaGuiada(ctx, deps, {});
  });
  bot.command(["miscitas", "mis_citas"], verMisCitas);
  bot.command(["cancelarcita", "cancelar_cita"], async (ctx) => {
    await iniciarCancelarGuiado(ctx, deps);
  });
  bot.command(["servicios", "precios"], verCatalogo);
  bot.command(["referido", "micodigo", "codigo"], verMiCodigoReferido);
  bot.command("info", verInfo);

  // También en lenguaje natural ("¿cuál es mi código de referido?"), sin
  // depender del NLU. Un chat administrativo no es paciente: pasa de largo.
  bot.hears(/\bc[oó]digo\b[^.\n]{0,24}\breferid/i, async (ctx, next) => {
    if (esAutorizado(cfg, ctx.chat.id)) {
      await next();
      return;
    }
    await verMiCodigoReferido(ctx);
  });
  bot.command(["help", "ayuda"], async (ctx) => {
    const nivel = nivelDeAcceso(cfg, ctx.chat.id);
    await ctx.reply(nivel === "autorizado" ? AYUDA_ADMIN : AYUDA);
  });
  bot.command("cancelar", async (ctx) => {
    ctx.session = estadoInicial();
    await ctx.reply(CANCELADO);
  });
  bot.command("id", async (ctx) => {
    await ctx.reply(miId(ctx.chat.id));
  });
  bot.command("ping", async (ctx) => {
    await ctx.reply(PONG);
  });

  bot.callbackQuery("menu:catalogo", async (ctx) => {
    await ctx.answerCallbackQuery();
    await verCatalogo(ctx);
  });
  bot.callbackQuery("menu:agenda", async (ctx) => {
    await ctx.answerCallbackQuery();
    await verMisCitas(ctx);
  });
  bot.callbackQuery("menu:agendar", async (ctx) => {
    await ctx.answerCallbackQuery();
    await iniciarReservaGuiada(ctx, deps, {});
  });
  bot.callbackQuery("menu:referido", async (ctx) => {
    await ctx.answerCallbackQuery();
    await verMiCodigoReferido(ctx);
  });
  bot.callbackQuery("menu:info", async (ctx) => {
    await ctx.answerCallbackQuery();
    await verInfo(ctx);
  });
  bot.callbackQuery(/^info:(horarios|quienes|pago|cita)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const texto = INFO_TEXTOS[ctx.callbackQuery.data];
    if (texto !== undefined) await ctx.reply(texto);
  });
}
