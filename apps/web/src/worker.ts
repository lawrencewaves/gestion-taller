/**
 * Web Worker de la demo: aquí se ejecutan la lógica y SQLite (D-024).
 * Al arrancar abre la base del navegador, aplica las migraciones, comprueba el entorno
 * y crea los usuarios de prueba. Cada pestaña tiene su propio Worker y su propia sesión.
 */
import { serve } from '@gonzalvo/adapter-worker-rpc';
import { createPbkdf2Hasher, openBrowserDatabase } from '@gonzalvo/adapter-browser';
import type {
  AuthService, NewAdmin, NewUser, Permission, Role, SeriesInput, Services, UserUpdate, WorkshopInput,
} from '@gonzalvo/contracts';
import {
  createAuthService, createBillingService, createSystemService, createUnavailableBackupService, createUnavailableUpdateService, createUuidV7Generator,
  createUsersService, createWorkshopService, recordOpen, systemClock,
} from '@gonzalvo/core';
import { openDatabase } from '@gonzalvo/data';
import { DEMO_PASSWORD, DEMO_USERS, seedDemoUsers, seedDemoWorkshop } from '@gonzalvo/seed';
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
  await seedDemoWorkshop(db, { clock });

  const auth = createAuthService({
    db, hasher, clock, ids,
    demo: { usernames: DEMO_USERS.map((u) => u.username), password: DEMO_PASSWORD },
  });
  const system = createSystemService({
    db, environment: appInfo.environment, storage, dbName, schemaVersion, session: auth.current, ...(storageError ? { storageError } : {}),
  });
  // Las copias solo existen en el programa instalado (RF-DEM-05).
  const workshop = createWorkshopService({ db, clock, ids, session: auth.current });
  const users = createUsersService({ db, hasher, clock, ids, session: auth.current });
  const billing = createBillingService({ db, clock, ids, session: auth.current });
  return { system, auth, workshop, users, billing, backups: createUnavailableBackupService(), updates: createUnavailableUpdateService() };
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
  updates: { check: async () => (await services).updates.check() },
  workshop: {
    get: async () => (await services).workshop.get(),
    update: async (input: WorkshopInput) => (await services).workshop.update(input),
  },
  users: {
    list: async () => (await services).users.list(),
    create: async (input: NewUser) => (await services).users.create(input),
    update: async (input: UserUpdate) => (await services).users.update(input),
    resetPassword: async (id: string, password: string) => (await services).users.resetPassword(id, password),
    changeOwnPassword: async (current: string, next: string) => (await services).users.changeOwnPassword(current, next),
    rolePermissions: async () => (await services).users.rolePermissions(),
    setRolePermissions: async (role: Role, permissions: Permission[]) => (await services).users.setRolePermissions(role, permissions),
    idleMinutes: async () => (await services).users.idleMinutes(),
    setIdleMinutes: async (minutes: number) => (await services).users.setIdleMinutes(minutes),
  },
  billing: {
    series: async () => (await services).billing.series(),
    saveSeries: async (input: SeriesInput) => (await services).billing.saveSeries(input),
    taxRates: async () => (await services).billing.taxRates(),
    addTaxRate: async (input: { name: string; percent: string }) => (await services).billing.addTaxRate(input),
    updateTaxRate: async (input: { id: string; active: boolean; isDefault: boolean; version: number }) => (await services).billing.updateTaxRate(input),
    paymentMethods: async () => (await services).billing.paymentMethods(),
    addPaymentMethod: async (input: { name: string }) => (await services).billing.addPaymentMethod(input),
    updatePaymentMethod: async (input: { id: string; active: boolean; version: number }) => (await services).billing.updatePaymentMethod(input),
  },
});
