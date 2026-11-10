import type { RunResult, SqlExecutor, SqlParams, SqlValue } from './ports';

/** Lo mínimo que un adaptador tiene que saber hacer con su conexión SQLite. */
export interface SqlDriver {
  all(sql: string, params?: SqlParams): Promise<Record<string, SqlValue>[]>;
  run(sql: string, params?: SqlParams): Promise<RunResult>;
  exec(sql: string): Promise<void>;
}

/**
 * Convierte un driver de una sola conexión en un SqlExecutor seguro (D-008, D-031).
 *
 * La interfaz puede pedir varias cosas a la vez y SQLite tiene una única conexión.
 * Todas las operaciones pasan por una cola: una transacción no se mezcla nunca con
 * otra operación que llegue mientras espera. Las transacciones anidadas usan SAVEPOINT.
 * Lo comparten el navegador (WASM) y el escritorio (Rust).
 */
export function createSerialExecutor(driver: SqlDriver): SqlExecutor {
  let tail: Promise<unknown> = Promise.resolve();
  const enqueue = <T>(work: () => Promise<T>): Promise<T> => {
    const result = tail.then(work);
    tail = result.catch(() => undefined);
    return result;
  };

  const direct = (depth: number, isOpen: () => boolean): SqlExecutor => {
    const guard = () => {
      if (!isOpen()) throw new Error('La transacción ya ha terminado: no se puede usar fuera de ella.');
    };
    return {
      async all<T = Record<string, SqlValue>>(sql: string, params?: SqlParams) {
        guard();
        return (await driver.all(sql, params)) as T[];
      },
      async get<T = Record<string, SqlValue>>(sql: string, params?: SqlParams) {
        guard();
        return (await driver.all(sql, params))[0] as T | undefined;
      },
      async run(sql: string, params?: SqlParams) {
        guard();
        return driver.run(sql, params);
      },
      async exec(sql: string) {
        guard();
        await driver.exec(sql);
      },
      async transaction<T>(work: (tx: SqlExecutor) => Promise<T>) {
        guard();
        return runTransaction(work, depth + 1);
      },
    };
  };

  async function runTransaction<T>(work: (tx: SqlExecutor) => Promise<T>, depth: number): Promise<T> {
    const savepoint = `sp_${depth}`;
    await driver.exec(depth === 1 ? 'BEGIN IMMEDIATE' : `SAVEPOINT ${savepoint}`);
    let open = true;
    try {
      const result = await work(direct(depth, () => open));
      await driver.exec(depth === 1 ? 'COMMIT' : `RELEASE ${savepoint}`);
      return result;
    } catch (error) {
      await driver.exec(depth === 1 ? 'ROLLBACK' : `ROLLBACK TO ${savepoint}; RELEASE ${savepoint}`);
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
