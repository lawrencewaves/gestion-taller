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

/**
 * Cifrado de contraseñas (RNF-03). Escritorio: Argon2id en Rust. Demo: PBKDF2 del navegador.
 * El resultado incluye algoritmo, parámetros y sal, para poder verificar y mejorar sin migraciones.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, hash: string): Promise<boolean>;
}

/**
 * Operaciones de bajo nivel de las copias (ARCHITECTURE §8). Solo el escritorio las tiene (Rust).
 * Qué copiar, cuándo y qué conservar lo decide `createBackupService`.
 */
export interface BackupPort {
  /** Selector de carpetas del sistema. `null` si se cancela. */
  pickFolder(): Promise<string | null>;
  hasKey(): Promise<boolean>;
  /** Genera y guarda una clave nueva. Falla si ya hay una. */
  createKey(): Promise<string>;
  revealKey(): Promise<string>;
  /** Falla si la clave no abre esa copia. */
  checkKey(folder: string, fileName: string, key: string): Promise<void>;
  setKey(key: string): Promise<void>;
  /** Copia coherente, comprobada, cifrada y colocada de golpe en `folder/fileName`. */
  create(folder: string, fileName: string): Promise<{ fileName: string; sizeBytes: number; sha256: string }>;
  /** Copias de la carpeta cuyo nombre empieza por `prefix`. */
  list(folder: string, prefix: string): Promise<{ name: string; sizeBytes: number }[]>;
  remove(folder: string, fileName: string): Promise<void>;
  /** Descifra y comprueba la copia aparte, sin tocar los datos actuales. */
  prepareRestore(folder: string, fileName: string): Promise<{ schemaVersion: number; environment: string | null }>;
  cancelRestore(): Promise<void>;
  /** Copia local del estado actual (con `label` en el nombre), y la copia preparada pasa a ser la base. */
  applyRestore(label: string): Promise<string>;
}

export const systemClock: Clock = { now: () => new Date().toISOString() };
