import type { Clock, IdGenerator, SqlExecutor } from '../ports';

export interface ActivityEntry {
  userId: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  changes?: Record<string, unknown>;
}

/**
 * Anota una acción en el registro de actividad (RF-GEN-01). El registro solo admite
 * inserciones: la base de datos impide modificarlo o borrarlo.
 * Debe llamarse dentro de la misma transacción que el cambio que describe.
 */
export async function logActivity(db: SqlExecutor, deps: { clock: Clock; ids: IdGenerator }, entry: ActivityEntry): Promise<void> {
  await db.run(
    'INSERT INTO activity_log (id, at, user_id, action, entity_type, entity_id, changes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      deps.ids.next(),
      deps.clock.now(),
      entry.userId,
      entry.action,
      entry.entityType ?? null,
      entry.entityId ?? null,
      entry.changes ? JSON.stringify(entry.changes) : null,
    ],
  );
}
