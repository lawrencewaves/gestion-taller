import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import { openDatabase } from '@gonzalvo/data';
import type { Clock, PasswordHasher, SqlExecutor } from '../ports';
import { createUuidV7Generator } from '../ids';
import { AuthError, createAuthService, LOCK_MINUTES, MAX_FAILED_ATTEMPTS, requirePermission } from './auth';

/** Cifrado falso y rápido: aquí se prueba la lógica, no el algoritmo. */
const hasher: PasswordHasher = {
  hash: async (p) => `fake:${p}`,
  verify: async (p, h) => h === `fake:${p}`,
};

let now = Date.parse('2026-11-10T12:00:00.000Z');
const clock: Clock = { now: () => new Date(now).toISOString() };
let db: SqlExecutor;
let auth: ReturnType<typeof createAuthService>;

beforeEach(async () => {
  now = Date.parse('2026-11-10T12:00:00.000Z');
  db = (await openMemoryDatabase()).executor;
  await openDatabase(db, { environment: 'LOCAL', clock });
  auth = createAuthService({ db, hasher, clock, ids: createUuidV7Generator() });
});

const admin = { username: 'robert', displayName: 'Robert', password: 'taller2026' };
const actions = async () => (await db.all<{ action: string }>('SELECT action FROM activity_log ORDER BY id')).map((r) => r.action);

describe('primer administrador', () => {
  it('pide crearlo mientras no hay usuarios y abre sesión al crearlo', async () => {
    expect(await auth.status()).toEqual({ needsSetup: true });
    const s = await auth.setupAdmin(admin);
    expect(s).toMatchObject({ username: 'robert', displayName: 'Robert', role: 'admin' });
    expect(s.permissions).toContain('users.manage');
    expect(await auth.status()).toEqual({ needsSetup: false });
    expect(await auth.session()).toEqual(s);
    expect(await actions()).toEqual(['user.create']);
  });

  it('solo se puede crear una vez', async () => {
    await auth.setupAdmin(admin);
    await expect(auth.setupAdmin({ ...admin, username: 'otro' })).rejects.toThrow('Ya existe un administrador');
  });

  it('valida usuario y contraseña', async () => {
    await expect(auth.setupAdmin({ ...admin, username: 'r b' })).rejects.toThrow(AuthError);
    await expect(auth.setupAdmin({ ...admin, password: 'corta' })).rejects.toThrow('al menos 8');
    await expect(auth.setupAdmin({ ...admin, password: 'ROBERTxx', username: 'robertxx' })).rejects.toThrow('igual que el usuario');
    await expect(auth.setupAdmin({ ...admin, displayName: '  ' })).rejects.toThrow('nombre');
  });

  it('nunca guarda la contraseña en claro', async () => {
    await auth.setupAdmin(admin);
    expect(await db.get('SELECT password_hash FROM users')).toEqual({ password_hash: 'fake:taller2026' });
  });
});

describe('inicio de sesión', () => {
  beforeEach(async () => {
    await auth.setupAdmin(admin);
    await auth.logout();
  });

  it('entra con usuario sin distinguir mayúsculas y registra la entrada', async () => {
    const s = await auth.login('  ROBERT ', 'taller2026');
    expect(s.username).toBe('robert');
    expect(await actions()).toEqual(['user.create', 'auth.logout', 'auth.login']);
  });

  it('da el mismo mensaje si el usuario no existe o la contraseña falla', async () => {
    await expect(auth.login('nadie', 'x')).rejects.toThrow('Usuario o contraseña incorrectos.');
    await expect(auth.login('robert', 'mal')).rejects.toThrow('Usuario o contraseña incorrectos.');
    expect(await auth.session()).toBeNull();
  });

  it(`bloquea ${LOCK_MINUTES} minutos tras ${MAX_FAILED_ATTEMPTS} intentos fallidos`, async () => {
    for (let i = 1; i < MAX_FAILED_ATTEMPTS; i++) await expect(auth.login('robert', 'mal')).rejects.toThrow('incorrectos');
    await expect(auth.login('robert', 'mal')).rejects.toThrow('Vuelve a probar a las');
    // Ni con la contraseña buena mientras dura el bloqueo.
    await expect(auth.login('robert', 'taller2026')).rejects.toThrow('Demasiados intentos');
    now += LOCK_MINUTES * 60_000 + 1000;
    await expect(auth.login('robert', 'taller2026')).resolves.toMatchObject({ username: 'robert' });
    expect(await db.get('SELECT failed_attempts, locked_until FROM users')).toEqual({ failed_attempts: 0, locked_until: null });
    expect(await actions()).toContain('auth.locked');
  });

  it('un acierto pone a cero los intentos fallidos', async () => {
    await expect(auth.login('robert', 'mal')).rejects.toThrow();
    await auth.login('robert', 'taller2026');
    expect(await db.get('SELECT failed_attempts FROM users')).toEqual({ failed_attempts: 0 });
  });

  it('no deja entrar a un usuario desactivado', async () => {
    await db.run('UPDATE users SET active = 0');
    await expect(auth.login('robert', 'taller2026')).rejects.toThrow('desactivado');
  });
});

describe('permisos', () => {
  it('cada rol recibe los permisos iniciales de UX §3', async () => {
    await auth.setupAdmin(admin);
    const ids = createUuidV7Generator();
    for (const role of ['recepcion', 'mecanico'] as const) {
      await db.run(
        "INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, 'fake:clave1234', ?, 'x', 'x')",
        [ids.next(), role, role, role],
      );
    }
    const rec = await auth.login('recepcion', 'clave1234');
    expect(rec.permissions).toContain('facturas.emit');
    expect(rec.permissions).not.toContain('users.manage');
    const mec = await auth.login('mecanico', 'clave1234');
    expect(mec.permissions).toContain('ordenes.edit');
    expect(mec.permissions).not.toContain('facturas.edit');
  });

  it('requirePermission exige sesión y permiso', async () => {
    expect(() => requirePermission(null, 'clientes.view')).toThrow('Vuelve a entrar');
    const s = await auth.setupAdmin(admin);
    expect(requirePermission(s, 'users.manage')).toBe(s);
    expect(() => requirePermission({ ...s, permissions: [] }, 'users.manage')).toThrow('no tiene permiso');
  });
});

describe('registro de actividad', () => {
  it('no se puede modificar ni borrar, ni borrar usuarios', async () => {
    await auth.setupAdmin(admin);
    await expect(db.run("UPDATE activity_log SET action = 'x'")).rejects.toThrow('no se puede modificar');
    await expect(db.run('DELETE FROM activity_log')).rejects.toThrow('no se puede borrar');
    await expect(db.run('DELETE FROM users')).rejects.toThrow('se desactivan');
  });
});
