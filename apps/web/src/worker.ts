/**
 * Web Worker de la demo: aquí se ejecutan la lógica y SQLite (D-024).
 * Al arrancar abre la base del navegador, aplica las migraciones y comprueba el entorno.
 */
import { serve } from '@gonzalvo/adapter-worker-rpc';
import { openBrowserDatabase } from '@gonzalvo/adapter-sql-wasm';
import type { DiagnosticsReport } from '@gonzalvo/contracts';
import { systemClock } from '@gonzalvo/core';
import { openDatabase } from '@gonzalvo/data';
import { appInfo, databaseName } from './env';

declare const self: DedicatedWorkerGlobalScope;

const dbName = databaseName(appInfo);

const ready = (async () => {
  const connection = await openBrowserDatabase(dbName);
  const { schemaVersion } = await openDatabase(connection.executor, { environment: appInfo.environment, clock: systemClock });
  // Contador de aperturas: demuestra que los datos sobreviven a una recarga.
  await connection.executor.run(
    `INSERT INTO app_meta (key, value) VALUES ('open_count', '1')
     ON CONFLICT (key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)`,
  );
  return { ...connection, schemaVersion };
})();

async function diagnostics(): Promise<DiagnosticsReport> {
  const { executor: db, sqliteVersion, storage, storageError, schemaVersion } = await ready;
  const openCount = async () => Number((await db.get<{ value: string }>("SELECT value FROM app_meta WHERE key = 'open_count'"))?.value ?? 0);
  const opens = await openCount();

  // Una transacción que falla no deja rastro.
  await db
    .transaction(async (tx) => {
      await tx.run("UPDATE app_meta SET value = '-1' WHERE key = 'open_count'");
      throw new Error('deshacer');
    })
    .catch(() => undefined);
  const transactionsOk = (await openCount()) === opens;

  const foreignKeysOk = (await db.get<{ foreign_keys: number }>('PRAGMA foreign_keys'))?.foreign_keys === 1;

  return {
    sqliteVersion, storage, dbName, schemaVersion, opens, transactionsOk, foreignKeysOk,
    ...(storageError ? { error: storageError } : {}),
  };
}

serve(self, {
  system: { diagnostics },
});
