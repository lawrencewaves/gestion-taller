import { createSerialExecutor, type SqlExecutor, type SqlParams, type SqlValue } from '@gonzalvo/core';
import type { Database } from '@sqlite.org/sqlite-wasm';

type Bind = NonNullable<Parameters<Database['exec']>[0]> extends infer O ? (O extends { bind?: infer B } ? B : never) : never;

/** SqlExecutor sobre una conexión SQLite WASM (solo DEMO, PREVIEW y LOCAL: D-024). */
export function createWasmExecutor(db: Database): SqlExecutor {
  return createSerialExecutor({
    async all(sql: string, params?: SqlParams) {
      return db.exec({ sql, bind: params as Bind, rowMode: 'object', returnValue: 'resultRows' }) as Record<string, SqlValue>[];
    },
    async run(sql: string, params?: SqlParams) {
      db.exec({ sql, bind: params as Bind });
      return { changes: db.changes() };
    },
    async exec(sql: string) {
      db.exec(sql);
    },
  });
}
