import type { Db } from "../db.js";
import { normalizarErrorDb } from "../errores.js";
import * as integraciones from "./integraciones.js";
import { construirCorreo } from "./correo.js";

/**
 * Recordatorios de cita. `integracion.notificacion` ya estaba en el schema
 * (con 'recordatorio_24h' previsto en el comentario de `plantilla`) pero
 * nunca se usó. El bot reclama recordatorios con `reclamarRecordatorios24h`
 * (inserción atómica: el índice único evita que dos barridos manden el
 * mismo recordatorio dos veces) y decide el canal según si la paciente
 * tiene el chat de Telegram vinculado; si no, pide el envío por correo con
 * `enviarRecordatorioPorEmail`.
 */

const PLANTILLA_24H = "recordatorio_24h";
const PLANTILLA_CONFIRMACION_TG = "confirmacion_tg";
const PLANTILLA_FELICITACION_REF = "felicitacion_referidos";

/**
 * Plantillas de aviso "simple" por Telegram: el cuerpo ya viene redactado por
 * core-api y el bot solo lo reenvía tal cual (a diferencia de confirmacion_tg,
 * que el bot arma con los datos de la cita).
 */
const PLANTILLAS_AVISO_SIMPLE = [PLANTILLA_FELICITACION_REF];

export interface RecordatorioPendiente {
  reservaId: number;
  pacienteId: number;
  paciente: string;
  servicio: string | null;
  sede: string | null;
  iniciaEn: string;
  chatId: string | null;
  pacienteEmail: string | null;
  /** Cuerpo listo para Telegram: el canal (bot o n8n) solo lo reenvía. */
  mensajeTelegram: string;
}

/**
 * Indicaciones previas por tipo de servicio (contenido real de Lina, ver
 * services/nlu/conocimiento/primera-cita.md). Duplicado de pagos.ts a
 * propósito (mismo patrón que fechaHoraBogota en este archivo): son módulos
 * independientes y el texto es chico.
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

function fechaHoraBogota(iso: string): string {
  const d = new Date(iso);
  const f = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
  const h = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${f}, ${h}`;
}

/** Solo la hora "HH:MM" en Bogotá (espejo de horaCorta del bot). */
function horaCortaBogota(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** "jueves, 11 de septiembre" en Bogotá. */
function fechaLargaBogota(iso: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));
}

/**
 * Estados de reserva que ya no cuentan como "cita del día": no van en el
 * resumen que se le manda a Lina cada mañana.
 */
const ESTADOS_MUERTOS = new Set(["cancelada_tarde", "cancelada_a_tiempo", "expirada", "rechazada"]);

export interface CitaDigest {
  estado: string;
  iniciaEn: string;
  servicio: string | null;
  sede: string | null;
  paciente: string | null;
}

/**
 * Resumen de la agenda del día para Lina, por Telegram — lo dispara n8n
 * (workflow digest-diario-lina) cada mañana. Igual que los otros mensajes
 * de este archivo: el texto se arma en core-api, no en el nodo de n8n.
 * `fechaIso` debe ser un instante del día a resumir (p. ej. mediodía en
 * Bogotá) para no cruzar el cambio de fecha por zona horaria.
 */
export function componerDigestDiario(fechaIso: string, citas: CitaDigest[]): string {
  const vivas = citas
    .filter((c) => !ESTADOS_MUERTOS.has(c.estado))
    // `iniciaEn` puede llegar como Date (node-postgres para timestamptz) o
    // como string; ordenar por el instante, no por texto.
    .sort((a, b) => new Date(a.iniciaEn).getTime() - new Date(b.iniciaEn).getTime());

  const encabezado = `🗓️ Agenda de hoy — ${fechaLargaBogota(fechaIso)}`;
  if (vivas.length === 0) {
    return `${encabezado}\n\nHoy no tiene citas agendadas.`;
  }

  const lineas = vivas.map((c) => {
    const partes = [
      horaCortaBogota(c.iniciaEn),
      c.servicio ?? "Cita",
      c.paciente ?? "paciente",
      c.sede ?? "",
    ].filter((p) => p.length > 0);
    return `• ${partes.join(" · ")}`;
  });

  const n = vivas.length;
  return `${encabezado}\n\n${String(n)} ${n === 1 ? "cita" : "citas"}:\n\n${lineas.join("\n")}`;
}

/**
 * Cuerpo del recordatorio 24h para Telegram. Se compone acá (no en el nodo
 * de n8n ni en el bot) para que el canal solo reenvíe: el texto y las
 * indicaciones por servicio son contenido de negocio. Antes vivía duplicado
 * en apps/telegram-bot/src/telegram/vigilanciaRecordatorios.ts.
 */
function mensajeRecordatorioTelegram(rec: {
  paciente: string;
  servicio: string | null;
  sede: string | null;
  iniciaEn: string;
}): string {
  const servicio = rec.servicio ?? "su cita";
  const primerNombre = rec.paciente ? rec.paciente.split(" ")[0] : "";
  return [
    `Hola${primerNombre ? `, ${primerNombre}` : ""} 👋`,
    `Le recordamos su cita de ${servicio} mañana.`,
    "",
    `Cuándo: ${fechaHoraBogota(rec.iniciaEn)}`,
    rec.sede ? `Dónde: ${rec.sede}` : "",
    "",
    indicacionesPara(rec.servicio),
    "",
    "Si necesita cancelar o reprogramar, escríbanos al 311 398 1422.",
  ]
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * Cuerpo del aviso "cita confirmada" para Telegram (confirmación hecha desde
 * el panel web). Mismo criterio que mensajeRecordatorioTelegram: antes
 * duplicado en apps/telegram-bot/src/telegram/vigilanciaConfirmaciones.ts.
 */
function mensajeConfirmacionTelegram(c: {
  servicio: string | null;
  sede: string | null;
  iniciaEn: string;
}): string {
  return [
    "¡Su cita quedó confirmada! ✅",
    `${c.servicio ?? "Su cita"} · ${horaCortaBogota(c.iniciaEn)}`,
    c.sede ?? "",
    "",
    indicacionesPara(c.servicio),
    "",
    "¡Le esperamos! 💛",
  ]
    .filter((l) => l.length > 0)
    .join("\n");
}

/**
 * Reclama (inserta como 'pendiente') los recordatorios de citas confirmadas
 * que empiezan entre 23 y 25 horas desde ahora y que todavía no tienen un
 * recordatorio registrado. Un INSERT ... SELECT con ON CONFLICT DO NOTHING
 * sobre el índice único: si dos barridos se solapan, el segundo simplemente
 * no reclama nada para las citas que el primero ya tomó.
 */
export async function reclamarRecordatorios24h(db: Db): Promise<RecordatorioPendiente[]> {
  try {
    const r = await db.query<{
      reserva_id: number | string;
      paciente_id: number | string;
      paciente: string;
      servicio: string | null;
      sede: string | null;
      inicia_en: string;
      chat_id: string | null;
      paciente_email: string | null;
    }>(
      `WITH candidatas AS (
         SELECT r.id AS reserva_id, pa.id AS paciente_id,
                (pa.nombres || ' ' || pa.apellidos) AS paciente,
                s.nombre AS servicio, se.nombre AS sede,
                lower(r.franja_clinica) AS inicia_en,
                vt.chat_id::text AS chat_id, pa.email AS paciente_email
           FROM agenda.reserva r
           JOIN agenda.reserva_participante rp ON rp.reserva_id = r.id
           JOIN personas.paciente pa ON pa.id = rp.paciente_id
           LEFT JOIN catalogo.servicio s ON s.id = r.servicio_id
           LEFT JOIN catalogo.sede se ON se.id = r.sede_id
           LEFT JOIN personas.vinculo_telegram vt ON vt.paciente_id = rp.paciente_id
          WHERE r.estado = 'confirmada'
            AND lower(r.franja_clinica) BETWEEN now() + interval '23 hours' AND now() + interval '25 hours'
       ),
       reclamadas AS (
         INSERT INTO integracion.notificacion (paciente_id, reserva_id, plantilla, canal, destinatario, estado)
         SELECT paciente_id, reserva_id, $1,
                (CASE WHEN chat_id IS NOT NULL THEN 'telegram' ELSE 'email' END)::agenda.canal_origen,
                coalesce(chat_id, paciente_email, 'sin_contacto'),
                'pendiente'
           FROM candidatas
         ON CONFLICT (reserva_id, paciente_id, plantilla) WHERE reserva_id IS NOT NULL AND paciente_id IS NOT NULL
         DO NOTHING
         RETURNING reserva_id, paciente_id
       )
       SELECT c.*
         FROM candidatas c
         JOIN reclamadas rec ON rec.reserva_id = c.reserva_id AND rec.paciente_id = c.paciente_id`,
      [PLANTILLA_24H],
    );
    return r.rows.map((f) => ({
      reservaId: Number(f.reserva_id),
      pacienteId: Number(f.paciente_id),
      paciente: f.paciente,
      servicio: f.servicio,
      sede: f.sede,
      iniciaEn: f.inicia_en,
      chatId: f.chat_id,
      pacienteEmail: f.paciente_email,
      mensajeTelegram: mensajeRecordatorioTelegram({
        paciente: f.paciente,
        servicio: f.servicio,
        sede: f.sede,
        iniciaEn: f.inicia_en,
      }),
    }));
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/**
 * Marca el resultado de un recordatorio que el bot mandó él mismo (canal
 * Telegram: no pasa por el outbox de google-adapter, así que nadie más
 * actualiza esta fila).
 */
export async function marcarRecordatorioResultado(
  db: Db,
  opts: { reservaId: number; pacienteId: number; ok: boolean; error?: string | null },
): Promise<void> {
  try {
    await db.query(
      `UPDATE integracion.notificacion
          SET estado = CASE WHEN $4 THEN 'enviada' ELSE 'fallida' END::integracion.estado_notificacion,
              enviada_en = CASE WHEN $4 THEN now() ELSE NULL END,
              error = $5
        WHERE reserva_id = $1 AND paciente_id = $2 AND plantilla = $3 AND estado = 'pendiente'`,
      [opts.reservaId, opts.pacienteId, PLANTILLA_24H, opts.ok, opts.error ?? null],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

// ---------------------------------------------------------------------------
// Aviso de "cita confirmada" por Telegram cuando la confirmación se hace desde
// el panel web (web/admin.ts `confirmarCita`), que no le habla al bot. La
// verificación de pago POR Telegram (dominio/pagos.ts) ya le escribe directo
// al paciente; para no duplicar, esa marca la fila como 'enviada' apenas
// avisa. Mismo patrón idempotente que los recordatorios: el índice único
// (reserva_id, paciente_id, plantilla) evita duplicados.
// ---------------------------------------------------------------------------

export interface ConfirmacionTelegramPendiente {
  reservaId: number;
  pacienteId: number;
  paciente: string;
  servicio: string | null;
  sede: string | null;
  iniciaEn: string;
  chatId: string;
  /** Cuerpo listo para Telegram: el canal (bot o n8n) solo lo reenvía. */
  mensajeTelegram: string;
}

/**
 * Encola el aviso "su cita quedó confirmada" por Telegram para una reserva
 * recién confirmada, solo si la paciente tiene el chat vinculado (si no, ya
 * recibe el correo de confirmación por otro lado). Idempotente: `ON CONFLICT
 * DO NOTHING` sobre el índice único.
 */
export async function encolarConfirmacionTelegram(db: Db, reservaId: number): Promise<void> {
  try {
    await db.query(
      `INSERT INTO integracion.notificacion
         (paciente_id, reserva_id, plantilla, canal, destinatario, estado)
       SELECT rp.paciente_id, r.id, $2, 'telegram'::agenda.canal_origen, vt.chat_id::text, 'pendiente'
         FROM agenda.reserva r
         JOIN agenda.reserva_participante rp ON rp.reserva_id = r.id
         JOIN personas.vinculo_telegram vt ON vt.paciente_id = rp.paciente_id AND NOT vt.bloqueado
        WHERE r.id = $1 AND r.estado = 'confirmada'
       ON CONFLICT (reserva_id, paciente_id, plantilla) WHERE reserva_id IS NOT NULL AND paciente_id IS NOT NULL
       DO NOTHING`,
      [reservaId, PLANTILLA_CONFIRMACION_TG],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

export type EstadoAvisoTgVerificacion = "sin_fila" | "reclamada" | "ya_enviada";

/**
 * Para la verificación de pago POR Telegram (que le escribe al paciente
 * directo): decide si todavía hace falta ese aviso directo o si ya salió por
 * el barrido (confirmación desde el panel web).
 *  - "sin_fila": no hubo confirmación desde la web → el bot manda el aviso.
 *  - "reclamada": había una fila pendiente/fallida; se marca 'enviada' aquí y
 *    el bot manda el aviso ahora (el barrido ya no la tocará).
 *  - "ya_enviada": el barrido ya avisó → el bot NO manda nada (evita el
 *    mensaje de confirmación duplicado).
 */
export async function reclamarAvisoTelegramParaVerificacion(
  db: Db,
  reservaId: number,
): Promise<EstadoAvisoTgVerificacion> {
  try {
    const r = await db.query<{ resultado: EstadoAvisoTgVerificacion }>(
      `WITH fila AS (
         SELECT id, estado FROM integracion.notificacion
          WHERE reserva_id = $1 AND plantilla = $2
          ORDER BY id LIMIT 1
       ),
       upd AS (
         UPDATE integracion.notificacion n
            SET estado = 'enviada', enviada_en = now()
           FROM fila
          WHERE n.id = fila.id AND fila.estado <> 'enviada'
        RETURNING n.id
       )
       SELECT CASE
         WHEN NOT EXISTS (SELECT 1 FROM fila) THEN 'sin_fila'
         WHEN EXISTS (SELECT 1 FROM upd)      THEN 'reclamada'
         ELSE 'ya_enviada'
       END AS resultado`,
      [reservaId, PLANTILLA_CONFIRMACION_TG],
    );
    return r.rows[0]?.resultado ?? "sin_fila";
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/** Avisos de confirmación por Telegram todavía sin mandar (el bot los barre). */
export async function listarConfirmacionesTelegramPendientes(
  db: Db,
): Promise<ConfirmacionTelegramPendiente[]> {
  try {
    const r = await db.query<{
      reserva_id: number | string;
      paciente_id: number | string;
      paciente: string;
      servicio: string | null;
      sede: string | null;
      inicia_en: string;
      chat_id: string;
    }>(
      `SELECT n.reserva_id, n.paciente_id,
              (pa.nombres || ' ' || pa.apellidos) AS paciente,
              s.nombre AS servicio, se.nombre AS sede,
              lower(r.franja_clinica) AS inicia_en,
              n.destinatario AS chat_id
         FROM integracion.notificacion n
         JOIN agenda.reserva r ON r.id = n.reserva_id
         JOIN personas.paciente pa ON pa.id = n.paciente_id
         LEFT JOIN catalogo.servicio s ON s.id = r.servicio_id
         LEFT JOIN catalogo.sede se ON se.id = r.sede_id
        WHERE n.plantilla = $1 AND n.estado = 'pendiente'
        ORDER BY n.programada_para
        LIMIT 20`,
      [PLANTILLA_CONFIRMACION_TG],
    );
    return r.rows.map((f) => ({
      reservaId: Number(f.reserva_id),
      pacienteId: Number(f.paciente_id),
      paciente: f.paciente,
      servicio: f.servicio,
      sede: f.sede,
      iniciaEn: f.inicia_en,
      chatId: f.chat_id,
      mensajeTelegram: mensajeConfirmacionTelegram({
        servicio: f.servicio,
        sede: f.sede,
        iniciaEn: f.inicia_en,
      }),
    }));
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/** Resultado de un aviso de confirmación TG que el bot mandó (o intentó). */
export async function marcarConfirmacionTelegram(
  db: Db,
  opts: { reservaId: number; pacienteId: number; ok: boolean; error?: string | null },
): Promise<void> {
  try {
    await db.query(
      `UPDATE integracion.notificacion
          SET estado = CASE WHEN $4 THEN 'enviada' ELSE 'fallida' END::integracion.estado_notificacion,
              enviada_en = CASE WHEN $4 THEN now() ELSE NULL END,
              error = $5
        WHERE reserva_id = $1 AND paciente_id = $2 AND plantilla = $3 AND estado = 'pendiente'`,
      [opts.reservaId, opts.pacienteId, PLANTILLA_CONFIRMACION_TG, opts.ok, opts.error ?? null],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

// ---------------------------------------------------------------------------
// Avisos "simples" por Telegram (cuerpo ya redactado). Hoy: la felicitación
// al referente que llegó a los 5 referidos y ganó su descuento.
// ---------------------------------------------------------------------------

export interface AvisoTelegramSimple {
  id: number;
  chatId: string;
  texto: string;
}

/** Encola la felicitación por Telegram para `pacienteId` (si tiene chat vinculado). */
export async function encolarFelicitacionReferidos(
  db: Db,
  opts: { pacienteId: number; porcentaje: number; referidos: number },
): Promise<void> {
  try {
    const pct = Number.isInteger(opts.porcentaje) ? String(opts.porcentaje) : opts.porcentaje.toFixed(1);
    const texto = [
      "🎉 ¡Felicitaciones!",
      "",
      `Ya son ${opts.referidos} personas que usted refirió y asistieron a su cita. Por eso le regalamos un ${pct}% de descuento en su próxima cita.`,
      "",
      "El descuento se aplica solo cuando reserve su siguiente cita. ¡Gracias por recomendarnos! 💛",
    ].join("\n");
    await db.query(
      `INSERT INTO integracion.notificacion
         (paciente_id, plantilla, canal, destinatario, cuerpo, estado)
       SELECT $1, $2, 'telegram'::agenda.canal_origen, vt.chat_id::text, $3, 'pendiente'
         FROM personas.vinculo_telegram vt
        WHERE vt.paciente_id = $1 AND NOT vt.bloqueado`,
      [opts.pacienteId, PLANTILLA_FELICITACION_REF, texto],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/** Avisos simples de Telegram sin mandar (el bot los barre y reenvía el cuerpo). */
export async function listarAvisosTelegramSimplesPendientes(db: Db): Promise<AvisoTelegramSimple[]> {
  try {
    const r = await db.query<{ id: number | string; chat_id: string; cuerpo: string | null }>(
      `SELECT id, destinatario AS chat_id, cuerpo
         FROM integracion.notificacion
        WHERE canal = 'telegram' AND plantilla = ANY($1) AND estado = 'pendiente'
        ORDER BY programada_para
        LIMIT 20`,
      [PLANTILLAS_AVISO_SIMPLE],
    );
    return r.rows
      .filter((f): f is { id: number | string; chat_id: string; cuerpo: string } => typeof f.cuerpo === "string")
      .map((f) => ({ id: Number(f.id), chatId: f.chat_id, texto: f.cuerpo }));
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/** Resultado de un aviso simple que el bot mandó (o intentó), por id de notificación. */
export async function marcarAvisoTelegram(
  db: Db,
  opts: { id: number; ok: boolean; error?: string | null },
): Promise<void> {
  try {
    await db.query(
      `UPDATE integracion.notificacion
          SET estado = CASE WHEN $2 THEN 'enviada' ELSE 'fallida' END::integracion.estado_notificacion,
              enviada_en = CASE WHEN $2 THEN now() ELSE NULL END,
              error = $3
        WHERE id = $1 AND estado = 'pendiente'`,
      [opts.id, opts.ok, opts.error ?? null],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/**
 * Compone y encola (vía integracion.outbox, igual que el correo de "cita
 * confirmada") el recordatorio por correo para una paciente sin Telegram
 * vinculado, y marca la notificación ya reclamada como enviada.
 */
export async function enviarRecordatorioPorEmail(
  db: Db,
  opts: { reservaId: number; pacienteId: number },
): Promise<{ enviado: boolean }> {
  try {
    return await db.tx(async (tx) => {
      const r = await tx.query<{
        paciente_email: string | null;
        servicio: string | null;
        sede: string | null;
        inicia_en: string;
      }>(
        `SELECT pa.email AS paciente_email, s.nombre AS servicio, se.nombre AS sede,
                lower(r.franja_clinica) AS inicia_en
           FROM agenda.reserva r
           JOIN personas.paciente pa ON pa.id = $2
           LEFT JOIN catalogo.servicio s ON s.id = r.servicio_id
           LEFT JOIN catalogo.sede se ON se.id = r.sede_id
          WHERE r.id = $1`,
        [opts.reservaId, opts.pacienteId],
      );
      const f = r.rows[0];
      if (!f?.paciente_email) {
        await marcarRecordatorioResultado(tx, {
          reservaId: opts.reservaId,
          pacienteId: opts.pacienteId,
          ok: false,
          error: "sin correo registrado",
        });
        return { enviado: false };
      }

      const servicio = f.servicio ?? "su cita";
      const { texto, html } = construirCorreo({
        titulo: `Recordatorio: ${servicio} mañana`,
        parrafos: [`Le recordamos su cita de ${servicio} mañana.`],
        datos: [
          { etiqueta: "Cuándo", valor: fechaHoraBogota(f.inicia_en) },
          ...(f.sede ? [{ etiqueta: "Dónde", valor: f.sede }] : []),
        ],
        nota: indicacionesPara(f.servicio),
      });
      await integraciones.enviarCorreo(tx, {
        destinatario: f.paciente_email,
        asunto: `Recordatorio — ${servicio} mañana`,
        texto,
        html,
      });
      await tx.query(
        `UPDATE integracion.notificacion
            SET estado = 'enviada', enviada_en = now()
          WHERE reserva_id = $1 AND paciente_id = $2 AND plantilla = $3 AND estado = 'pendiente'`,
        [opts.reservaId, opts.pacienteId, PLANTILLA_24H],
      );
      return { enviado: true };
    });
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}
