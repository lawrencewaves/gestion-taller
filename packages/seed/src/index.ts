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

/** Taller ficticio de la demo. El NIF 00000000T es válido de formato y no pertenece a nadie. */
export const DEMO_WORKSHOP = {
  legalName: 'Taller de Demostración',
  tradeName: 'Gonzalvo · DEMO',
  taxId: '00000000T',
  addressLine: 'Calle Ficticia, 1',
  postalCode: '08001',
  city: 'Barcelona',
  province: 'Barcelona',
  phone: '000 000 000',
  email: 'demo@example.com',
} as const;

/** Rellena los datos del taller si aún están vacíos. No pisa lo que se haya editado en la demo. */
export async function seedDemoWorkshop(db: SqlExecutor, deps: { clock: Clock }): Promise<void> {
  const w = DEMO_WORKSHOP;
  await db.run(
    `UPDATE settings SET legal_name = ?, trade_name = ?, tax_id = ?, address_line = ?, postal_code = ?, city = ?, province = ?,
       phone = ?, email = ?, updated_at = ?, version = version + 1
     WHERE id = 1 AND legal_name = ''`,
    [w.legalName, w.tradeName, w.taxId, w.addressLine, w.postalCode, w.city, w.province, w.phone, w.email, deps.clock.now()],
  );
}
