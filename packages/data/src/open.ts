import type { Clock, SqlExecutor } from '@gonzalvo/core';
import { migrations as allMigrations } from './migrations';
import { type Migration, type MigrateOptions, migrate } from './migrator';

export type DatabaseEnvironment = 'LOCAL' | 'PREVIEW' | 'DEMO' | 'TALLER';

export class EnvironmentMismatchError extends Error {
  override name = 'EnvironmentMismatchError';
}

/**
 * La base de datos recuerda para qué entorno se creó (DATABASE §2) y se niega a
 * abrirse con otro: una compilación de DEMO nunca toca datos del TALLER, ni al revés.
 */
export async function ensureEnvironment(db: SqlExecutor, environment: DatabaseEnvironment, clock: Clock): Promise<void> {
  const row = await db.get<{ environment: string | null }>('SELECT environment FROM settings WHERE id = 1');
  if (!row) throw new EnvironmentMismatchError('Falta la configuración del taller en la base de datos.');
  if (row.environment === null) {
    await db.run('UPDATE settings SET environment = ?, updated_at = ?, version = version + 1 WHERE id = 1', [environment, clock.now()]);
    return;
  }
  if (row.environment !== environment) {
    throw new EnvironmentMismatchError(`Esta base de datos es de ${row.environment} y este programa es de ${environment}. No se abre para no mezclar datos.`);
  }
}

export interface OpenOptions extends Omit<MigrateOptions, 'clock'> {
  environment: DatabaseEnvironment;
  clock: Clock;
  migrations?: readonly Migration[];
}

/** Secuencia de apertura en cualquier entorno: migrar y comprobar el entorno. Devuelve la versión del esquema. */
export async function openDatabase(db: SqlExecutor, options: OpenOptions): Promise<{ schemaVersion: number }> {
  const { environment, clock, migrations = allMigrations, beforeMigrate } = options;
  const schemaVersion = await migrate(db, migrations, { clock, ...(beforeMigrate ? { beforeMigrate } : {}) });
  await ensureEnvironment(db, environment, clock);
  return { schemaVersion };
}
