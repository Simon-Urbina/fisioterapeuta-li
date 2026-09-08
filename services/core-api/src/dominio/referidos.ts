import type { Db } from "../db.js";
import { normalizarErrorDb } from "../errores.js";

/**
 * Programa de referidos. El descuento del N%-por-5-referidos:
 *  - se OTORGA solo (sin que Lina corra nada) cuando el 5º referido asiste a
 *    su cita — lo dispara `asistencia.registrarAsistencia`.
 *  - se APLICA solo al crear la compra de la siguiente cita del referente —
 *    lo hace `agenda.crearSesion`.
 * Todo se apoya en `comercial.v_referidos_elegibles` y en la función SQL
 * `comercial.otorgar_descuento_referidos`.
 */

export interface DescuentoOtorgado {
  beneficioId: number;
  porcentaje: number;
  referidos: number;
}

/**
 * Si `referenteId` acaba de cumplir los referidos requeridos y todavía no
 * tiene un beneficio de referidos, se lo otorga. Devuelve el beneficio o
 * `null` si no aplicaba (aún le faltan, o ya lo tiene).
 */
export async function otorgarDescuentoReferidosSiElegible(
  db: Db,
  referenteId: number,
): Promise<DescuentoOtorgado | null> {
  try {
    const elegible = await db.query<{ aplica: boolean; efectivos: number | string; ya_tiene: boolean }>(
      `SELECT
         coalesce(v.aplica_descuento, false) AS aplica,
         coalesce(v.referidos_efectivos, 0)  AS efectivos,
         EXISTS (
           SELECT 1 FROM comercial.beneficio b
            WHERE b.paciente_id = $1 AND b.tipo = 'descuento_referidos'
         ) AS ya_tiene
       FROM (SELECT 1) _
       LEFT JOIN comercial.v_referidos_elegibles v ON v.paciente_referente_id = $1`,
      [referenteId],
    );
    const e = elegible.rows[0];
    if (!e || !e.aplica || e.ya_tiene) return null;

    const otorgado = await db.query<{ id: number | string }>(
      `SELECT comercial.otorgar_descuento_referidos($1) AS id`,
      [referenteId],
    );
    const beneficioId = Number((otorgado.rows[0] as { id: number | string }).id);

    const det = await db.query<{ porcentaje_descuento: string }>(
      `SELECT porcentaje_descuento FROM comercial.beneficio WHERE id = $1`,
      [beneficioId],
    );
    return {
      beneficioId,
      porcentaje: Number(det.rows[0]?.porcentaje_descuento ?? 0),
      referidos: Number(e.efectivos),
    };
  } catch (err) {
    throw normalizarErrorDb(err);
  }
}

export interface DescuentoDisponible {
  beneficioId: number;
  porcentaje: number;
}

/** Beneficio de referidos `disponible` del paciente (para aplicarlo a una compra), o `null`. */
export async function descuentoDisponible(db: Db, pacienteId: number): Promise<DescuentoDisponible | null> {
  const r = await db.query<{ id: number | string; porcentaje_descuento: string }>(
    `SELECT id, porcentaje_descuento
       FROM comercial.beneficio
      WHERE paciente_id = $1 AND tipo = 'descuento_referidos' AND estado = 'disponible'
      ORDER BY id
      LIMIT 1`,
    [pacienteId],
  );
  const f = r.rows[0];
  if (!f) return null;
  return { beneficioId: Number(f.id), porcentaje: Number(f.porcentaje_descuento) };
}

/** Marca un beneficio como redimido contra la compra/reserva que lo usó. */
export async function redimirDescuento(
  db: Db,
  opts: { beneficioId: number; compraId: number; reservaId: number },
): Promise<void> {
  await db.query(
    `UPDATE comercial.beneficio
        SET estado = 'redimido', redimido_en = now(),
            redimido_compra_id = $2, redimido_reserva_id = $3
      WHERE id = $1 AND estado = 'disponible'`,
    [opts.beneficioId, opts.compraId, opts.reservaId],
  );
}

/** Aplica el % de descuento a un valor y redondea a pesos. */
export function aplicarPorcentaje(valor: number, porcentaje: number): number {
  return Math.round(valor * (1 - porcentaje / 100));
}
