import type { Db } from "../db.js";

/**
 * Resolución de nombres en lenguaje natural ("Punción Seca", "Tunja") a los
 * identificadores que piden las funciones de `db/migrations/schema.sql`. El
 * NLU nunca inventa un servicio o una sede: entrega el texto tal como lo
 * escribió la persona, y aquí se busca contra el catálogo real.
 */

export interface Servicio {
  id: number;
  nombre: string;
  duracionMinMinutos: number;
  duracionMaxMinutos: number;
}

export interface Sede {
  id: number;
  nombre: string;
}

interface FilaServicio {
  id: number;
  nombre: string;
  duracion_min_minutos: number;
  duracion_max_minutos: number;
}

export async function resolverServicio(db: Db, nombre: string): Promise<Servicio | null> {
  const r = await db.query<FilaServicio>(
    `SELECT id, nombre, duracion_min_minutos, duracion_max_minutos
       FROM catalogo.servicio
      WHERE activo AND (nombre ILIKE $1 OR codigo ILIKE $1)
      ORDER BY length(nombre) ASC
      LIMIT 1`,
    [`%${nombre}%`],
  );
  const fila = r.rows[0];
  if (!fila) return null;
  return {
    id: fila.id,
    nombre: fila.nombre,
    duracionMinMinutos: fila.duracion_min_minutos,
    duracionMaxMinutos: fila.duracion_max_minutos,
  };
}

export async function resolverSede(db: Db, nombre: string): Promise<Sede | null> {
  const r = await db.query<{ id: number; nombre: string }>(
    `SELECT id, nombre
       FROM catalogo.sede
      WHERE activo AND (nombre ILIKE $1 OR codigo ILIKE $1 OR ciudad ILIKE $1)
      ORDER BY length(nombre) ASC
      LIMIT 1`,
    [`%${nombre}%`],
  );
  return r.rows[0] ?? null;
}

/** El único profesional activo, cuando la intención no especifica cuál. */
export async function profesionalPorDefecto(db: Db): Promise<number | null> {
  const r = await db.query<{ id: number }>(
    `SELECT id FROM personas.profesional WHERE activo ORDER BY id LIMIT 1`,
  );
  return r.rows[0]?.id ?? null;
}
