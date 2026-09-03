import { Pool, type QueryResultRow } from "pg";
import type { Config } from "./config.js";

/**
 * Frontera con PostgreSQL. Todo el dominio (`src/dominio/*`) programa
 * contra esta interfaz, nunca contra `pg` directamente — así las pruebas
 * unitarias inyectan una base falsa sin levantar un Postgres real (mismo
 * criterio que `nluClient.ts` inyectable en apps/telegram-bot).
 */
export interface Db {
  // `T` solo aparece en el retorno a propósito: el mismo patrón que
  // `pg.Pool.query<T>`, para que quien llama tipe la forma de fila que
  // espera sin que la interfaz la infiera de los parámetros.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  query<T extends QueryResultRow = QueryResultRow>(
    texto: string,
    valores?: unknown[],
  ): Promise<{ rows: T[] }>;
  /** Ejecuta `fn` dentro de una transacción; hace rollback si `fn` lanza. */
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

let pool: Pool | null = null;

export function construirDb(cfg: Config): Db {
  pool ??= new Pool({ connectionString: cfg.DATABASE_URL, max: cfg.CORE_API_DB_POOL_MAX });
  const p = pool;

  return {
    query: async (texto, valores = []) => p.query(texto, valores),
    tx: async (fn) => {
      const client = await p.connect();
      try {
        await client.query("BEGIN");
        // Dentro de la transacción, todas las consultas (incluidas las de un
        // `tx` anidado) corren sobre el mismo `client`: PostgreSQL no anida
        // transacciones de verdad y para el dominio no hace falta savepoints.
        const dbTx: Db = {
          query: async (texto2, valores2 = []) => client.query(texto2, valores2),
          tx: async (fn2) => fn2(dbTx),
        };
        const resultado = await fn(dbTx);
        await client.query("COMMIT");
        return resultado;
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

/** Cierra el pool. Solo se usa al apagar el proceso. */
export async function cerrarDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Solo para pruebas: descarta el pool memorizado. */
export function _resetDbForTests(): void {
  pool = null;
}
