/**
 * Web Worker de la demo: aquí se ejecutan la lógica y SQLite (D-024).
 * Al arrancar abre la base del navegador, aplica las migraciones, comprueba el entorno
 * y crea los usuarios de prueba. Cada pestaña tiene su propio Worker y su propia sesión.
 */
import { serve } from '@gonzalvo/adapter-worker-rpc';
import { createPbkdf2Hasher, openBrowserDatabase } from '@gonzalvo/adapter-browser';
import type { AuthService, NewAdmin, Services } from '@gonzalvo/contracts';
import {
  createAuthService, createSystemService, createUnavailableBackupService, createUuidV7Generator, recordOpen, systemClock,
} from '@gonzalvo/core';
import { openDatabase } from '@gonzalvo/data';
import { DEMO_PASSWORD, DEMO_USERS, seedDemoUsers } from '@gonzalvo/seed';
import { appInfo, databaseName } from './env';

declare const self: DedicatedWorkerGlobalScope;

const dbName = databaseName(appInfo);

const services: Promise<Services> = (async () => {
  const { executor: db, storage, storageError } = await openBrowserDatabase(dbName);
  const clock = systemClock;
  const ids = createUuidV7Generator();
  const hasher = createPbkdf2Hasher();
  const { schemaVersion } = await openDatabase(db, { environment: appInfo.environment, clock });
  await recordOpen(db);
  await seedDemoUsers(db, { hasher, ids, clock });

  const auth = createAuthService({
    db, hasher, clock, ids,
    demo: { usernames: DEMO_USERS.map((u) => u.username), password: DEMO_PASSWORD },
  });
  const system = createSystemService({
    db, environment: appInfo.environment, storage, dbName, schemaVersion, session: auth.current, ...(storageError ? { storageError } : {}),
  });
  // Las copias solo existen en el programa instalado (RF-DEM-05).
  return { system, auth, backups: createUnavailableBackupService() };
})();

const auth = async (): Promise<AuthService> => (await services).auth;

serve(self, {
  system: { diagnostics: async () => (await services).system.diagnostics() },
  auth: {
    status: async () => (await auth()).status(),
    setupAdmin: async (input: NewAdmin) => (await auth()).setupAdmin(input),
    login: async (username: string, password: string) => (await auth()).login(username, password),
    logout: async () => (await auth()).logout(),
    session: async () => (await auth()).session(),
  },
  backups: { status: async () => (await services).backups.status() },
});
