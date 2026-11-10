import { beforeEach, describe, expect, it } from 'vitest';
import type { SqlExecutor } from '@gonzalvo/core';
import { openMemoryDatabase } from './open';

let db: SqlExecutor;

beforeEach(async () => {
  db = (await openMemoryDatabase()).executor;
  await db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
});

const count = async () => (await db.get<{ n: number }>('SELECT count(*) AS n FROM t'))?.n;

describe('SqlExecutor WASM', () => {
  it('lee y escribe con parámetros por posición y por nombre', async () => {
    expect(await db.run('INSERT INTO t (name) VALUES (?)', ['Marta'])).toEqual({ changes: 1 });
    await db.run('INSERT INTO t (name) VALUES ($name)', { $name: 'Jordi' });
    expect(await db.all<{ name: string }>('SELECT name FROM t ORDER BY id')).toEqual([{ name: 'Marta' }, { name: 'Jordi' }]);
    expect(await db.get('SELECT name FROM t WHERE id = ?', [99])).toBeUndefined();
  });

  it('confirma una transacción completa y deshace una que falla', async () => {
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (name) VALUES (?)', ['a']);
      await tx.run('INSERT INTO t (name) VALUES (?)', ['b']);
    });
    await expect(
      db.transaction(async (tx) => {
        await tx.run('INSERT INTO t (name) VALUES (?)', ['c']);
        throw new Error('fallo a mitad');
      }),
    ).rejects.toThrow('fallo a mitad');
    expect(await count()).toBe(2);
  });

  it('no mezcla una operación externa dentro de una transacción en curso', async () => {
    const order: string[] = [];
    const tx = db.transaction(async (t) => {
      await t.run('INSERT INTO t (name) VALUES (?)', ['dentro']);
      order.push('tx-inicio');
      await new Promise((r) => setTimeout(r, 20));
      order.push('tx-fin');
      throw new Error('deshacer');
    });
    const outside = db.run('INSERT INTO t (name) VALUES (?)', ['fuera']).then(() => order.push('fuera'));
    await expect(tx).rejects.toThrow('deshacer');
    await outside;
    expect(order).toEqual(['tx-inicio', 'tx-fin', 'fuera']);
    expect(await db.all('SELECT name FROM t')).toEqual([{ name: 'fuera' }]);
  });

  it('deshace solo la parte anidada que falla', async () => {
    await db.transaction(async (tx) => {
      await tx.run('INSERT INTO t (name) VALUES (?)', ['exterior']);
      await expect(
        tx.transaction(async (inner) => {
          await inner.run('INSERT INTO t (name) VALUES (?)', ['interior']);
          throw new Error('interior falla');
        }),
      ).rejects.toThrow();
    });
    expect(await db.all('SELECT name FROM t')).toEqual([{ name: 'exterior' }]);
  });

  it('impide usar una transacción ya terminada', async () => {
    const leaked = await db.transaction(async (tx) => tx);
    await expect(leaked.run('INSERT INTO t (name) VALUES (?)', ['tarde'])).rejects.toThrow('La transacción ya ha terminado');
  });

  it('activa las claves foráneas', async () => {
    expect(await db.get('PRAGMA foreign_keys')).toEqual({ foreign_keys: 1 });
  });
});
