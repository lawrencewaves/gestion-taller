import { beforeEach, describe, expect, it } from 'vitest';
import type { Clock, SqlExecutor } from '@gonzalvo/core';
import { PERMISSIONS } from '@gonzalvo/contracts';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import { migrations } from './migrations';
import { checksum, migrate, type Migration, MigrationError } from './migrator';
import { EnvironmentMismatchError, openDatabase } from './open';

const clock: Clock = { now: () => '2026-11-09T22:00:00.000Z' };
const LATEST = migrations.length;
let db: SqlExecutor;

beforeEach(async () => {
  db = (await openMemoryDatabase()).executor;
});

describe('migraciones', () => {
  it('crea el esquema inicial con los datos de referencia', async () => {
    expect(await migrate(db, migrations, { clock })).toBe(LATEST);
    expect(await db.all('SELECT name, rate_bp FROM tax_rates ORDER BY sort_order')).toEqual([
      { name: 'IVA general 21 %', rate_bp: 2100 },
      { name: 'IVA reducido 10 %', rate_bp: 1000 },
      { name: 'IVA superreducido 4 %', rate_bp: 400 },
      { name: 'Exento 0 %', rate_bp: 0 },
    ]);
    expect(await db.all('SELECT name FROM payment_methods ORDER BY sort_order')).toEqual([
      { name: 'Efectivo' }, { name: 'Tarjeta' }, { name: 'Transferencia' },
    ]);
    expect(await db.get('SELECT id, fiscal_mode FROM settings')).toEqual({ id: 1, fiscal_mode: 'off' });
  });

  it('no vuelve a aplicar lo ya aplicado', async () => {
    await migrate(db, migrations, { clock });
    let called = false;
    await migrate(db, migrations, { clock, beforeMigrate: async () => void (called = true) });
    expect(called).toBe(false);
    expect(await db.get('SELECT count(*) AS n FROM schema_migrations')).toEqual({ n: LATEST });
  });

  it('avisa antes de aplicar migraciones pendientes (copia previa en escritorio)', async () => {
    const seen: number[] = [];
    await migrate(db, migrations, { clock, beforeMigrate: async (pending) => void seen.push(...pending.map((m) => m.version)) });
    expect(seen).toEqual(migrations.map((m) => m.version));
  });

  it('se detiene si una migración aplicada ha cambiado', async () => {
    await migrate(db, migrations, { clock });
    const edited: Migration[] = migrations.map((m) => ({ ...m, sql: `${m.sql}\n-- editada` }));
    await expect(migrate(db, edited, { clock })).rejects.toThrow(MigrationError);
  });

  it('se detiene si la base es más nueva que el programa', async () => {
    const extra: Migration[] = [...migrations, { version: LATEST + 1, name: 'prueba', sql: 'CREATE TABLE x (id INTEGER) STRICT;' }];
    await migrate(db, extra, { clock });
    await expect(migrate(db, migrations, { clock })).rejects.toThrow('Actualiza Gonzalvo');
  });

  it('deshace entera una migración que falla a mitad', async () => {
    const broken: Migration[] = [...migrations, { version: LATEST + 1, name: 'rota', sql: 'CREATE TABLE y (id INTEGER) STRICT; INSERT INTO no_existe VALUES (1);' }];
    await expect(migrate(db, broken, { clock })).rejects.toThrow();
    expect(await db.get("SELECT count(*) AS n FROM sqlite_schema WHERE name = 'y'")).toEqual({ n: 0 });
    expect(await db.get('SELECT max(version) AS v FROM schema_migrations')).toEqual({ v: LATEST });
  });

  it('exige numeración correlativa', async () => {
    await expect(migrate(db, [{ version: 2, name: 'x', sql: '' }], { clock })).rejects.toThrow('falta la 1');
  });

  it('calcula la misma suma con saltos de línea de Windows o de Mac', async () => {
    expect(await checksum('a\r\nb')).toBe(await checksum('a\nb'));
  });
});

describe('restricciones del esquema', () => {
  beforeEach(async () => {
    await migrate(db, migrations, { clock });
  });

  it('solo existe una fila de configuración', async () => {
    await expect(db.run("INSERT INTO settings (id, created_at, updated_at) VALUES (2, 'x', 'x')")).rejects.toThrow();
  });

  it('rechaza tipos impositivos fuera de rango y un segundo tipo por defecto', async () => {
    await expect(db.run("INSERT INTO tax_rates (id, name, rate_bp, created_at, updated_at) VALUES ('a', 'Mal', 10001, 'x', 'x')")).rejects.toThrow();
    await expect(db.run("INSERT INTO tax_rates (id, name, rate_bp, is_default, created_at, updated_at) VALUES ('b', 'Otro', 500, 1, 'x', 'x')")).rejects.toThrow();
  });

  it('las tablas son estrictas: no aceptan texto donde va un número', async () => {
    await expect(db.run("UPDATE settings SET backup_keep_daily = 'treinta' WHERE id = 1")).rejects.toThrow();
  });
});

describe('usuarios y permisos (0002)', () => {
  it('solo concede permisos de la lista cerrada', async () => {
    await migrate(db, migrations, { clock });
    const rows = await db.all<{ permission: string }>('SELECT DISTINCT permission FROM role_permissions');
    const known = new Set<string>(PERMISSIONS);
    expect(rows.filter((r) => !known.has(r.permission))).toEqual([]);
    expect(await db.get("SELECT count(*) AS n FROM role_permissions WHERE role = 'admin'")).toEqual({ n: PERMISSIONS.length });
  });

  it('no admite dos usuarios con el mismo nombre aunque cambien las mayúsculas', async () => {
    await migrate(db, migrations, { clock });
    const insert = (id: string, username: string) =>
      db.run("INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, 'X', 'h', 'admin', 'x', 'x')", [id, username]);
    await insert('1', 'Robert');
    await expect(insert('2', 'robert')).rejects.toThrow();
  });
});

describe('apertura y entorno', () => {
  it('registra el entorno la primera vez y lo exige después', async () => {
    expect(await openDatabase(db, { environment: 'DEMO', clock })).toEqual({ schemaVersion: LATEST });
    expect(await db.get('SELECT environment FROM settings')).toEqual({ environment: 'DEMO' });
    await expect(openDatabase(db, { environment: 'TALLER', clock })).rejects.toThrow(EnvironmentMismatchError);
    await expect(openDatabase(db, { environment: 'DEMO', clock })).resolves.toEqual({ schemaVersion: LATEST });
  });
});
