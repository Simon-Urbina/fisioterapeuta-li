import { Bot, type Context, session, type SessionFlavor } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import type { Config } from "./config.js";
import { logger } from "./logger.js";
import { esAutorizado, nivelDeAcceso } from "./auth.js";
import { AYUDA, PONG, inicio, miId, noAutorizado } from "./commands.js";
import { RateLimiter } from "./ratelimit.js";
import {
  estadoInicial,
  procesarTexto,
  resolverConfirmacion,
  type Accion,
  type EstadoConversacion,
} from "./conversation.js";
import { interpretar } from "./nluClient.js";
import type { ResultadoNlu } from "./nluClient.js";

type MiContexto = Context & SessionFlavor<EstadoConversacion>;

export interface DepsBot {
  /** Evita la llamada a getMe (útil en pruebas). */
  botInfo?: UserFromGetMe;
  /** Cliente NLU inyectable. */
  nlu?: (cfg: Config, mensaje: string) => Promise<ResultadoNlu>;
  /** Reloj inyectable para el rate limiter. */
  ahora?: () => number;
}

function textoDeAccion(accion: Accion): string {
  return accion.texto;
}

function interpretarSiNo(texto: string): "si" | "no" | null {
  const t = texto.trim().toLowerCase();
  if (["si", "sí", "s", "yes", "ok", "dale", "confirmo"].includes(t)) return "si";
  if (["no", "n", "cancelar", "cancela"].includes(t)) return "no";
  return null;
}

export function crearBot(cfg: Config, deps: DepsBot = {}): Bot<MiContexto> {
  const bot = new Bot<MiContexto>(
    cfg.token,
    deps.botInfo !== undefined ? { botInfo: deps.botInfo } : {},
  );
  const nlu = deps.nlu ?? interpretar;
  const limiter = new RateLimiter(cfg.BOT_RATE_LIMIT_POR_MINUTO, deps.ahora);

  bot.use(session<EstadoConversacion, MiContexto>({ initial: estadoInicial }));

  // Traza mínima de cada update entrante (sin el contenido del mensaje).
  bot.use(async (ctx, next) => {
    const texto = ctx.message?.text;
    logger.info(
      {
        chatId: ctx.chat?.id,
        tipo: ctx.message !== undefined ? "message" : ctx.callbackQuery !== undefined ? "callback" : "otro",
        esComando: texto?.startsWith("/") ?? false,
        largo: texto?.length ?? 0,
      },
      "update recibido",
    );
    await next();
  });

  // Rate limit por chat.
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (chatId !== undefined && !limiter.permitir(chatId)) {
      logger.warn({ chatId }, "rate limit alcanzado");
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    await ctx.reply(inicio(nivelDeAcceso(cfg, ctx.chat.id)));
  });
  bot.command("help", async (ctx) => {
    await ctx.reply(AYUDA);
  });
  bot.command("id", async (ctx) => {
    await ctx.reply(miId(ctx.chat.id));
  });
  bot.command("ping", async (ctx) => {
    await ctx.reply(PONG);
  });

  bot.on("message:text", async (ctx) => {
    const chatId = ctx.chat.id;

    if (!esAutorizado(cfg, chatId)) {
      await ctx.reply(noAutorizado());
      return;
    }

    // ¿Estamos esperando un sí/no de confirmación?
    if (ctx.session.esperandoConfirmacion) {
      const sn = interpretarSiNo(ctx.message.text);
      if (sn === null) {
        await ctx.reply('Respondé "sí" o "no" para confirmar o cancelar.');
        return;
      }
      const r = resolverConfirmacion(ctx.session, sn);
      ctx.session = r.estado;
      await ctx.reply(textoDeAccion(r.accion));
      return;
    }

    const r = await procesarTexto(cfg, ctx.session, ctx.message.text, nlu);
    ctx.session = r.estado;

    if (r.accion.tipo === "ejecutar") {
      logger.info(
        { chatId, intencion: r.accion.intencion, entidades: Object.keys(r.accion.entidades) },
        "accion a ejecutar",
      );
    }
    await ctx.reply(textoDeAccion(r.accion));
  });

  // Cualquier otro tipo de mensaje (fotos, stickers, etc.): respuesta breve.
  bot.on("message", async (ctx) => {
    if (!esAutorizado(cfg, ctx.chat.id)) return;
    await ctx.reply("Por ahora solo entiendo texto. Usá /help.");
  });

  bot.catch((err) => {
    logger.error({ err: err.error instanceof Error ? err.error.message : "desconocido" }, "error en bot");
  });

  return bot;
}
