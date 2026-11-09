/**
 * Web Worker de la demo: aquí se ejecutan la lógica y SQLite (D-024).
 * Paso 2 de la Fase 4: solo la prueba técnica de almacenamiento. Las migraciones
 * y los repositorios llegan en el paso 4, dentro de packages/data.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { serve } from '@gonzalvo/adapter-worker-rpc';
import type { DiagnosticsReport } from '@gonzalvo/contracts';
import { appInfo, databaseName } from './env';

declare const self: DedicatedWorkerGlobalScope;

async function diagnostics(): Promise<DiagnosticsReport> {
  const dbName = databaseName(appInfo);
  const sqlite3 = await sqlite3InitModule();
  let storage: DiagnosticsReport['storage'] = 'memory';
  let error: string | undefined;
  let db;
  try {
    // La variante «SAH pool» no necesita cabeceras especiales del servidor (GitHub Pages no las permite).
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'gonzalvo' });
    db = new pool.OpfsSAHPoolDb(`/${dbName}`);
    storage = 'opfs';
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
    db = new sqlite3.oo1.DB(':memory:', 'c');
  }

  db.exec('PRAGMA foreign_keys = ON');
  db.exec('CREATE TABLE IF NOT EXISTS diag_opens (id INTEGER PRIMARY KEY, opened_at TEXT NOT NULL)');
  db.exec({ sql: 'INSERT INTO diag_opens (opened_at) VALUES (?)', bind: [new Date().toISOString()] });
  const opens = Number(db.selectValue('SELECT count(*) FROM diag_opens'));

  // Una transacción deshecha no deja rastro.
  db.exec('BEGIN');
  db.exec({ sql: 'INSERT INTO diag_opens (opened_at) VALUES (?)', bind: ['rollback'] });
  db.exec('ROLLBACK');
  const transactionsOk = Number(db.selectValue('SELECT count(*) FROM diag_opens')) === opens;

  // Las claves foráneas impiden guardar una fila huérfana.
  db.exec('CREATE TEMP TABLE diag_parent (id INTEGER PRIMARY KEY); CREATE TEMP TABLE diag_child (parent_id INTEGER NOT NULL REFERENCES diag_parent(id));');
  let foreignKeysOk = false;
  try {
    db.exec('INSERT INTO diag_child (parent_id) VALUES (999)');
  } catch {
    foreignKeysOk = true;
  }
  db.exec('DROP TABLE temp.diag_child; DROP TABLE temp.diag_parent;');

  return {
    sqliteVersion: sqlite3.version.libVersion,
    storage,
    dbName,
    opens,
    transactionsOk,
    foreignKeysOk,
    ...(error ? { error } : {}),
  };
}

let report: Promise<DiagnosticsReport> | undefined;

serve(self, {
  system: { diagnostics: () => (report ??= diagnostics()) },
});
