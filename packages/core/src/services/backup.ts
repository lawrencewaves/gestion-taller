import type { BackupFile, BackupKind, BackupRecord, BackupService, BackupStatus, Environment, Session } from '@gonzalvo/contracts';
import { BACKUP_OVERDUE_HOURS, BACKUP_RETENTION_RANGE } from '@gonzalvo/contracts';
import type { BackupPort, Clock, IdGenerator, SqlExecutor } from '../ports';
import { logActivity } from './activity';
import { requirePermission } from './auth';

export class BackupError extends Error {
  override name = 'BackupError';
}

// ---------------------------------------------------------------------------
// Reglas (funciones puras)
// ---------------------------------------------------------------------------

/** Instante ISO en forma apta para nombres de archivo: `2026-11-10T17-32-05Z`. */
export function fileStamp(iso: string): string {
  return `${iso.slice(0, 19).replace(/:/g, '-')}Z`;
}

/** Prefijo por entorno: las copias de pruebas y las del taller nunca se confunden aunque compartan carpeta. */
export const backupPrefix = (environment: Environment) => `gonzalvo-${environment.toLowerCase()}-`;

export const backupFileName = (environment: Environment, iso: string) => `${backupPrefix(environment)}${fileStamp(iso)}.gonzalvo`;

/** Fecha de una copia a partir de su nombre, o `null` si el nombre no es de Gonzalvo. */
export function backupDate(name: string): string | null {
  const m = /^gonzalvo-[a-z]+-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z\.gonzalvo$/.exec(name);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:${m[3]}:${m[4]}.000Z`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

const HOUR = 3_600_000;
const localDay = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const localMonth = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;

/** RF-BAK-08: sin copia correcta en las últimas 48 horas. */
export function isOverdue(lastOk: string | null, now: string): boolean {
  return lastOk === null || Date.parse(now) - Date.parse(lastOk) > BACKUP_OVERDUE_HOURS * HOUR;
}

/** RF-BAK-01: toca la copia diaria si hoy (hora del ordenador) aún no hay ninguna correcta. */
export function isDailyDue(lastOk: string | null, now: string): boolean {
  return lastOk === null || localDay(new Date(lastOk)) !== localDay(new Date(now));
}

/**
 * RF-BAK-07: se conservan la más reciente de cada uno de los últimos `keepDaily` días y la más
 * reciente de cada uno de los últimos `keepMonthly` meses. La copia más nueva no se borra nunca.
 * Devuelve los nombres que sobran.
 */
export function selectForDeletion(
  files: readonly { name: string; createdAt: string }[],
  now: string,
  keepDaily: number,
  keepMonthly: number,
): string[] {
  const sorted = [...files].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const today = new Date(now);
  const firstDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (keepDaily - 1)).getTime();
  const firstMonth = new Date(today.getFullYear(), today.getMonth() - (keepMonthly - 1), 1).getTime();
  const keep = new Set<string>(sorted[0] ? [sorted[0].name] : []);
  const days = new Set<string>();
  const months = new Set<string>();
  for (const f of sorted) {
    const d = new Date(f.createdAt);
    if (d.getTime() >= firstDay && !days.has(localDay(d))) {
      days.add(localDay(d));
      keep.add(f.name);
    }
    if (keepMonthly > 0 && d.getTime() >= firstMonth && !months.has(localMonth(d))) {
      months.add(localMonth(d));
      keep.add(f.name);
    }
  }
  return sorted.filter((f) => !keep.has(f.name)).map((f) => f.name);
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

export interface BackupServiceDeps {
  db: SqlExecutor;
  port: BackupPort;
  clock: Clock;
  ids: IdGenerator;
  session: () => Session | null;
  environment: Environment;
  /** Última migración que conoce este programa: no se restaura una copia más nueva. */
  schemaVersion: number;
  /** Vuelve a abrir y migrar la base después de restaurar. */
  reopen: () => Promise<void>;
}

interface Row {
  id: string;
  created_at: string;
  kind: BackupKind;
  destination: string;
  file_name: string | null;
  size_bytes: number | null;
  error: string | null;
}

const toRecord = (r: Row): BackupRecord => ({
  id: r.id,
  createdAt: r.created_at,
  kind: r.kind,
  destination: r.destination,
  fileName: r.file_name,
  sizeBytes: r.size_bytes,
  error: r.error,
});

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function createBackupService(deps: BackupServiceDeps): BackupService & {
  /** Copia diaria si toca. La llama el programa al arrancar y cada hora; nunca lanza error. */
  runIfDue(): Promise<BackupRecord | null>;
} {
  const { db, port, clock } = deps;
  const prefix = backupPrefix(deps.environment);
  const admin = () => requirePermission(deps.session(), 'config.manage');
  const log = (session: Session | null, action: string, changes?: Record<string, unknown>) =>
    logActivity(db, deps, { userId: session?.userId ?? null, action, entityType: 'backup', ...(changes ? { changes } : {}) });

  async function settings() {
    const s = await db.get<{ backup_folder: string | null; backup_keep_daily: number; backup_keep_monthly: number }>(
      'SELECT backup_folder, backup_keep_daily, backup_keep_monthly FROM settings WHERE id = 1',
    );
    if (!s) throw new BackupError('Falta la configuración del taller.');
    return { folder: s.backup_folder, keepDaily: s.backup_keep_daily, keepMonthly: s.backup_keep_monthly };
  }

  async function requireFolder() {
    const s = await settings();
    if (!s.folder) throw new BackupError('Primero elige la carpeta de las copias.');
    return { ...s, folder: s.folder };
  }

  /** Una copia cada vez: la diaria y la manual nunca se pisan. */
  let queue: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const result = queue.then(work);
    queue = result.catch(() => undefined);
    return result;
  };

  type Outcome = { fileName: string; sizeBytes: number; sha256: string } | { error: string };

  async function insert(kind: BackupKind, destination: string, outcome: Outcome): Promise<BackupRecord> {
    const ok = 'fileName' in outcome;
    const record: BackupRecord = {
      id: deps.ids.next(),
      createdAt: clock.now(),
      kind,
      destination,
      fileName: ok ? outcome.fileName : null,
      sizeBytes: ok ? outcome.sizeBytes : null,
      error: ok ? null : outcome.error,
    };
    await db.run(
      `INSERT INTO backups (id, created_at, kind, destination, file_name, size_bytes, sha256, verified, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [record.id, record.createdAt, kind, destination, record.fileName, record.sizeBytes, ok ? outcome.sha256 : null, ok ? 1 : 0, record.error],
    );
    return record;
  }

  /** Hace la copia y la anota, salga bien o mal. Si sale mal, lanza el error después de anotarlo. */
  async function make(kind: BackupKind, folder: string): Promise<BackupRecord> {
    const outcome: Outcome = await port.create(folder, backupFileName(deps.environment, clock.now())).catch((e: unknown) => ({ error: message(e) }));
    const record = await insert(kind, folder, outcome);
    if (record.error !== null) throw new BackupError(record.error);
    return record;
  }

  /** La retención nunca hace fallar una copia que ya está hecha. */
  async function prune(folder: string, keepDaily: number, keepMonthly: number) {
    try {
      const files = (await port.list(folder, prefix)).flatMap((f) => {
        const createdAt = backupDate(f.name);
        return createdAt ? [{ name: f.name, createdAt }] : [];
      });
      for (const name of selectForDeletion(files, clock.now(), keepDaily, keepMonthly)) await port.remove(folder, name);
    } catch {
      // Se reintentará tras la próxima copia.
    }
  }

  async function backupToFolder(kind: 'auto' | 'manual') {
    const { folder, keepDaily, keepMonthly } = await requireFolder();
    const record = await make(kind, folder);
    await prune(folder, keepDaily, keepMonthly);
    return record;
  }

  async function lastOk() {
    const r = await db.get<Row>(
      "SELECT * FROM backups WHERE error IS NULL AND kind IN ('auto', 'manual') ORDER BY created_at DESC LIMIT 1",
    );
    return r ? toRecord(r) : null;
  }

  async function status(): Promise<BackupStatus> {
    const s = await settings();
    const ok = await lastOk();
    const last = await db.get<Row>("SELECT * FROM backups WHERE kind IN ('auto', 'manual') ORDER BY created_at DESC LIMIT 1");
    return {
      available: true,
      folder: s.folder,
      hasKey: await port.hasKey(),
      lastOk: ok,
      lastError: last && last.error !== null ? toRecord(last) : null,
      overdue: isOverdue(ok?.createdAt ?? null, clock.now()),
      keepDaily: s.keepDaily,
      keepMonthly: s.keepMonthly,
    };
  }

  return {
    async status() {
      admin();
      return status();
    },

    async chooseFolder() {
      const session = admin();
      const folder = await port.pickFolder();
      if (folder) {
        await db.transaction(async (tx) => {
          await tx.run('UPDATE settings SET backup_folder = ?, updated_at = ?, version = version + 1 WHERE id = 1', [folder, clock.now()]);
          await logActivity(tx, deps, { userId: session.userId, action: 'backup.folder', entityType: 'backup', changes: { folder } });
        });
      }
      return status();
    },

    async createKey() {
      const session = admin();
      const key = await port.createKey();
      await log(session, 'backup.key_created');
      return key;
    },

    async revealKey() {
      const session = admin();
      const key = await port.revealKey();
      await log(session, 'backup.key_revealed');
      return key;
    },

    async enterKey(key) {
      const session = admin();
      const { folder } = await requireFolder();
      const [newest] = await port.list(folder, prefix);
      if (!newest) throw new BackupError('No hay copias en esa carpeta con las que comprobar la clave. Elige la carpeta donde están.');
      await port.checkKey(folder, newest.name, key);
      await port.setKey(key);
      await log(session, 'backup.key_entered');
    },

    async backupNow() {
      const session = admin();
      return exclusive(async () => {
        const record = await backupToFolder('manual');
        await log(session, 'backup.manual', { fileName: record.fileName });
        return record;
      });
    },

    async exportCopy() {
      const session = admin();
      const folder = await port.pickFolder();
      if (!folder) return null;
      return exclusive(async () => {
        const record = await make('export', folder);
        await log(session, 'backup.export', { folder, fileName: record.fileName });
        return record;
      });
    },

    async setRetention(keepDaily, keepMonthly) {
      const session = admin();
      const { daily, monthly } = BACKUP_RETENTION_RANGE;
      if (!Number.isInteger(keepDaily) || keepDaily < daily.min || keepDaily > daily.max) {
        throw new BackupError(`Las copias diarias se guardan entre ${daily.min} y ${daily.max} días.`);
      }
      if (!Number.isInteger(keepMonthly) || keepMonthly < monthly.min || keepMonthly > monthly.max) {
        throw new BackupError(`Las copias mensuales se guardan entre ${monthly.min} y ${monthly.max} meses.`);
      }
      await db.transaction(async (tx) => {
        // Sin subir la versión de settings: no choca con quien edite los datos del taller a la vez.
        await tx.run('UPDATE settings SET backup_keep_daily = ?, backup_keep_monthly = ?, updated_at = ? WHERE id = 1', [keepDaily, keepMonthly, clock.now()]);
        await logActivity(tx, deps, { userId: session.userId, action: 'backup.retention', entityType: 'backup', changes: { keepDaily, keepMonthly } });
      });
      return status();
    },

    async list(): Promise<BackupFile[]> {
      admin();
      const { folder } = await requireFolder();
      return (await port.list(folder, prefix)).flatMap((f) => {
        const createdAt = backupDate(f.name);
        return createdAt ? [{ name: f.name, createdAt, sizeBytes: f.sizeBytes }] : [];
      });
    },

    async restore(fileName) {
      const session = admin();
      return exclusive(async () => {
        const { folder } = await requireFolder();
        const info = await port.prepareRestore(folder, fileName);
        try {
          if (info.environment !== deps.environment) {
            throw new BackupError(`Esta copia es de ${info.environment ?? 'otra instalación'} y este programa es ${deps.environment}. No se restaura para no mezclar datos.`);
          }
          if (info.schemaVersion > deps.schemaVersion) {
            throw new BackupError('La copia es de una versión más nueva de Gonzalvo. Actualiza el programa antes de restaurarla.');
          }
        } catch (e) {
          await port.cancelRestore();
          throw e;
        }
        const safetyCopy = await port.applyRestore(`${fileStamp(clock.now())}-antes-de-restaurar`);
        await deps.reopen();
        // Se anota en la base ya restaurada. Su tabla de usuarios es la de la copia: se guarda el nombre.
        await logActivity(db, deps, {
          userId: null,
          action: 'backup.restored',
          entityType: 'backup',
          changes: { fileName, by: session.username, safetyCopy },
        });
      });
    },

    runIfDue() {
      return exclusive(async () => {
        try {
          const s = await settings();
          if (!s.folder || !(await port.hasKey())) return null;
          if (!isDailyDue((await lastOk())?.createdAt ?? null, clock.now())) return null;
          return await backupToFolder('auto');
        } catch {
          return null; // Ya anotado en el historial; el aviso de 48 horas lo hará visible.
        }
      });
    },
  };
}

/** Demo: los datos viven en el navegador y las copias no existen (RF-DEM-05). */
export function createUnavailableBackupService(): BackupService {
  const unavailable = async (): Promise<never> => {
    throw new BackupError('Las copias de seguridad solo existen en el programa instalado.');
  };
  return {
    status: async () => ({
      available: false, folder: null, hasKey: false, lastOk: null, lastError: null, overdue: false, keepDaily: 0, keepMonthly: 0,
    }),
    chooseFolder: unavailable,
    createKey: unavailable,
    revealKey: unavailable,
    enterKey: unavailable,
    backupNow: unavailable,
    exportCopy: unavailable,
    setRetention: unavailable,
    list: unavailable,
    restore: unavailable,
  };
}
