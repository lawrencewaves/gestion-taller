import { describe, expect, it } from 'vitest';
import { createTauriExecutor, type Invoke, serializeParams } from './index';

describe('adaptador de escritorio', () => {
  it('convierte los parámetros a JSON antes de enviarlos a Rust', () => {
    expect(serializeParams([1, 'a', null, 5n, new Uint8Array([0, 255])])).toEqual([1, 'a', null, 5, [0, 255]]);
    expect(serializeParams({ $id: 7n })).toEqual({ $id: 7 });
    expect(serializeParams()).toBeNull();
    expect(() => serializeParams([2n ** 60n])).toThrow(RangeError);
  });

  it('envía cada operación al comando Rust que le corresponde, en orden', async () => {
    const calls: [string, unknown][] = [];
    const invoke: Invoke = async (command, args) => {
      calls.push([command, args]);
      if (command === 'sql_all') return [{ n: 1 }];
      if (command === 'sql_run') return { changes: 1 };
      return null;
    };
    const db = createTauriExecutor(invoke);
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t VALUES (?)', [1]);
      expect(await tx.get('SELECT 1 AS n')).toEqual({ n: 1 });
    });
    expect(calls).toEqual([
      ['sql_exec', { sql: 'BEGIN IMMEDIATE' }],
      ['sql_run', { sql: 'INSERT INTO t VALUES (?)', params: [1] }],
      ['sql_all', { sql: 'SELECT 1 AS n', params: null }],
      ['sql_exec', { sql: 'COMMIT' }],
    ]);
  });
});
