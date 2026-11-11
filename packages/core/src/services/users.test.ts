import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import type { Session } from '@gonzalvo/contracts';
import { openDatabase } from '@gonzalvo/data';
import { createUuidV7Generator } from '../ids';
import type { PasswordHasher, SqlExecutor } from '../ports';
import { systemClock } from '../ports';
import { createAuthService } from './auth';
import { createUsersService, normalizeRolePermissions } from './users';

const hasher: PasswordHasher = { hash: async (p) => `h:${p}`, verify: async (p, h) => h === `h:${p}` };

let db: SqlExecutor;
let session: Session | null;
let auth: ReturnType<typeof createAuthService>;
let users: ReturnType<typeof createUsersService>;

beforeEach(async () => {
  db = (await openMemoryDatabase()).executor;
  await openDatabase(db, { environment: 'LOCAL', clock: systemClock });
  const ids = createUuidV7Generator();
  auth = createAuthService({ db, hasher, clock: systemClock, ids });
  session = await auth.setupAdmin({ username: 'robert', displayName: 'Robert', password: 'taller2026' });
  users = createUsersService({ db, hasher, clock: systemClock, ids, session: () => session });
});

const newMechanic = () => users.create({ username: 'jordi', displayName: ' Jordi  Puig ', role: 'mecanico', password: 'motor1234' });

describe('permisos coherentes por rol', () => {
  it('quien edita ve, emitir exige editar y la administración no se reparte', () => {
    expect(normalizeRolePermissions(['facturas.emit', 'ordenes.edit', 'users.manage', 'config.manage'])).toEqual([
      'ordenes.view', 'ordenes.edit', 'facturas.view', 'facturas.edit', 'facturas.emit',
    ]);
  });
});

describe('usuarios', () => {
  it('crea, lista y el nuevo usuario entra con su contraseña', async () => {
    const r = await newMechanic();
    expect(r.ok && r.value).toMatchObject({ username: 'jordi', displayName: 'Jordi Puig', role: 'mecanico', active: true, locked: false });
    expect((await users.list()).map((u) => u.username)).toEqual(['jordi', 'robert']);
    const s = await auth.login('JORDI', 'motor1234');
    expect(s.role).toBe('mecanico');
    expect(s.idleMinutes).toBe(30);
  });

  it('errores de formulario: nombre repetido, contraseña corta o igual al usuario', async () => {
    await newMechanic();
    const r = await users.create({ username: 'Jordi', displayName: '', role: 'mecanico', password: 'jordi' });
    expect(!r.ok && Object.keys(r.fieldErrors).sort()).toEqual(['displayName', 'password', 'username']);
  });

  it('desactivar impide entrar; nunca se queda el taller sin administrador', async () => {
    const created = await newMechanic();
    if (!created.ok || !session) throw new Error('Preparación fallida');
    const j = created.value;
    const off = await users.update({ id: j.id, displayName: j.displayName, role: j.role, active: false, version: j.version });
    expect(off.ok && off.value.active).toBe(false);
    await expect(auth.login('jordi', 'motor1234')).rejects.toThrow('desactivado');

    const me = (await users.list()).find((u) => u.id === session?.userId);
    if (!me) throw new Error('Falta el administrador');
    const selfOff = await users.update({ id: me.id, displayName: me.displayName, role: 'admin', active: false, version: me.version });
    expect(!selfOff.ok && selfOff.fieldErrors.active).toContain('propio usuario');
    const selfDemote = await users.update({ id: me.id, displayName: me.displayName, role: 'recepcion', active: true, version: me.version });
    expect(!selfDemote.ok && selfDemote.fieldErrors.role).toContain('administrador');
  });

  it('otro administrador puede irse, pero no el último', async () => {
    const other = await users.create({ username: 'marta', displayName: 'Marta', role: 'admin', password: 'oficina2026' });
    if (!other.ok || !session) throw new Error('Preparación fallida');
    const demoted = await users.update({ id: other.value.id, displayName: 'Marta', role: 'recepcion', active: true, version: other.value.version });
    expect(demoted.ok).toBe(true);
    // Ahora Robert es el único administrador; si entra Marta (recepción), no puede tocarlo: no tiene users.manage.
    session = await auth.login('marta', 'oficina2026');
    await expect(users.list()).rejects.toThrow('no tiene permiso');
  });

  it('no pisa cambios de otra persona', async () => {
    const created = await newMechanic();
    if (!created.ok) throw new Error('Preparación fallida');
    const j = created.value;
    expect((await users.update({ ...j, displayName: 'Jordi P.' })).ok).toBe(true);
    const stale = await users.update({ ...j, displayName: 'Otro' });
    expect(!stale.ok && stale.error).toContain('Otra persona');
  });

  it('contraseña nueva puesta por el administrador desbloquea; la propia exige la actual', async () => {
    const created = await newMechanic();
    if (!created.ok) throw new Error('Preparación fallida');
    for (let i = 0; i < 5; i++) await auth.login('jordi', 'mal').catch(() => undefined);
    expect((await users.list()).find((u) => u.username === 'jordi')?.locked).toBe(true);
    expect((await users.resetPassword(created.value.id, 'corta')).ok).toBe(false);
    expect((await users.resetPassword(created.value.id, 'nueva-2026')).ok).toBe(true);
    expect((await users.list()).find((u) => u.username === 'jordi')?.locked).toBe(false);

    session = await auth.login('jordi', 'nueva-2026');
    const wrong = await users.changeOwnPassword('mal', 'otra-2026');
    expect(!wrong.ok && wrong.fieldErrors.currentPassword).toBeTruthy();
    const same = await users.changeOwnPassword('nueva-2026', 'nueva-2026');
    expect(!same.ok && same.fieldErrors.password).toContain('distinta');
    expect((await users.changeOwnPassword('nueva-2026', 'otra-2026')).ok).toBe(true);
    await expect(auth.login('jordi', 'otra-2026')).resolves.toMatchObject({ username: 'jordi' });
  });

  it('permisos por rol: el administrador fijo, los demás ajustables y se aplican al entrar', async () => {
    const roles = await users.rolePermissions();
    expect(roles.find((r) => r.role === 'admin')?.editable).toBe(false);
    await expect(users.setRolePermissions('admin', [])).rejects.toThrow('siempre todos');
    const r = await users.setRolePermissions('mecanico', ['ordenes.edit', 'catalogo.view', 'users.manage']);
    expect(r.permissions).toEqual(['ordenes.view', 'ordenes.edit', 'catalogo.view']);
    await newMechanic();
    expect((await auth.login('jordi', 'motor1234')).permissions).toEqual(['catalogo.view', 'ordenes.edit', 'ordenes.view']);
    const log = await db.get<{ changes: string }>("SELECT changes FROM activity_log WHERE action = 'role.permissions'");
    expect(JSON.parse(log?.changes ?? '{}').removed.length).toBeGreaterThan(0);
  });

  it('inactividad configurable dentro de sus límites y en la sesión siguiente', async () => {
    expect(await users.idleMinutes()).toBe(30);
    expect((await users.setIdleMinutes(2)).ok).toBe(false);
    expect((await users.setIdleMinutes(60)).ok).toBe(true);
    expect((await auth.login('robert', 'taller2026')).idleMinutes).toBe(60);
  });

  it('solo con users.manage', async () => {
    if (!session) throw new Error('Falta la sesión');
    session = { ...session, permissions: ['config.manage'] };
    await expect(users.list()).rejects.toThrow('no tiene permiso');
    await expect(newMechanic()).rejects.toThrow('no tiene permiso');
  });
});
