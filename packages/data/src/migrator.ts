import { type Clock, type SqlExecutor, webCrypto } from '@gonzalvo/core';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export class MigrationError extends Error {
  override name = 'MigrationError';
}

interface AppliedRow {
  version: number;
  name: string;
  checksum: string;
}

/** SHA-256 del texto con saltos de línea normalizados: el mismo en Windows, macOS y Linux. */
export async function checksum(sql: string): Promise<string> {
  const bytes = new TextEncoder().encode(sql.replace(/\r\n/g, '\n'));
  const digest = await webCrypto().subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function assertSequence(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) throw new MigrationError(`Las migraciones deben numerarse 1, 2, 3…: falta la ${i + 1}`);
  });
}

export interface MigrateOptions {
  clock: Clock;
  /** Se llama antes de aplicar migraciones pendientes; en escritorio hace la copia de seguridad previa (RNF-08). */
  beforeMigrate?: (pending: readonly Migration[]) => Promise<void>;
}

/**
 * Aplica las migraciones pendientes, cada una en su propia transacción, y devuelve la versión del esquema.
 * Se detiene si una migración aplicada ha cambiado o si la base es más nueva que el programa.
 */
export async function migrate(db: SqlExecutor, migrations: readonly Migration[], options: MigrateOptions): Promise<number> {
  assertSequence(migrations);
  await db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    checksum   TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`);

  const applied = await db.all<AppliedRow>('SELECT version, name, checksum FROM schema_migrations ORDER BY version');
  const latestKnown = migrations.length;
  for (const row of applied) {
    const known = migrations[row.version - 1];
    if (!known) {
      throw new MigrationError(`La base de datos está en la versión ${row.version} y este programa solo conoce hasta la ${latestKnown}. Actualiza Gonzalvo.`);
    }
    if ((await checksum(known.sql)) !== row.checksum) {
      throw new MigrationError(`La migración ${row.name} ha cambiado después de aplicarse. Las migraciones publicadas no se editan.`);
    }
  }

  const pending = migrations.slice(applied.length);
  if (pending.length > 0 && options.beforeMigrate) await options.beforeMigrate(pending);

  for (const m of pending) {
    const sum = await checksum(m.sql);
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.run('INSERT INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)', [
        m.version, m.name, sum, options.clock.now(),
      ]);
    });
  }
  return latestKnown;
}
