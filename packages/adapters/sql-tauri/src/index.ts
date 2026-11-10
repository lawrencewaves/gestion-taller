/**
 * SqlExecutor del escritorio: cada operación viaja a Rust (rusqlite) por IPC (D-008).
 * La cola y las transacciones son las mismas que en el navegador (`createSerialExecutor`).
 * El adaptador recibe `invoke` desde fuera para no atarse a una versión de la API de Tauri.
 */
import { createSerialExecutor, type SqlExecutor, type SqlParams, type SqlValue } from '@gonzalvo/core';

export type Invoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

/** JSON no admite bigint ni Uint8Array: se convierten aquí, antes de cruzar a Rust. */
function toJson(value: SqlValue): unknown {
  if (typeof value === 'bigint') {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError('Número entero demasiado grande para la base de datos');
    }
    return Number(value);
  }
  if (value instanceof Uint8Array) return Array.from(value);
  return value;
}

export function serializeParams(params?: SqlParams): unknown {
  if (params === undefined) return null;
  if (Array.isArray(params)) return params.map(toJson);
  return Object.fromEntries(Object.entries(params as Record<string, SqlValue>).map(([k, v]) => [k, toJson(v)]));
}

export function createTauriExecutor(invoke: Invoke): SqlExecutor {
  return createSerialExecutor({
    async all(sql, params) {
      return (await invoke('sql_all', { sql, params: serializeParams(params) })) as Record<string, SqlValue>[];
    },
    async run(sql, params) {
      return (await invoke('sql_run', { sql, params: serializeParams(params) })) as { changes: number };
    },
    async exec(sql) {
      await invoke('sql_exec', { sql });
    },
  });
}

/** Abre la base en la carpeta de datos de la aplicación. Devuelve la ruta del archivo. */
export async function openTauriDatabase(invoke: Invoke, fileName: string): Promise<string> {
  return (await invoke('db_open', { fileName })) as string;
}
