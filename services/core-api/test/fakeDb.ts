import type { QueryResultRow } from "pg";
import type { Db } from "../src/db.js";

export interface LlamadaDb {
  texto: string;
  valores: unknown[];
}

/**
 * Base falsa para pruebas unitarias del dominio: responde con una cola de
 * resultados en el orden en que se espera que las funciones los pidan, y
 * registra cada consulta ejecutada para poder aserirla. `tx` no abre una
 * transacción real: simplemente corre `fn` contra esta misma base, que es
 * suficiente para probar la lógica de orquestación.
 */
export function crearDbFalsa(colaRespuestas: unknown[][] = []): { db: Db; llamadas: LlamadaDb[] } {
  const llamadas: LlamadaDb[] = [];
  let indice = 0;

  const db: Db = {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- espejo del generic de Db.query
    query: <T extends QueryResultRow = QueryResultRow>(texto: string, valores: unknown[] = []) => {
      llamadas.push({ texto, valores });
      const filas = (colaRespuestas[indice] ?? []) as T[];
      indice += 1;
      return Promise.resolve({ rows: filas });
    },
    tx: (fn) => fn(db),
  };

  return { db, llamadas };
}

/** Variante que lanza un error de Postgres simulado en la N-ésima llamada. */
export function crearDbFalsaConError(
  colaRespuestas: unknown[][],
  llamadaQueFalla: number,
  error: { code: string; message: string },
): { db: Db; llamadas: LlamadaDb[] } {
  const llamadas: LlamadaDb[] = [];
  let indice = 0;

  const db: Db = {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- espejo del generic de Db.query
    query: <T extends QueryResultRow = QueryResultRow>(texto: string, valores: unknown[] = []) => {
      llamadas.push({ texto, valores });
      const actual = indice;
      indice += 1;
      if (actual === llamadaQueFalla) {
        return Promise.reject(Object.assign(new Error(error.message), { code: error.code }));
      }
      const filas = (colaRespuestas[actual] ?? []) as T[];
      return Promise.resolve({ rows: filas });
    },
    tx: (fn) => fn(db),
  };

  return { db, llamadas };
}
