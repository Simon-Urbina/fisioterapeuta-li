import type { Db } from "../db.js";
import { ErrorDominio, normalizarErrorDb } from "../errores.js";

/**
 * Acciones que no le pertenecen a core-api ejecutar directamente: enviar
 * correo y crear carpetas requieren las credenciales OAuth de Google, que
 * viven únicamente en `services/google-adapter` (regla 4 del README: "el
 * modelo de IA no tiene credenciales", y por extensión tampoco las tiene
 * quien orquesta la intención sin ser el adaptador).
 *
 * Por eso estas dos escriben en `integracion.outbox` y devuelven de
 * inmediato: n8n las toma con `integracion.tomar_pendientes()` y
 * google-adapter las ejecuta. `agregado_id = 0` porque, a diferencia de una
 * reserva, esto no está atado a una entidad de negocio existente.
 */

export async function enviarCorreo(
  db: Db,
  opts: { destinatario: string; asunto: string; texto: string; html?: string },
): Promise<{ outboxId: number }> {
  try {
    // `html` es opcional: si no viene, el payload queda igual que siempre y
    // google-adapter manda un correo de solo texto (multipart/alternative
    // únicamente cuando hay versión HTML — ver construirMimeBase64).
    const payload = {
      destinatario: opts.destinatario,
      asunto: opts.asunto,
      texto: opts.texto,
      ...(opts.html ? { html: opts.html } : {}),
    };
    const r = await db.query<{ id: number }>(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('correo_manual', 0, 'correo.enviar', 'gmail', $1::jsonb)
       RETURNING id`,
      [JSON.stringify(payload)],
    );
    return { outboxId: (r.rows[0] as { id: number }).id };
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

const ETIQUETAS_ESTADO_RESERVA: Record<string, string> = {
  propuesta: "Propuesta",
  pendiente_pago: "Pendiente de pago",
  confirmada: "Confirmada",
  en_curso: "En curso",
  atendida: "Atendida",
  no_asistio: "No asistió",
  cancelada_tarde: "Cancelada (tarde)",
  cancelada_a_tiempo: "Cancelada (a tiempo)",
  expirada: "Expirada",
  rechazada: "Rechazada",
};

/**
 * Respaldo en Sheets del estado de una cita (ver services/google-adapter,
 * destino='sheets'): confirmación, cancelación, asistencia registrada, etc.
 * Cada reserva ocupa UNA fila que se sobreescribe en cada cambio — el
 * mapeo fila↔reserva lo lleva `integracion.google_recurso` del lado del
 * adaptador, acá solo se encola el evento con el estado ya legible.
 *
 * Si la reserva ya no existe o no tiene participante (no debería pasar,
 * pero no es motivo para tumbar la operación que disparó esto), simplemente
 * no encola nada.
 */
export async function sincronizarEstadoReservaEnSheet(db: Db, reservaId: number, estado: string): Promise<void> {
  try {
    const r = await db.query<{
      paciente: string;
      servicio: string | null;
      sede: string | null;
      inicia_en: string;
    }>(
      `SELECT (pa.nombres || ' ' || pa.apellidos) AS paciente,
              s.nombre AS servicio, se.nombre AS sede,
              lower(r.franja_clinica) AS inicia_en
         FROM agenda.reserva r
         JOIN agenda.reserva_participante rp ON rp.reserva_id = r.id
         JOIN personas.paciente pa ON pa.id = rp.paciente_id
         LEFT JOIN catalogo.servicio s ON s.id = r.servicio_id
         LEFT JOIN catalogo.sede se ON se.id = r.sede_id
        WHERE r.id = $1
        LIMIT 1`,
      [reservaId],
    );
    const f = r.rows[0];
    if (!f) return;
    await db.query(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('reserva', $1, 'reserva.estado_cambiado', 'sheets', $2::jsonb)`,
      [
        reservaId,
        JSON.stringify({
          fecha: f.inicia_en,
          paciente: f.paciente,
          servicio: f.servicio ?? "",
          sede: f.sede ?? "",
          estado: ETIQUETAS_ESTADO_RESERVA[estado] ?? estado,
        }),
      ],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

export async function crearCarpeta(db: Db, opts: { carpeta: string }): Promise<{ outboxId: number }> {
  try {
    const r = await db.query<{ id: number }>(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('carpeta_manual', 0, 'drive.crear_carpeta', 'drive', $1::jsonb)
       RETURNING id`,
      [JSON.stringify({ carpeta: opts.carpeta })],
    );
    return { outboxId: (r.rows[0] as { id: number }).id };
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/**
 * Encola la creación de la carpeta del paciente en Drive ("Pacientes/<nombre>/").
 * Idempotente del lado del consumidor (google-adapter mira
 * `integracion.google_recurso` antes de crear). Se llama al registrar un
 * paciente, dentro de su misma transacción.
 */
export async function crearCarpetaPaciente(
  db: Db,
  opts: { pacienteId: number; nombre: string },
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('paciente', $1, 'drive.carpeta_paciente', 'drive', $2::jsonb)`,
      [opts.pacienteId, JSON.stringify({ paciente_id: opts.pacienteId, nombre: opts.nombre })],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

/**
 * Encola el archivado del comprobante de pago (la foto que el paciente mandó
 * por Telegram) en "Pacientes/<nombre>/Comprobantes/". google-adapter baja
 * el archivo por su `file_id` y lo sube. Sin `TELEGRAM_BOT_TOKEN` allá, el
 * evento queda 'fallido' — no rompe el registro del pago.
 */
export async function archivarComprobante(
  db: Db,
  opts: { pacienteId: number; pacienteNombre: string; pagoId: number; fileId: string; nombreArchivo: string },
): Promise<void> {
  try {
    await db.query(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('pago', $1, 'drive.archivar_comprobante', 'drive', $2::jsonb)`,
      [
        opts.pagoId,
        JSON.stringify({
          paciente_id: opts.pacienteId,
          paciente_nombre: opts.pacienteNombre,
          file_id: opts.fileId,
          nombre_archivo: opts.nombreArchivo,
        }),
      ],
    );
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

export interface ArchivoDrive {
  id: string;
  nombre: string;
  webViewLink: string;
}

/**
 * Búsqueda de archivos en Drive por nombre. core-api no habla con Google
 * directo: le pega por HTTP a `services/google-adapter` (`GET /drive/buscar`),
 * que sí tiene las credenciales. `googleAdapter` lo arma `server.ts` desde la
 * config; si no vino, la función no está disponible en este entorno.
 */
export async function buscarArchivo(
  googleAdapter: { url: string; internalKey?: string | undefined } | undefined,
  opts: { consulta: string },
): Promise<{ archivos: ArchivoDrive[] }> {
  if (!googleAdapter?.url) {
    throw new ErrorDominio(
      "La búsqueda de archivos en Drive necesita el adaptador de Google configurado.",
      "no_configurado",
      503,
    );
  }
  const url = new URL("/drive/buscar", googleAdapter.url);
  url.searchParams.set("q", opts.consulta);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: googleAdapter.internalKey ? { "x-internal-key": googleAdapter.internalKey } : {},
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ErrorDominio("No se pudo consultar Drive en este momento.", "adaptador_no_responde", 502);
  }
  if (!resp.ok) {
    throw new ErrorDominio("Drive no devolvió resultados.", "drive_error", 502);
  }

  const cuerpo = (await resp.json().catch(() => null)) as
    | { ok?: boolean; datos?: { archivos?: unknown[] } }
    | null;
  const crudos = Array.isArray(cuerpo?.datos?.archivos) ? cuerpo.datos.archivos : [];
  const archivos = crudos
    .filter(
      (a): a is { id?: unknown; nombre: string; webViewLink?: unknown } =>
        typeof a === "object" && a !== null && typeof (a as { nombre?: unknown }).nombre === "string",
    )
    .map((a) => ({
      id: typeof a.id === "string" ? a.id : "",
      nombre: a.nombre,
      webViewLink: typeof a.webViewLink === "string" ? a.webViewLink : "",
    }));
  return { archivos };
}
