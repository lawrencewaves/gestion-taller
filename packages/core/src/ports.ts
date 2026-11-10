/**
 * Puertos: lo que `core` y `data` necesitan del exterior (ARCHITECTURE §4).
 * Cada entorno los implementa con su adaptador: Rust en escritorio, WASM en la demo.
 */

export type SqlValue = string | number | bigint | null | Uint8Array;
export type SqlParams = readonly SqlValue[] | Readonly<Record<string, SqlValue>>;

export interface RunResult {
  changes: number;
}

export interface SqlExecutor {
  /** Filas de una consulta. */
  all<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T[]>;
  /** Primera fila de una consulta, o `undefined`. */
  get<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): Promise<T | undefined>;
  /** Una sentencia de escritura. */
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  /** Varias sentencias sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
  /**
   * Todo lo que haga `work` se confirma junto o se deshace junto.
   * Mientras dura, ninguna otra operación usa la conexión.
   */
  transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T>;
}

export interface Clock {
  /** Instante actual en ISO 8601 UTC (DATABASE §2). */
  now(): string;
}

export interface IdGenerator {
  /** Identificador estable y ordenable por fecha de creación (UUIDv7). */
  next(): string;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };
