/**
 * Composición del escritorio (ARCHITECTURE §1, §6): la lógica se ejecuta aquí,
 * en la propia aplicación, y SQLite en Rust por IPC.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { invoke } from '@tauri-apps/api/core';
import {
  createTauriBackupPort, createTauriExecutor, createTauriPasswordHasher, createTauriUpdatePort, openTauriDatabase, takeLocalSnapshot,
} from '@gonzalvo/adapter-tauri';
import type { AppInfo, Capabilities, Environment, Services } from '@gonzalvo/contracts';
import {
  createAuthService, createBackupService, createSystemService, createUpdateService, createUsersService, createUuidV7Generator, createWorkshopService,
  fileStamp, recordOpen, systemClock,
} from '@gonzalvo/core';
import { migrations, openDatabase } from '@gonzalvo/data';
import { App } from '@gonzalvo/ui';

/**
 * Las compilaciones de prueba son LOCAL (datos ficticios, local.db).
 * Solo una versión publicada con etiqueta vX.Y.Z se compila como TALLER (taller.db).
 * La base recuerda su entorno: una nunca abre la otra (D-031).
 */
const environment: Environment = import.meta.env.VITE_ENV === 'TALLER' ? 'TALLER' : 'LOCAL';
const info: AppInfo = { environment, version: (import.meta.env.VITE_VERSION as string | undefined) ?? 'dev' };
const fileName = environment === 'TALLER' ? 'taller.db' : 'local.db';

const capabilities: Capabilities = { backups: true, directPrint: true, demoReset: environment !== 'TALLER' };

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Falta el elemento #root en index.html');
const root = createRoot(rootEl);

/** Cada cuánto se mira si toca la copia diaria mientras el programa está abierto. */
const BACKUP_CHECK_MS = 60 * 60 * 1000;

async function start(): Promise<Services> {
  await openTauriDatabase(invoke, fileName);
  const db = createTauriExecutor(invoke);
  const clock = systemClock;
  const ids = createUuidV7Generator();
  const migrate = () =>
    openDatabase(db, {
      environment,
      clock,
      // Antes de cambiar el esquema de una base con datos, copia local del estado actual (RNF-08).
      beforeMigrate: async (pending) => {
        if (pending.length === migrations.length) return; // Base nueva: no hay nada que guardar.
        const target = pending[pending.length - 1]?.version ?? 0;
        await takeLocalSnapshot(invoke, `${fileStamp(clock.now())}-antes-de-migrar-v${target}`);
      },
    });
  const { schemaVersion } = await migrate();
  await recordOpen(db);
  // En el escritorio no hay usuarios de prueba: la primera vez se crea el administrador.
  const hasher = createTauriPasswordHasher(invoke);
  const auth = createAuthService({ db, hasher, clock, ids });
  const system = createSystemService({ db, environment, storage: 'native', dbName: fileName, schemaVersion, session: auth.current });
  const backups = createBackupService({
    db, port: createTauriBackupPort(invoke), clock, ids, session: auth.current, environment, schemaVersion,
    reopen: async () => {
      await openTauriDatabase(invoke, fileName);
      await migrate();
    },
  });
  // Copia diaria (RF-BAK-01): al arrancar y cada hora mientras el programa está abierto.
  void backups.runIfDue();
  window.setInterval(() => void backups.runIfDue(), BACKUP_CHECK_MS);
  const updates = createUpdateService({ port: createTauriUpdatePort(invoke), session: auth.current });
  const workshop = createWorkshopService({ db, clock, ids, session: auth.current });
  const users = createUsersService({ db, hasher, clock, ids, session: auth.current });
  return { system, auth, backups, updates, workshop, users };
}

start().then(
  (services) =>
    root.render(
      <StrictMode>
        <App services={services} info={info} capabilities={capabilities} />
      </StrictMode>,
    ),
  (error: unknown) => {
    // Sin base de datos no se arranca: se explica por qué en lugar de mostrar una ventana vacía.
    const message = error instanceof Error ? error.message : String(error);
    root.render(
      <main style={{ padding: 32, fontFamily: 'system-ui, sans-serif', maxWidth: 640 }}>
        <h1 style={{ fontSize: 22 }}>Gonzalvo no ha podido abrir sus datos</h1>
        <p>{message}</p>
        <p>Cierra el programa y vuelve a abrirlo. Si el problema sigue, no borres nada y avisa a Robert.</p>
      </main>,
    );
  },
);
