import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import type { Session } from '@gonzalvo/contracts';
import { openDatabase } from '@gonzalvo/data';
import { createUuidV7Generator } from '../ids';
import type { BackupPort, Clock, SqlExecutor } from '../ports';
import { createAuthService } from './auth';
import {
  backupDate, backupFileName, createBackupService, createUnavailableBackupService, fileStamp, isDailyDue, isOverdue, selectForDeletion,
} from './backup';

describe('reglas de las copias', () => {
  it('nombre con entorno y fecha, y vuelta a la fecha', () => {
    const name = backupFileName('TALLER', '2026-11-10T17:32:05.123Z');
    expect(name).toBe('gonzalvo-taller-2026-11-10T17-32-05Z.gonzalvo');
    expect(backupDate(name)).toBe('2026-11-10T17:32:05.000Z');
    expect(fileStamp('2026-11-10T17:32:05.123Z')).toBe('2026-11-10T17-32-05Z');
    expect(backupDate('gonzalvo-taller-2026-13-45T99-00-00Z.gonzalvo')).toBeNull();
    expect(backupDate('otra-cosa.gonzalvo')).toBeNull();
  });

  it('aviso a las 48 horas y copia diaria una vez al día', () => {
    expect(isOverdue(null, '2026-11-10T12:00:00Z')).toBe(true);
    expect(isOverdue('2026-11-08T12:00:00Z', '2026-11-10T12:00:00Z')).toBe(false);
    expect(isOverdue('2026-11-08T11:59:00Z', '2026-11-10T12:00:00Z')).toBe(true);
    expect(isDailyDue(null, '2026-11-10T12:00:00Z')).toBe(true);
    expect(isDailyDue('2026-11-10T09:00:00Z', '2026-11-10T12:00:00Z')).toBe(false);
    expect(isDailyDue('2026-11-09T12:00:00Z', '2026-11-10T12:00:00Z')).toBe(true);
  });

  it('conserva una por día del último mes y una por mes del último año', () => {
    const at = (iso: string) => ({ name: iso, createdAt: iso });
    const files = [
      at('2026-11-10T12:00:00Z'), at('2026-11-10T09:00:00Z'), // hoy: dos, se queda la última
      at('2026-11-09T12:00:00Z'),
      at('2026-10-20T12:00:00Z'), // dentro de los 30 días
      at('2026-10-05T12:00:00Z'), at('2026-10-02T12:00:00Z'),
      at('2026-08-31T12:00:00Z'), at('2026-08-01T12:00:00Z'),
      at('2025-01-15T12:00:00Z'), // más de 12 meses
    ];
    expect(selectForDeletion(files, '2026-11-10T12:00:00Z', 30, 12).sort()).toEqual(
      // Octubre conserva la del 20 (la más reciente del mes); agosto, la del 31.
      ['2025-01-15T12:00:00Z', '2026-08-01T12:00:00Z', '2026-10-02T12:00:00Z', '2026-10-05T12:00:00Z', '2026-11-10T09:00:00Z'].sort(),
    );
    // Solo 3 días y 0 meses: quedan hoy y ayer (las de días sin copia no cuentan).
    expect(selectForDeletion(files, '2026-11-10T12:00:00Z', 3, 0)).toHaveLength(files.length - 2);
    // La más nueva nunca se borra, aunque sea antigua.
    expect(selectForDeletion([at('2020-01-01T12:00:00Z')], '2026-11-10T12:00:00Z', 1, 0)).toEqual([]);
  });
});

/** Carpeta de copias simulada en memoria: aquí se prueba la lógica, no Rust. */
function fakePort() {
  const GOOD_KEY = 'AAAAA-BBBBB-CCCCC-DDDDD-EEEEE';
  const state = {
    files: new Map<string, number>(),
    key: null as string | null,
    picked: '/Drive/Gonzalvo' as string | null,
    failWith: null as string | null,
    restoreInfo: { schemaVersion: 3, environment: 'LOCAL' as string | null },
    calls: [] as string[],
  };
  const port: BackupPort = {
    pickFolder: async () => state.picked,
    hasKey: async () => state.key !== null,
    createKey: async () => {
      if (state.key) throw new Error('Ya hay una clave de copias en este ordenador.');
      state.key = GOOD_KEY;
      return GOOD_KEY;
    },
    revealKey: async () => state.key ?? '',
    checkKey: async (_folder, _name, key) => {
      if (key !== GOOD_KEY) throw new Error('La clave no corresponde a esta copia o el archivo está dañado.');
    },
    setKey: async (key) => {
      state.key = key;
    },
    create: async (folder, fileName) => {
      if (state.failWith) throw new Error(state.failWith);
      if (!state.key) throw new Error('Todavía no hay clave de copias en este ordenador.');
      state.files.set(fileName, 1000);
      state.calls.push(`create:${folder}`);
      return { fileName, sizeBytes: 1000, sha256: 'a'.repeat(64) };
    },
    list: async (_folder, prefix) =>
      [...state.files].filter(([n]) => n.startsWith(prefix)).sort(([a], [b]) => b.localeCompare(a)).map(([name, sizeBytes]) => ({ name, sizeBytes })),
    remove: async (_folder, name) => {
      state.files.delete(name);
    },
    prepareRestore: async () => state.restoreInfo,
    cancelRestore: async () => {
      state.calls.push('cancel');
    },
    applyRestore: async (label) => {
      state.calls.push(`apply:${label}`);
      return `local-${label}.db`;
    },
  };
  return { port, state, GOOD_KEY };
}

let now = Date.parse('2026-11-10T12:00:00.000Z');
const clock: Clock = { now: () => new Date(now).toISOString() };
let db: SqlExecutor;
let session: Session | null;
let fake: ReturnType<typeof fakePort>;
let reopened: number;
let backups: ReturnType<typeof createBackupService>;

beforeEach(async () => {
  now = Date.parse('2026-11-10T12:00:00.000Z');
  db = (await openMemoryDatabase()).executor;
  const { schemaVersion } = await openDatabase(db, { environment: 'LOCAL', clock });
  const ids = createUuidV7Generator();
  const auth = createAuthService({ db, hasher: { hash: async (p) => p, verify: async (p, h) => p === h }, clock, ids });
  session = await auth.setupAdmin({ username: 'robert', displayName: 'Robert', password: 'taller2026' });
  fake = fakePort();
  reopened = 0;
  backups = createBackupService({
    db, port: fake.port, clock, ids, session: () => session, environment: 'LOCAL', schemaVersion,
    reopen: async () => {
      reopened++;
    },
  });
});

const actions = async () => (await db.all<{ action: string }>("SELECT action FROM activity_log WHERE entity_type = 'backup' ORDER BY id")).map((r) => r.action);
const configure = async () => {
  await backups.chooseFolder();
  await backups.createKey();
};

describe('servicio de copias', () => {
  it('solo el administrador (config.manage)', async () => {
    if (!session) throw new Error('Falta la sesión de prueba');
    session = { ...session, permissions: ['ordenes.view'] };
    await expect(backups.status()).rejects.toThrow('no tiene permiso');
    await expect(backups.backupNow()).rejects.toThrow('no tiene permiso');
    session = null;
    await expect(backups.list()).rejects.toThrow('sesión ha caducado');
  });

  it('sin configurar: avisa y no copia', async () => {
    const s = await backups.status();
    expect(s).toMatchObject({ available: true, folder: null, hasKey: false, lastOk: null, overdue: true, keepDaily: 30, keepMonthly: 12 });
    await expect(backups.backupNow()).rejects.toThrow('Primero elige la carpeta');
    expect(await backups.runIfDue()).toBeNull();
  });

  it('carpeta, clave y copia manual', async () => {
    await configure();
    const record = await backups.backupNow();
    expect(record).toMatchObject({ kind: 'manual', destination: '/Drive/Gonzalvo', fileName: 'gonzalvo-local-2026-11-10T12-00-00Z.gonzalvo', error: null });
    const s = await backups.status();
    expect(s).toMatchObject({ folder: '/Drive/Gonzalvo', hasKey: true, overdue: false, lastError: null });
    expect(s.lastOk?.id).toBe(record.id);
    expect(await backups.list()).toEqual([{ name: record.fileName, createdAt: '2026-11-10T12:00:00.000Z', sizeBytes: 1000 }]);
    expect(await actions()).toEqual(['backup.folder', 'backup.key_created', 'backup.manual']);
  });

  it('si el selector se cancela no cambia la carpeta', async () => {
    fake.state.picked = null;
    expect((await backups.chooseFolder()).folder).toBeNull();
    expect(await backups.exportCopy()).toBeNull();
    expect(await actions()).toEqual([]);
  });

  it('un fallo queda anotado, se avisa y la siguiente copia correcta lo borra del aviso', async () => {
    await configure();
    fake.state.failWith = 'No se encuentra la carpeta de copias';
    await expect(backups.backupNow()).rejects.toThrow('No se encuentra la carpeta');
    const s = await backups.status();
    expect(s.lastError).toMatchObject({ kind: 'manual', fileName: null, error: 'No se encuentra la carpeta de copias' });
    expect(s.overdue).toBe(true);
    fake.state.failWith = null;
    now += 1000;
    await backups.backupNow();
    expect((await backups.status()).lastError).toBeNull();
    await expect(db.run('DELETE FROM backups')).rejects.toThrow('no se puede borrar');
  });

  it('copia diaria: una al día y aplica la retención', async () => {
    await configure();
    expect(await backups.runIfDue()).toMatchObject({ kind: 'auto' });
    now += 3_600_000;
    expect(await backups.runIfDue()).toBeNull();
    // 40 días seguidos: solo quedan 30 diarias (+ meses anteriores que no caen en ellas).
    for (let i = 0; i < 40; i++) {
      now += 86_400_000;
      expect(await backups.runIfDue()).not.toBeNull();
    }
    const names = [...fake.state.files.keys()];
    expect(names.length).toBeLessThanOrEqual(32);
    expect(names).toContain(backupFileName('LOCAL', clock.now()));
    // La automática no ensucia el registro de actividad.
    expect(await actions()).toEqual(['backup.folder', 'backup.key_created']);
  });

  it('copia a USB: va a otra carpeta y no cuenta como copia de la carpeta de Drive', async () => {
    await configure();
    fake.state.picked = '/USB';
    expect(await backups.exportCopy()).toMatchObject({ kind: 'export', destination: '/USB' });
    expect((await backups.status()).lastOk).toBeNull();
  });

  it('clave de otra instalación: solo si abre la copia más reciente', async () => {
    await backups.chooseFolder();
    await expect(backups.enterKey(fake.GOOD_KEY)).rejects.toThrow('No hay copias en esa carpeta');
    fake.state.files.set('gonzalvo-local-2026-11-01T10-00-00Z.gonzalvo', 10);
    await expect(backups.enterKey('ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ-ZZZZZ')).rejects.toThrow('La clave no corresponde');
    expect(fake.state.key).toBeNull();
    await backups.enterKey(fake.GOOD_KEY);
    expect(fake.state.key).toBe(fake.GOOD_KEY);
  });

  it('restaurar: copia previa, vuelve a abrir y lo anota en la base restaurada', async () => {
    await configure();
    const { fileName } = await backups.backupNow();
    expect(fileName).not.toBeNull();
    await backups.restore(fileName ?? '');
    expect(fake.state.calls).toContain('apply:2026-11-10T12-00-00Z-antes-de-restaurar');
    expect(reopened).toBe(1);
    const row = await db.get<{ changes: string }>("SELECT changes FROM activity_log WHERE action = 'backup.restored'");
    expect(JSON.parse(row?.changes ?? 'null')).toEqual({ fileName, by: 'robert', safetyCopy: 'local-2026-11-10T12-00-00Z-antes-de-restaurar.db' });
  });

  it('no restaura copias de otro entorno ni de una versión más nueva', async () => {
    await configure();
    fake.state.restoreInfo = { schemaVersion: 3, environment: 'TALLER' };
    await expect(backups.restore('gonzalvo-local-2026-11-10T12-00-00Z.gonzalvo')).rejects.toThrow('es de TALLER');
    fake.state.restoreInfo = { schemaVersion: 99, environment: 'LOCAL' };
    await expect(backups.restore('gonzalvo-local-2026-11-10T12-00-00Z.gonzalvo')).rejects.toThrow('versión más nueva');
    expect(fake.state.calls.filter((c) => c === 'cancel')).toHaveLength(2);
    expect(fake.state.calls.some((c) => c.startsWith('apply'))).toBe(false);
    expect(reopened).toBe(0);
  });

  it('en la demo no existen', async () => {
    const demo = createUnavailableBackupService();
    expect(await demo.status()).toMatchObject({ available: false, overdue: false });
    await expect(demo.backupNow()).rejects.toThrow('solo existen en el programa instalado');
  });
});

describe('retención configurable', () => {
  it('dentro de sus límites, anotada y aplicada en la siguiente copia', async () => {
    await configure();
    await expect(backups.setRetention(0, 12)).rejects.toThrow('entre 1 y 366');
    await expect(backups.setRetention(30, 121)).rejects.toThrow('entre 0 y 120');
    expect(await backups.setRetention(3, 0)).toMatchObject({ keepDaily: 3, keepMonthly: 0 });
    for (let i = 0; i < 6; i++) {
      now += 86_400_000;
      await backups.runIfDue();
    }
    expect(fake.state.files.size).toBe(3);
    expect(await actions()).toContain('backup.retention');
  });
});
