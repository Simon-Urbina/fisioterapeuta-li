import { timingSafeEqual } from "node:crypto";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { opcionesLog } from "./logger.js";
import type { Db } from "./db.js";
import type { Config } from "./config.js";
import type { CalendarClient, TokensIntercambiados } from "./googleClients.js";
import {
  construirOAuth2ClientBase,
  generarUrlAutorizacionPaciente,
  intercambiarCodigo,
  construirCalendarClient,
} from "./googleClients.js";
import { procesarPendientes, type ClientesGoogle } from "./consumer.js";
import * as autorizacion from "./dominio/autorizacionPaciente.js";
import * as citas from "./dominio/citas.js";
import * as recursos from "./dominio/recursos.js";

/** Comparación en tiempo constante del header contra el secreto esperado. */
function claveValida(recibida: string | undefined, esperada: string): boolean {
  if (typeof recibida !== "string" || recibida.length === 0) return false;
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Puente hacia `googleapis` inyectable (mismo criterio que `Db`): las
 * pruebas sustituyen esto por dobles que no llaman a Google de verdad. El
 * tipo del "cliente" queda opaco a propósito — server.ts solo lo pasa de
 * una función a la otra, nunca lo inspecciona.
 */
export interface DepsOAuthPaciente {
  construirCliente: (cfg: Config) => unknown;
  generarUrl: (cliente: unknown, state: string) => string;
  intercambiarCodigo: (cliente: unknown, code: string) => Promise<TokensIntercambiados>;
  construirCalendar: (cliente: unknown) => CalendarClient;
}

export const depsOAuthReales: DepsOAuthPaciente = {
  construirCliente: (cfg) => construirOAuth2ClientBase(cfg),
  generarUrl: (cliente, state) => generarUrlAutorizacionPaciente(cliente as Parameters<typeof generarUrlAutorizacionPaciente>[0], state),
  intercambiarCodigo: (cliente, code) => intercambiarCodigo(cliente as Parameters<typeof intercambiarCodigo>[0], code),
  construirCalendar: (cliente) => construirCalendarClient(cliente as Parameters<typeof construirCalendarClient>[0]),
};

const QueryIniciar = z.object({
  reserva_id: z.coerce.number().int().positive(),
  paciente_id: z.coerce.number().int().positive(),
});

const QueryCallback = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

interface EstadoOAuth {
  reserva_id: number;
  paciente_id: number;
}

function credencialesListas(cfg: Config | undefined): cfg is Config {
  return cfg !== undefined && Boolean(cfg.GOOGLE_CLIENT_ID) && Boolean(cfg.GOOGLE_CLIENT_SECRET);
}

function paginaHtml(mensaje: string): string {
  return `<!doctype html><html lang="es"><meta charset="utf-8"><body style="font-family:sans-serif;max-width:32rem;margin:3rem auto;text-align:center"><p>${mensaje}</p></body></html>`;
}

export function construirServidor(
  db: Db,
  cfg?: Config,
  deps: DepsOAuthPaciente = depsOAuthReales,
  // Clientes de Google ya construidos (Gmail/Calendar/Sheets). Solo se pasan
  // desde index.ts cuando hay credenciales; sin ellos, POST /outbox/procesar
  // responde 503. `server.test.ts` no los pasa.
  clientes?: ClientesGoogle,
): FastifyInstance {
  const app = Fastify({ logger: opcionesLog() });

  // Guard para las rutas internas (/outbox/*, /drive/*): n8n y core-api
  // mandan X-Internal-Key. Los redirects OAuth (navegador) y /health quedan
  // abiertos como estaban.
  app.addHook("onRequest", async (req, reply) => {
    if (!req.url.startsWith("/outbox") && !req.url.startsWith("/drive")) return;
    if (!cfg?.INTERNAL_API_KEY) return; // sin secreto configurado: local, sin guard
    const header = req.headers["x-internal-key"];
    const valor = Array.isArray(header) ? header[0] : header;
    if (!claveValida(valor, cfg.INTERNAL_API_KEY)) {
      await reply.code(401).send({ error: "no_autorizado" });
    }
  });

  app.get("/health", async (_req, reply) => {
    try {
      await db.query("SELECT 1");
      return { servicio: "google-adapter", ok: true, db: { ok: true } };
    } catch (err) {
      app.log.error({ err: err instanceof Error ? err.message : String(err) }, "health: base no responde");
      return reply.code(503).send({ servicio: "google-adapter", ok: false, db: { ok: false } });
    }
  });

  // Un ciclo del consumidor de integracion.outbox, disparado por n8n en un
  // horario (workflow outbox-google). Toma un lote de eventos pendientes,
  // los ejecuta ramificando por `destino` (gmail/calendar/sheets — ver
  // consumer.ts) y los marca. Devuelve el desglose para que n8n lo registre.
  app.post("/outbox/procesar", async (_req, reply) => {
    if (!clientes || !cfg) {
      return reply.code(503).send({ ok: false, error: "no_configurado" });
    }
    try {
      const datos = await procesarPendientes(db, clientes, cfg.OUTBOX_LOTE, cfg.TIMEZONE);
      return { ok: true, datos };
    } catch (err) {
      app.log.error({ err: err instanceof Error ? err.message : String(err) }, "outbox/procesar falló");
      return reply.code(500).send({ ok: false, error: "error_interno" });
    }
  });

  // Búsqueda de archivos en Drive por nombre (intent `buscar_archivo`).
  // core-api la llama por HTTP porque no habla con Google directo. Con
  // `paciente_id` limita la búsqueda a la carpeta de ese paciente. Solo ve
  // lo que creó la app (scope drive.file).
  const BuscarQuery = z.object({
    q: z.string().trim().min(1).max(120),
    paciente_id: z.coerce.number().int().positive().optional(),
  });
  app.get("/drive/buscar", async (req, reply) => {
    if (!clientes?.drive) {
      return reply.code(503).send({ ok: false, error: "no_configurado" });
    }
    const parsed = BuscarQuery.safeParse(req.query);
    if (!parsed.success) return reply.code(422).send({ ok: false, error: "parametros_invalidos" });
    try {
      const parentId = parsed.data.paciente_id
        ? ((await recursos.buscarCarpetaPaciente(db, parsed.data.paciente_id)) ?? undefined)
        : undefined;
      // Con paciente_id pero sin carpeta mapeada: no hay nada archivado todavía.
      if (parsed.data.paciente_id && !parentId) return { ok: true, datos: { archivos: [] } };
      const archivos = await clientes.drive.buscarPorNombre(parsed.data.q, parentId);
      return { ok: true, datos: { archivos } };
    } catch (err) {
      app.log.error({ err: err instanceof Error ? err.message : String(err) }, "drive/buscar falló");
      return reply.code(500).send({ ok: false, error: "error_interno" });
    }
  });

  // Fase 3: Calendar PERSONAL del paciente, opcional. El bot manda este
  // link solo después de confirmar la reserva y solo si el paciente dijo
  // que sí; nunca es obligatorio para agendar.
  app.get("/oauth/paciente/iniciar", async (req, reply) => {
    if (!credencialesListas(cfg)) return reply.code(503).send({ error: "no_configurado" });
    const query = QueryIniciar.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "parametros_invalidos" });

    const cliente = deps.construirCliente(cfg);
    const estado: EstadoOAuth = { reserva_id: query.data.reserva_id, paciente_id: query.data.paciente_id };
    const state = Buffer.from(JSON.stringify(estado)).toString("base64url");
    const url = deps.generarUrl(cliente, state);
    return reply.redirect(url);
  });

  app.get("/oauth/callback", async (req, reply) => {
    if (!credencialesListas(cfg)) return reply.code(503).send({ error: "no_configurado" });
    const query = QueryCallback.safeParse(req.query);
    if (!query.success) return reply.code(400).send({ error: "parametros_invalidos" });

    if (query.data.error) {
      return reply.type("text/html").send(paginaHtml("No se autorizó el acceso a su Calendar. Su cita sigue confirmada igual."));
    }
    if (!query.data.code || !query.data.state) {
      return reply.code(400).send({ error: "parametros_invalidos" });
    }

    let estado: EstadoOAuth;
    try {
      const decodificado: unknown = JSON.parse(Buffer.from(query.data.state, "base64url").toString("utf8"));
      estado = z.object({ reserva_id: z.number(), paciente_id: z.number() }).parse(decodificado);
    } catch {
      return reply.code(400).send({ error: "state_invalido" });
    }

    const cliente = deps.construirCliente(cfg);
    let tokens: TokensIntercambiados;
    try {
      tokens = await deps.intercambiarCodigo(cliente, query.data.code);
    } catch (err) {
      req.log.error({ err: err instanceof Error ? err.message : String(err) }, "fallo intercambiando el código OAuth");
      return reply.type("text/html").send(paginaHtml("No pudimos conectar su Calendar en este momento. Su cita sigue confirmada igual."));
    }
    if (!tokens.refreshToken) {
      return reply
        .type("text/html")
        .send(paginaHtml("Parece que ya había autorizado antes. Su cita sigue confirmada igual; si desea reintentar, revoque el acceso previo en su cuenta de Google."));
    }

    await autorizacion.guardarAutorizacion(db, {
      pacienteId: estado.paciente_id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      scope: tokens.scope,
      expiraEn: tokens.expiraEn,
    });

    const cita = await citas.obtenerCita(db, estado.reserva_id);
    if (cita) {
      const calendar = deps.construirCalendar(cliente);
      const creado = await calendar.crearEvento("primary", {
        resumen: `${cita.servicioNombre ?? "Cita"} — La Fisioterapeuta Li`,
        descripcion: `Sede: ${cita.sedeNombre}`,
        inicioIso: cita.iniciaEn,
        finIso: cita.terminaEn,
        zonaHoraria: cfg.TIMEZONE,
      });
      await recursos.guardarEventoCalendarPaciente(db, estado.reserva_id, { eventoId: creado.id });
    }

    return reply.type("text/html").send(paginaHtml("Listo, la cita ya quedó en su Google Calendar."));
  });

  return app;
}
