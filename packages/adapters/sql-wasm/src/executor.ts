import type { RunResult, SqlExecutor, SqlParams, SqlValue } from '@gonzalvo/core';
import type { Database } from '@sqlite.org/sqlite-wasm';

type Bind = NonNullable<Parameters<Database['exec']>[0]> extends infer O ? (O extends { bind?: infer B } ? B : never) : never;

/**
 * SqlExecutor sobre una conexión SQLite WASM (solo DEMO, PREVIEW y LOCAL: D-024).
 *
 * SQLite tiene una única conexión y la interfaz puede pedir varias cosas a la vez.
 * Todas las operaciones pasan por una cola: una transacción no se mezcla nunca con
 * otra operación que llegue mientras espera. Las transacciones anidadas usan SAVEPOINT.
 */
export function createWasmExecutor(db: Database): SqlExecutor {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => T | Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };

  const rows = <T>(sql: string, params?: SqlParams): T[] =>
    db.exec({ sql, bind: params as Bind, rowMode: 'object', returnValue: 'resultRows' }) as T[];

  const direct = (savepointDepth: number, isOpen: () => boolean): SqlExecutor => {
    const guard = () => {
      if (!isOpen()) throw new Error('La transacción ya ha terminado: no se puede usar fuera de ella.');
    };
    return {
      async all<T = Record<string, SqlValue>>(sql: string, params?: SqlParams) {
        guard();
        return rows<T>(sql, params);
      },
      async get<T = Record<string, SqlValue>>(sql: string, params?: SqlParams) {
        guard();
        return rows<T>(sql, params)[0];
      },
      async run(sql: string, params?: SqlParams): Promise<RunResult> {
        guard();
        db.exec({ sql, bind: params as Bind });
        return { changes: db.changes() };
      },
      async exec(sql: string) {
        guard();
        db.exec(sql);
      },
      async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) {
        guard();
        return runTransaction(work, savepointDepth + 1);
      },
    };
  };

  async function runTransaction<T>(work: (tx: SqlExecutor) => Promise<T>, depth: number): Promise<T> {
    const savepoint = `sp_${depth}`;
    db.exec(depth === 1 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    let open = true;
    try {
      const result = await work(direct(depth, () => open));
      db.exec(depth === 1 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      db.exec(depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
      throw error;
    } finally {
      open = false;
    }
  }

  const top = direct(0, () => true);
  return {
    all: (sql, params) => enqueue(() => top.all(sql, params)),
    get: (sql, params) => enqueue(() => top.get(sql, params)),
    run: (sql, params) => enqueue(() => top.run(sql, params)),
    exec: (sql) => enqueue(() => top.exec(sql)),
    transaction: (work) => enqueue(() => runTransaction(work, 1)),
  };
}
