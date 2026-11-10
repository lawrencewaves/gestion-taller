/**
 * Datos ficticios de DEMO, PREVIEW y LOCAL web (DATABASE §6). Nunca se cargan en TALLER.
 * Todo es inventado: nombres, documentos y contraseñas públicas.
 */
import type { Clock, IdGenerator, PasswordHasher, SqlExecutor } from '@gonzalvo/core';

/** Contraseña pública de los usuarios de prueba. La pantalla de entrada de la demo la muestra. */
export const DEMO_PASSWORD = 'gonzalvo';

export const DEMO_USERS = [
  { username: 'admin', displayName: 'Administración (demo)', role: 'admin' },
  { username: 'recepcion', displayName: 'Recepción (demo)', role: 'recepcion' },
  { username: 'mecanico', displayName: 'Mecánico (demo)', role: 'mecanico' },
] as const;

/** Crea los usuarios de prueba si la base todavía no tiene ninguno. */
export async function seedDemoUsers(
  db: SqlExecutor,
  deps: { hasher: PasswordHasher; ids: IdGenerator; clock: Clock },
): Promise<void> {
  const existing = await db.get<{ n: number }>('SELECT count(*) AS n FROM users');
  if ((existing?.n ?? 0) > 0) return;
  const hash = await deps.hasher.hash(DEMO_PASSWORD);
  const now = deps.clock.now();
  await db.transaction(async (tx) => {
    for (const u of DEMO_USERS) {
      await tx.run(
        'INSERT INTO users (id, username, display_name, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [deps.ids.next(), u.username, u.displayName, hash, u.role, now, now],
      );
    }
  });
}
