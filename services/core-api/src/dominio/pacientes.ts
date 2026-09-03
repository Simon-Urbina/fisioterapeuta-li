import type { Db } from "../db.js";

/**
 * Búsqueda de pacientes por nombre escrito a mano (con errores de
 * digitación y sin tildes) usando `personas.v_paciente` y el índice trigram
 * que ya define `db/migrations/schema.sql` sobre nombres + apellidos.
 */

export interface Paciente {
  id: number;
  nombreCompleto: string;
  telefono: string | null;
}

export type ResultadoBusquedaPaciente =
  | { tipo: "unico"; paciente: Paciente }
  | { tipo: "ambiguo"; candidatos: Paciente[] }
  | { tipo: "no_encontrado" };

interface FilaPaciente {
  id: number;
  nombre_completo: string;
  telefono: string | null;
}

export async function buscarPaciente(db: Db, nombre: string): Promise<ResultadoBusquedaPaciente> {
  const r = await db.query<FilaPaciente>(
    `SELECT id, nombre_completo, telefono
       FROM personas.v_paciente
      WHERE activo
        AND sin_tildes(lower(nombre_completo)) % sin_tildes(lower($1))
      ORDER BY similarity(sin_tildes(lower(nombre_completo)), sin_tildes(lower($1))) DESC
      LIMIT 5`,
    [nombre],
  );

  const candidatos: Paciente[] = r.rows.map((f) => ({
    id: f.id,
    nombreCompleto: f.nombre_completo,
    telefono: f.telefono,
  }));

  const [primero] = candidatos;
  if (primero === undefined) return { tipo: "no_encontrado" };
  if (candidatos.length === 1) return { tipo: "unico", paciente: primero };
  return { tipo: "ambiguo", candidatos };
}
