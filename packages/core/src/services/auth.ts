import {
  type AuthService, type NewAdmin, PASSWORD_MIN_LENGTH, type Permission, PERMISSIONS, type Role, type Session,
} from '@gonzalvo/contracts';
import type { Clock, IdGenerator, PasswordHasher, SqlExecutor } from '../ports';
import { logActivity } from './activity';

/** Error que se enseña tal cual a la persona: dice qué pasa y qué hacer. */
export class AuthError extends Error {
  override name = 'AuthError';
}

export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: Role;
  active: number;
  failed_attempts: number;
  locked_until: string | null;
}

export interface AuthDeps {
  db: SqlExecutor;
  hasher: PasswordHasher;
  clock: Clock;
  ids: IdGenerator;
  /** Solo DEMO, PREVIEW y LOCAL web: credenciales públicas de prueba. */
  demo?: { usernames: string[]; password: string };
}

const known = new Set<string>(PERMISSIONS);

/** Hay alguien con la sesión abierta. Para lo que puede consultar cualquier rol. */
export function requireSession(session: Session | null): Session {
  if (!session) throw new AuthError('La sesión ha caducado. Vuelve a entrar.');
  return session;
}

/** Comprueba que el usuario puede hacer algo. Los servicios la llaman antes de cada operación. */
export function requirePermission(session: Session | null, permission: Permission): Session {
  const current = requireSession(session);
  if (!current.permissions.includes(permission)) throw new AuthError('Tu usuario no tiene permiso para hacer esto.');
  return current;
}

export function validateUsername(username: string): string {
  const u = username.trim();
  if (!/^[\p{L}\p{N}._-]{3,40}$/u.test(u)) {
    throw new AuthError('El usuario debe tener entre 3 y 40 caracteres: letras, números, punto, guion o guion bajo, sin espacios.');
  }
  return u;
}

export function validatePassword(password: string, username: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AuthError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }
  if (password.toLowerCase() === username.toLowerCase()) {
    throw new AuthError('La contraseña no puede ser igual que el usuario.');
  }
}

const time = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Inicio de sesión local (REQUIREMENTS §2). La sesión vive en memoria, dentro del
 * programa (escritorio) o del Worker (demo): cerrar el programa la cierra.
 */
export function createAuthService(deps: AuthDeps): AuthService & { current(): Session | null } {
  const { db, hasher, clock } = deps;
  let session: Session | null = null;

  async function buildSession(user: Pick<UserRow, 'id' | 'username' | 'display_name' | 'role'>): Promise<Session> {
    const rows = await db.all<{ permission: string }>('SELECT permission FROM role_permissions WHERE role = ? ORDER BY permission', [user.role]);
    const permissions = rows.map((r) => r.permission).filter((p): p is Permission => known.has(p));
    const settings = await db.get<{ idle_minutes: number }>('SELECT idle_minutes FROM settings WHERE id = 1');
    return {
      userId: user.id, username: user.username, displayName: user.display_name, role: user.role, permissions,
      idleMinutes: settings?.idle_minutes ?? 30,
    };
  }

  return {
    current: () => session,

    async status() {
      const row = await db.get<{ n: number }>('SELECT count(*) AS n FROM users');
      return { needsSetup: (row?.n ?? 0) === 0, ...(deps.demo ? { demo: deps.demo } : {}) };
    },

    async setupAdmin(input: NewAdmin) {
      const username = validateUsername(input.username);
      const displayName = input.displayName.trim();
      if (!displayName) throw new AuthError('Escribe el nombre de la persona.');
      validatePassword(input.password, username);
      const passwordHash = await hasher.hash(input.password);
      const id = deps.ids.next();
      const now = clock.now();
      await db.transaction(async (tx) => {
        const existing = await tx.get<{ n: number }>('SELECT count(*) AS n FROM users');
        if ((existing?.n ?? 0) > 0) throw new AuthError('Ya existe un administrador. Entra con tu usuario.');
        await tx.run(
          `INSERT INTO users (id, username, display_name, password_hash, role, last_login_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'admin', ?, ?, ?)`,
          [id, username, displayName, passwordHash, now, now, now],
        );
        await logActivity(tx, deps, { userId: id, action: 'user.create', entityType: 'user', entityId: id, changes: { username, role: 'admin', first: true } });
      });
      session = await buildSession({ id, username, display_name: displayName, role: 'admin' });
      return session;
    },

    async login(rawUsername: string, password: string) {
      const username = rawUsername.trim();
      const user = await db.get<UserRow>('SELECT * FROM users WHERE username = ?', [username]);
      const now = clock.now();
      // Mismo mensaje si el usuario no existe o la contraseña falla: no se revela qué usuarios hay.
      const wrong = new AuthError('Usuario o contraseña incorrectos.');

      if (!user) {
        await logActivity(db, deps, { userId: null, action: 'auth.login_failed', changes: { username } });
        throw wrong;
      }
      if (!user.active) {
        throw new AuthError('Este usuario está desactivado. Pide al administrador que lo active.');
      }
      if (user.locked_until && user.locked_until > now) {
        throw new AuthError(`Demasiados intentos fallidos. Vuelve a probar a las ${time(user.locked_until)}.`);
      }

      if (!(await hasher.verify(password, user.password_hash))) {
        const attempts = user.failed_attempts + 1;
        const lock = attempts >= MAX_FAILED_ATTEMPTS;
        const lockedUntil = lock ? new Date(Date.parse(now) + LOCK_MINUTES * 60_000).toISOString() : null;
        await db.transaction(async (tx) => {
          await tx.run('UPDATE users SET failed_attempts = ?, locked_until = ?, updated_at = ?, version = version + 1 WHERE id = ?', [
            lock ? 0 : attempts, lockedUntil, now, user.id,
          ]);
          await logActivity(tx, deps, { userId: user.id, action: lock ? 'auth.locked' : 'auth.login_failed', entityType: 'user', entityId: user.id });
        });
        if (lockedUntil) throw new AuthError(`Demasiados intentos fallidos. Vuelve a probar a las ${time(lockedUntil)}.`);
        throw wrong;
      }

      await db.transaction(async (tx) => {
        await tx.run('UPDATE users SET failed_attempts = 0, locked_until = NULL, last_login_at = ?, updated_at = ?, version = version + 1 WHERE id = ?', [
          now, now, user.id,
        ]);
        await logActivity(tx, deps, { userId: user.id, action: 'auth.login', entityType: 'user', entityId: user.id });
      });
      session = await buildSession(user);
      return session;
    },

    async logout() {
      if (session) await logActivity(db, deps, { userId: session.userId, action: 'auth.logout', entityType: 'user', entityId: session.userId });
      session = null;
    },

    async session() {
      return session;
    },
  };
}
