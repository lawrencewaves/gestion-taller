/**
 * Web Worker de la demo: aquí se ejecutan la lógica y SQLite (D-024).
 * Al arrancar abre la base del navegador, aplica las migraciones y comprueba el entorno.
 */
import { serve } from '@gonzalvo/adapter-worker-rpc';
import { openBrowserDatabase } from '@gonzalvo/adapter-sql-wasm';
import type { SystemService } from '@gonzalvo/contracts';
import { createSystemService, recordOpen, systemClock } from '@gonzalvo/core';
import { openDatabase } from '@gonzalvo/data';
import { appInfo, databaseName } from './env';

declare const self: DedicatedWorkerGlobalScope;

const dbName = databaseName(appInfo);

const system: Promise<SystemService> = (async () => {
  const { executor: db, storage, storageError } = await openBrowserDatabase(dbName);
  const { schemaVersion } = await openDatabase(db, { environment: appInfo.environment, clock: systemClock });
  await recordOpen(db);
  return createSystemService({ db, storage, dbName, schemaVersion, ...(storageError ? { storageError } : {}) });
})();

serve(self, {
  system: { diagnostics: async () => (await system).diagnostics() },
});
