import type { DiagnosticsReport, Session, SystemService } from '@gonzalvo/contracts';
import type { SqlExecutor } from '../ports';
import { requirePermission } from './auth';

export interface SystemServiceDeps {
  db: SqlExecutor;
  /** Dónde guarda este entorno el archivo de la base. */
  storage: DiagnosticsReport['storage'];
  dbName: string;
  schemaVersion: number;
  /** Motivo por el que no se pudo usar el almacenamiento persistente, si lo hubo. */
  storageError?: string;
  /** Sesión actual: el diagnóstico exige el permiso `system.diagnostics`. */
  session: () => Session | null;
}

const openCount = async (db: SqlExecutor) =>
  Number((await db.get<{ value: string }>("SELECT value FROM app_meta WHERE key = 'open_count'"))?.value ?? 0);

/** Cuenta una apertura más. Se llama una vez al arrancar el programa. */
export async function recordOpen(db: SqlExecutor): Promise<void> {
  await db.run(
    `INSERT INTO app_meta (key, value) VALUES ('open_count', '1')
     ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
  );
}

/** Diagnóstico de la base de datos, igual en el navegador y en el Mac. */
export function createSystemService(deps: SystemServiceDeps): SystemService {
  const { db } = deps;
  return {
    async diagnostics() {
      requirePermission(deps.session(), 'system.diagnostics');
      const opens = await openCount(db);

      // Una transacción que falla no deja rastro.
      await db
        .transaction(async (tx) => {
          await tx.run("UPDATE app_meta SET value = '-1' WHERE key = 'open_count'");
          throw new Error('deshacer');
        })
        .catch(() => undefined);
      const transactionsOk = (await openCount(db)) === opens;

      const foreignKeysOk = (await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys === 1;
      const sqliteVersion = (await db.get<{ v: string }>('SELECT sqlite_version() AS v'))?.v ?? '';

      return {
        sqliteVersion,
        storage: deps.storage,
        dbName: deps.dbName,
        schemaVersion: deps.schemaVersion,
        opens,
        transactionsOk,
        foreignKeysOk,
        ...(deps.storageError ? { error: deps.storageError } : {}),
      };
    },
  };
}
