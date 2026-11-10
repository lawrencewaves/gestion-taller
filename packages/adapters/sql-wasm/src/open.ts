import type { SqlExecutor } from '@gonzalvo/core';
import sqlite3InitModule, { type Database } from '@sqlite.org/sqlite-wasm';
import { createWasmExecutor } from './executor';

export interface WasmConnection {
  executor: SqlExecutor;
  sqliteVersion: string;
  /** `opfs`: persistente en el navegador. `memory`: se pierde al cerrar. */
  storage: 'opfs' | 'memory';
  /** Motivo por el que no se pudo usar el almacenamiento persistente. */
  storageError?: string;
}

/** El motor se inicializa una sola vez por Worker o proceso: una segunda inicialización deja conexiones sin sistema de archivos. */
let engine: ReturnType<typeof sqlite3InitModule> | undefined;
const loadEngine = () => (engine ??= sqlite3InitModule());

function configure(db: Database): Database {
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

/**
 * Abre la base en el almacenamiento persistente del navegador (OPFS, variante SAH pool,
 * que no necesita cabeceras especiales del servidor). Si no está disponible, trabaja
 * en memoria y lo indica. Debe llamarse desde un Web Worker.
 */
export async function openBrowserDatabase(fileName: string): Promise<WasmConnection> {
  const sqlite3 = await loadEngine();
  const sqliteVersion = sqlite3.version.libVersion;
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'gonzalvo' });
    const db = configure(new pool.OpfsSAHPoolDb(`/${fileName}`));
    return { executor: createWasmExecutor(db), sqliteVersion, storage: 'opfs' };
  } catch (error) {
    const db = configure(new sqlite3.oo1.DB(':memory:', 'c'));
    return {
      executor: createWasmExecutor(db),
      sqliteVersion,
      storage: 'memory',
      storageError: error instanceof Error ? error.message : String(error),
    };
  }
}

/** Base en memoria: pruebas automáticas y entornos sin almacenamiento. */
export async function openMemoryDatabase(): Promise<WasmConnection> {
  const sqlite3 = await loadEngine();
  const db = configure(new sqlite3.oo1.DB(':memory:', 'c'));
  return { executor: createWasmExecutor(db), sqliteVersion: sqlite3.version.libVersion, storage: 'memory' };
}
