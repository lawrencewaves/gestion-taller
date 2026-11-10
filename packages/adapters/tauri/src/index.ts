/**
 * SqlExecutor del escritorio: cada operación viaja a Rust (rusqlite) por IPC (D-008).
 * La cola y las transacciones son las mismas que en el navegador (`createSerialExecutor`).
 * El adaptador recibe `invoke` desde fuera para no atarse a una versión de la API de Tauri.
 */
import {
  type BackupPort, createSerialExecutor, type PasswordHasher, type SqlExecutor, type SqlParams, type SqlValue,
} from '@gonzalvo/core';

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

/** Argon2id en Rust (RNF-03): la contraseña no se cifra en JavaScript. */
export function createTauriPasswordHasher(invoke: Invoke): PasswordHasher {
  return {
    hash: async (password) => (await invoke('password_hash', { password })) as string,
    verify: async (password, hash) => (await invoke('password_verify', { password, hash })) as boolean,
  };
}

/** Copia local de la base (sin cifrar, en la carpeta de datos) antes de migrar (RNF-08). Devuelve su nombre. */
export async function takeLocalSnapshot(invoke: Invoke, label: string): Promise<string> {
  return (await invoke('db_local_snapshot', { label })) as string;
}

/** Copias de seguridad en Rust: cifrado, Administrador de credenciales y selector de carpeta (D-038). */
export function createTauriBackupPort(invoke: Invoke): BackupPort {
  return {
    pickFolder: async () => (await invoke('backup_pick_folder')) as string | null,
    hasKey: async () => (await invoke('backup_key_status')) as boolean,
    createKey: async () => (await invoke('backup_key_create')) as string,
    revealKey: async () => (await invoke('backup_key_reveal')) as string,
    checkKey: async (folder, fileName, key) => {
      await invoke('backup_key_check', { folder, fileName, key });
    },
    setKey: async (key) => {
      await invoke('backup_key_set', { key });
    },
    create: async (folder, fileName) =>
      (await invoke('backup_create', { folder, fileName })) as { fileName: string; sizeBytes: number; sha256: string },
    list: async (folder, prefix) => (await invoke('backup_list', { folder, prefix })) as { name: string; sizeBytes: number }[],
    remove: async (folder, fileName) => {
      await invoke('backup_delete', { folder, fileName });
    },
    prepareRestore: async (folder, fileName) =>
      (await invoke('backup_restore_prepare', { folder, fileName })) as { schemaVersion: number; environment: string | null },
    cancelRestore: async () => {
      await invoke('backup_restore_cancel');
    },
    applyRestore: async (label) => (await invoke('backup_restore_apply', { label })) as string,
  };
}
