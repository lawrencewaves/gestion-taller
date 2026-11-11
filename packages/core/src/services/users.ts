import {
  ADMIN_ONLY_PERMISSIONS, IDLE_MINUTES_RANGE, type NewUser, type Permission, PERMISSION_GROUPS, PERMISSIONS, type Role,
  type RolePermissions, ROLES, type SaveResult, type Session, type UserField, type UserSummary, type UsersService, type UserUpdate,
} from '@gonzalvo/contracts';
import type { Clock, IdGenerator, PasswordHasher, SqlExecutor } from '../ports';
import { logActivity } from './activity';
import { AuthError, requirePermission, requireSession, validatePassword, validateUsername } from './auth';

interface Row {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  active: number;
  locked_until: string | null;
  last_login_at: string | null;
  version: number;
}

const CONFLICT = 'Otra persona ha cambiado este usuario mientras lo editabas. Vuelve a abrirlo para ver los últimos datos.';

/**
 * Permisos coherentes para un rol que no es administrador: solo los de módulos,
 * quien edita también ve, y emitir o devolver exige poder editar.
 */
export function normalizeRolePermissions(requested: readonly Permission[]): Permission[] {
  const set = new Set(requested.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)));
  for (const g of PERMISSION_GROUPS) {
    if (g.extra && set.has(g.extra.permission)) set.add(g.edit);
    if (set.has(g.edit)) set.add(g.view);
  }
  return PERMISSIONS.filter((p) => set.has(p));
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createUsersService(deps: {
  db: SqlExecutor;
  hasher: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
  session: () => Session | null;
}): UsersService {
  const { db, clock, hasher } = deps;
  const manager = () => requirePermission(deps.session(), 'users.manage');

  const toSummary = (r: Row): UserSummary => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    active: r.active === 1,
    locked: r.locked_until !== null && r.locked_until > clock.now(),
    lastLoginAt: r.last_login_at,
    version: r.version,
  });
  const COLUMNS = 'id, username, display_name, role, active, locked_until, last_login_at, version';
  const find = async (id: string) => db.get<Row>(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id]);

  async function readRole(role: Role): Promise<RolePermissions> {
    const rows = await db.all<{ permission: string }>('SELECT permission FROM role_permissions WHERE role = ?', [role]);
    const set = new Set(rows.map((r) => r.permission));
    return { role, permissions: PERMISSIONS.filter((p) => set.has(p)), editable: role !== 'admin' };
  }

  return {
    async list() {
      manager();
      const rows = await db.all<Row>(`SELECT ${COLUMNS} FROM users ORDER BY active DESC, display_name COLLATE NOCASE`);
      return rows.map(toSummary);
    },

    async create(input: NewUser): Promise<SaveResult<UserSummary, UserField>> {
      const session = manager();
      const errors: Partial<Record<UserField, string>> = {};
      let username = '';
      try {
        username = validateUsername(input.username);
      } catch (e) {
        errors.username = message(e);
      }
      const displayName = input.displayName.trim().replace(/\s+/g, ' ');
      if (!displayName) errors.displayName = 'Escribe el nombre de la persona.';
      if (!ROLES.includes(input.role)) errors.role = 'Elige un rol.';
      try {
        validatePassword(input.password, username);
      } catch (e) {
        errors.password = message(e);
      }
      if (username && (await db.get('SELECT 1 FROM users WHERE username = ?', [username]))) {
        errors.username = 'Ya hay un usuario con ese nombre.';
      }
      if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

      const id = deps.ids.next();
      const now = clock.now();
      const hash = await hasher.hash(input.password);
      await db.transaction(async (tx) => {
        await tx.run(
          'INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [id, username, displayName, hash, input.role, now, now],
        );
        await logActivity(tx, deps, { userId: session.userId, action: 'user.create', entityType: 'user', entityId: id, changes: { username, role: input.role } });
      });
      const row = await find(id);
      if (!row) throw new Error('No se ha podido crear el usuario.');
      return { ok: true, value: toSummary(row) };
    },

    async update(input: UserUpdate): Promise<SaveResult<UserSummary, UserField>> {
      const session = manager();
      const before = await find(input.id);
      if (!before) throw new AuthError('Ese usuario no existe.');
      const displayName = input.displayName.trim().replace(/\s+/g, ' ');
      const errors: Partial<Record<UserField, string>> = {};
      if (!displayName) errors.displayName = 'Escribe el nombre de la persona.';
      if (!ROLES.includes(input.role)) errors.role = 'Elige un rol.';
      const self = input.id === session.userId;
      if (self && !input.active) errors.active = 'No puedes desactivar tu propio usuario.';
      if (self && input.role !== 'admin' && before.role === 'admin') errors.role = 'No puedes quitarte el rol de administrador.';
      if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

      const changes: Record<string, unknown> = {};
      if (displayName !== before.display_name) changes.displayName = displayName;
      if (input.role !== before.role) changes.role = input.role;
      if (input.active !== (before.active === 1)) changes.active = input.active;
      if (Object.keys(changes).length === 0) return { ok: true, value: toSummary(before) };

      const outcome = await db.transaction(async (tx) => {
        const { changes: n } = await tx.run(
          'UPDATE users SET display_name = ?, role = ?, active = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?',
          [displayName, input.role, input.active ? 1 : 0, clock.now(), input.id, input.version],
        );
        if (n === 0) return 'conflict' as const;
        // Siempre queda al menos un administrador activo: nadie puede dejar el taller sin acceso a Configuración.
        const admins = await tx.get<{ n: number }>("SELECT count(*) AS n FROM users WHERE role = 'admin' AND active = 1");
        if ((admins?.n ?? 0) === 0) throw new AuthError('Tiene que quedar al menos un administrador activo.');
        await logActivity(tx, deps, { userId: session.userId, action: 'user.update', entityType: 'user', entityId: input.id, changes });
        return 'ok' as const;
      }).catch((e: unknown) => {
        if (e instanceof AuthError) return e;
        throw e;
      });
      if (outcome instanceof AuthError) return { ok: false, fieldErrors: { role: outcome.message }, error: outcome.message };
      if (outcome === 'conflict') return { ok: false, fieldErrors: {}, error: CONFLICT };
      const row = await find(input.id);
      if (!row) throw new Error('El usuario ha desaparecido.');
      return { ok: true, value: toSummary(row) };
    },

    async resetPassword(id, password): Promise<SaveResult<null, UserField>> {
      const session = manager();
      const user = await find(id);
      if (!user) throw new AuthError('Ese usuario no existe.');
      try {
        validatePassword(password, user.username);
      } catch (e) {
        return { ok: false, fieldErrors: { password: message(e) } };
      }
      const hash = await hasher.hash(password);
      await db.transaction(async (tx) => {
        await tx.run(
          'UPDATE users SET password_hash = ?, failed_attempts = 0, locked_until = NULL, updated_at = ?, version = version + 1 WHERE id = ?',
          [hash, clock.now(), id],
        );
        await logActivity(tx, deps, { userId: session.userId, action: 'user.password_reset', entityType: 'user', entityId: id });
      });
      return { ok: true, value: null };
    },

    async changeOwnPassword(currentPassword, password): Promise<SaveResult<null, UserField>> {
      const session = requireSession(deps.session());
      const user = await db.get<{ username: string; password_hash: string }>('SELECT username, password_hash FROM users WHERE id = ?', [session.userId]);
      if (!user) throw new AuthError('La sesión ha caducado. Vuelve a entrar.');
      if (!(await hasher.verify(currentPassword, user.password_hash))) {
        return { ok: false, fieldErrors: { currentPassword: 'La contraseña actual no es correcta.' } };
      }
      try {
        validatePassword(password, user.username);
      } catch (e) {
        return { ok: false, fieldErrors: { password: message(e) } };
      }
      if (currentPassword === password) return { ok: false, fieldErrors: { password: 'La contraseña nueva tiene que ser distinta de la actual.' } };
      const hash = await hasher.hash(password);
      await db.transaction(async (tx) => {
        await tx.run('UPDATE users SET password_hash = ?, updated_at = ?, version = version + 1 WHERE id = ?', [hash, clock.now(), session.userId]);
        await logActivity(tx, deps, { userId: session.userId, action: 'user.password_changed', entityType: 'user', entityId: session.userId });
      });
      return { ok: true, value: null };
    },

    async rolePermissions() {
      manager();
      return Promise.all(ROLES.map(readRole));
    },

    async setRolePermissions(role, requested) {
      const session = manager();
      if (role === 'admin') throw new AuthError('El administrador tiene siempre todos los permisos.');
      if (!ROLES.includes(role)) throw new AuthError('Ese rol no existe.');
      const before = (await readRole(role)).permissions;
      const next = normalizeRolePermissions(requested);
      const added = next.filter((p) => !before.includes(p));
      const removed = before.filter((p) => !next.includes(p));
      if (added.length > 0 || removed.length > 0) {
        await db.transaction(async (tx) => {
          await tx.run('DELETE FROM role_permissions WHERE role = ?', [role]);
          for (const p of next) await tx.run('INSERT INTO role_permissions (role, permission) VALUES (?, ?)', [role, p]);
          await logActivity(tx, deps, { userId: session.userId, action: 'role.permissions', entityType: 'role', entityId: role, changes: { added, removed } });
        });
      }
      return readRole(role);
    },

    async idleMinutes() {
      requireSession(deps.session());
      const row = await db.get<{ idle_minutes: number }>('SELECT idle_minutes FROM settings WHERE id = 1');
      return row?.idle_minutes ?? 30;
    },

    async setIdleMinutes(minutes): Promise<SaveResult<number, 'idleMinutes'>> {
      const session = manager();
      const { min, max } = IDLE_MINUTES_RANGE;
      if (!Number.isInteger(minutes) || minutes < min || minutes > max) {
        return { ok: false, fieldErrors: { idleMinutes: `Elige entre ${min} y ${max} minutos.` } };
      }
      await db.transaction(async (tx) => {
        // Sin subir la versión: así no choca con alguien que esté editando los datos del taller a la vez.
        await tx.run('UPDATE settings SET idle_minutes = ?, updated_at = ? WHERE id = 1', [minutes, clock.now()]);
        await logActivity(tx, deps, { userId: session.userId, action: 'settings.idle', entityType: 'settings', changes: { idleMinutes: minutes } });
      });
      return { ok: true, value: minutes };
    },
  };
}
