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
  opts: { destinatario: string; asunto: string; texto: string },
): Promise<{ outboxId: number }> {
  try {
    const r = await db.query<{ id: number }>(
      `INSERT INTO integracion.outbox (agregado_tipo, agregado_id, tipo_evento, destino, payload)
       VALUES ('correo_manual', 0, 'correo.enviar', 'gmail', $1::jsonb)
       RETURNING id`,
      [JSON.stringify({ destinatario: opts.destinatario, asunto: opts.asunto, texto: opts.texto })],
    );
    return { outboxId: (r.rows[0] as { id: number }).id };
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
 * GAP CONOCIDO: buscar un archivo por nombre requiere consultar Drive en
 * vivo (`integracion.google_recurso` es un espejo de sincronización, no un
 * índice de nombres de archivo) y `services/google-adapter` todavía no
 * existe. Se deja el error explícito en vez de fingir un resultado vacío.
 */
export function buscarArchivo(): never {
  throw new ErrorDominio(
    "Buscar archivos en Drive requiere el adaptador de Google, que todavía no está implementado.",
    "no_implementado",
    501,
  );
}
