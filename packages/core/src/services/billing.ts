import {
  type BillingService, DOC_TYPES, type DocType, type PaymentMethod, type SaveResult, type SeriesConfig, type SeriesInput,
  type Session, type TaxRate,
} from '@gonzalvo/contracts';
import type { Clock, IdGenerator, SqlExecutor } from '../ports';
import { logActivity } from './activity';
import { requirePermission, requireSession } from './auth';

/** Prefijo de cada tipo de documento mientras el taller no elija otro. */
export const DEFAULT_PREFIX: Record<DocType, string> = {
  work_order: 'OT',
  quote: 'P',
  invoice: 'F',
  rectifying_invoice: 'R',
  payment_receipt: 'RC',
};

const PREFIX = /^[A-Z0-9][A-Z0-9-]{0,9}$/;
const MAX_NUMBER = 999_999;

/** `F-2026-0001`: prefijo, año y número con al menos cuatro cifras. */
export const formatDocNumber = (prefix: string, year: number, number: number) => `${prefix}-${year}-${String(number).padStart(4, '0')}`;

/** «21» o «10,5» → puntos básicos. `null` si no es un porcentaje entre 0 y 100 con dos decimales como mucho. */
export function parsePercent(text: string): number | null {
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(text.trim().replace(/\s*%$/, ''));
  if (!m) return null;
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return bp <= 10_000 ? bp : null;
}

interface SeriesRow {
  id: string;
  prefix: string;
  year: number;
  first_number: number;
  last_number: number;
}

const yearOf = (iso: string) => new Date(iso).getFullYear();

async function seriesFor(db: SqlExecutor, docType: DocType, year: number): Promise<SeriesRow | undefined> {
  return db.get<SeriesRow>('SELECT id, prefix, year, first_number, last_number FROM series WHERE doc_type = ? AND year = ? AND active = 1', [docType, year]);
}

/** Prefijo que toca si aún no hay serie este año: el del último año con serie, o el de fábrica. */
async function inheritedPrefix(db: SqlExecutor, docType: DocType): Promise<string> {
  const last = await db.get<{ prefix: string }>('SELECT prefix FROM series WHERE doc_type = ? ORDER BY year DESC LIMIT 1', [docType]);
  return last?.prefix ?? DEFAULT_PREFIX[docType];
}

/**
 * Asigna el siguiente número de un documento (RF-FAC-01, RF-OT-01). Hay que llamarla dentro de la
 * misma transacción que guarda el documento: si esta falla, el número no se consume y no queda hueco.
 * La serie del año se crea sola con el primer documento.
 */
export async function nextDocumentNumber(
  tx: SqlExecutor,
  deps: { clock: Clock; ids: IdGenerator },
  docType: DocType,
): Promise<{ seriesId: string; number: number; formatted: string }> {
  const now = deps.clock.now();
  const year = yearOf(now);
  let row = await seriesFor(tx, docType, year);
  if (!row) {
    const id = deps.ids.next();
    const prefix = await inheritedPrefix(tx, docType);
    await tx.run('INSERT INTO series (id, doc_type, prefix, year, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, docType, prefix, year, now, now]);
    row = { id, prefix, year, first_number: 1, last_number: 0 };
  }
  const number = row.last_number + 1;
  await tx.run('UPDATE series SET last_number = ?, updated_at = ?, version = version + 1 WHERE id = ? AND last_number = ?', [number, now, row.id, row.last_number]);
  return { seriesId: row.id, number, formatted: formatDocNumber(row.prefix, year, number) };
}

interface TaxRow {
  id: string;
  name: string;
  rate_bp: number;
  is_default: number;
  active: number;
  version: number;
}
interface MethodRow {
  id: string;
  name: string;
  active: number;
  version: number;
}

const toTax = (r: TaxRow): TaxRate => ({ id: r.id, name: r.name, rateBp: r.rate_bp, isDefault: r.is_default === 1, active: r.active === 1, version: r.version });
const toMethod = (r: MethodRow): PaymentMethod => ({ id: r.id, name: r.name, active: r.active === 1, version: r.version });
const CONFLICT = 'Otra persona lo ha cambiado mientras tanto. Vuelve a abrir la pantalla para ver los últimos datos.';

export function createBillingService(deps: { db: SqlExecutor; clock: Clock; ids: IdGenerator; session: () => Session | null }): BillingService {
  const { db, clock } = deps;
  const admin = () => requirePermission(deps.session(), 'config.manage');
  const cleanName = (name: string) => name.trim().replace(/\s+/g, ' ');

  async function readSeries(docType: DocType): Promise<SeriesConfig> {
    const year = yearOf(clock.now());
    const row = await seriesFor(db, docType, year);
    const prefix = row?.prefix ?? (await inheritedPrefix(db, docType));
    const nextNumber = (row?.last_number ?? 0) + 1;
    return { docType, prefix, year, nextNumber, locked: !!row && row.last_number >= row.first_number, example: formatDocNumber(prefix, year, nextNumber) };
  }

  const taxRates = async () =>
    (await db.all<TaxRow>('SELECT id, name, rate_bp, is_default, active, version FROM tax_rates ORDER BY sort_order, name')).map(toTax);
  const paymentMethods = async () =>
    (await db.all<MethodRow>('SELECT id, name, active, version FROM payment_methods ORDER BY sort_order, name')).map(toMethod);

  return {
    async series() {
      requireSession(deps.session());
      return Promise.all(DOC_TYPES.map(readSeries));
    },

    async saveSeries(input: SeriesInput): Promise<SaveResult<SeriesConfig, 'prefix' | 'nextNumber'>> {
      const session = admin();
      if (!DOC_TYPES.includes(input.docType)) throw new Error('Tipo de documento desconocido.');
      const prefix = input.prefix.trim().toUpperCase();
      const errors: Partial<Record<'prefix' | 'nextNumber', string>> = {};
      if (!PREFIX.test(prefix)) errors.prefix = 'Entre 1 y 10 letras o números, sin espacios. Por ejemplo: F.';
      if (!Number.isInteger(input.nextNumber) || input.nextNumber < 1 || input.nextNumber > MAX_NUMBER) {
        errors.nextNumber = `Un número entre 1 y ${MAX_NUMBER}.`;
      }
      const year = yearOf(clock.now());
      if (!errors.prefix) {
        // Dos tipos de documento con el mismo prefijo darían el mismo número a documentos distintos.
        for (const other of DOC_TYPES.filter((t) => t !== input.docType)) {
          if ((await readSeries(other)).prefix === prefix) errors.prefix = 'Ese prefijo ya lo usa otro tipo de documento.';
        }
      }
      if (Object.keys(errors).length > 0) return { ok: false, fieldErrors: errors };

      const current = await readSeries(input.docType);
      if (current.locked) {
        return { ok: false, fieldErrors: {}, error: 'Ya hay documentos con esta serie este año: no se puede cambiar, para que la numeración siga sin huecos.' };
      }
      if (current.prefix === prefix && current.nextNumber === input.nextNumber) return { ok: true, value: current };

      const now = clock.now();
      await db.transaction(async (tx) => {
        const row = await seriesFor(tx, input.docType, year);
        if (row) {
          await tx.run('UPDATE series SET prefix = ?, first_number = ?, last_number = ?, updated_at = ?, version = version + 1 WHERE id = ?', [
            prefix, input.nextNumber, input.nextNumber - 1, now, row.id,
          ]);
        } else {
          await tx.run(
            'INSERT INTO series (id, doc_type, prefix, year, first_number, last_number, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [deps.ids.next(), input.docType, prefix, year, input.nextNumber, input.nextNumber - 1, now, now],
          );
        }
        await logActivity(tx, deps, {
          userId: session.userId, action: 'settings.series', entityType: 'series', changes: { docType: input.docType, year, prefix, nextNumber: input.nextNumber },
        });
      });
      return { ok: true, value: await readSeries(input.docType) };
    },

    async taxRates() {
      requireSession(deps.session());
      return taxRates();
    },

    async addTaxRate(input): Promise<SaveResult<TaxRate, 'name' | 'percent'>> {
      const session = admin();
      const name = cleanName(input.name);
      const rateBp = parsePercent(input.percent);
      const errors: Partial<Record<'name' | 'percent', string>> = {};
      if (!name) errors.name = 'Ponle un nombre, como saldrá en los documentos.';
      else if (await db.get('SELECT 1 FROM tax_rates WHERE name = ? COLLATE NOCASE', [name])) errors.name = 'Ya hay un tipo con ese nombre.';
      if (rateBp === null) errors.percent = 'Un porcentaje entre 0 y 100, por ejemplo 21 o 10,5.';
      if (Object.keys(errors).length > 0 || rateBp === null) return { ok: false, fieldErrors: errors };
      const id = deps.ids.next();
      const now = clock.now();
      await db.transaction(async (tx) => {
        const order = await tx.get<{ n: number }>('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM tax_rates');
        await tx.run('INSERT INTO tax_rates (id, name, rate_bp, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, name, rateBp, order?.n ?? 1, now, now]);
        await logActivity(tx, deps, { userId: session.userId, action: 'settings.tax_rate_added', entityType: 'tax_rate', entityId: id, changes: { name, rateBp } });
      });
      const created = (await taxRates()).find((t) => t.id === id);
      if (!created) throw new Error('No se ha podido crear el tipo de impuesto.');
      return { ok: true, value: created };
    },

    async updateTaxRate(input): Promise<SaveResult<TaxRate[], 'active'>> {
      const session = admin();
      const before = (await taxRates()).find((t) => t.id === input.id);
      if (!before) throw new Error('Ese tipo de impuesto no existe.');
      if (input.isDefault && !input.active) return { ok: false, fieldErrors: { active: 'El tipo por defecto tiene que estar activo.' } };
      if (before.isDefault && !input.isDefault) return { ok: false, fieldErrors: { active: 'Elige otro tipo por defecto para cambiarlo.' } };
      const now = clock.now();
      const conflict = new Error(CONFLICT);
      try {
        await db.transaction(async (tx) => {
          // Solo puede haber un tipo por defecto: primero se le quita al anterior.
          if (input.isDefault && !before.isDefault) await tx.run('UPDATE tax_rates SET is_default = 0, updated_at = ?, version = version + 1 WHERE is_default = 1', [now]);
          const { changes } = await tx.run('UPDATE tax_rates SET active = ?, is_default = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?', [
            input.active ? 1 : 0, input.isDefault ? 1 : 0, now, input.id, input.version,
          ]);
          // Lanzar deshace también el paso anterior: nunca se queda el taller sin tipo por defecto.
          if (changes === 0) throw conflict;
          await logActivity(tx, deps, { userId: session.userId, action: 'settings.tax_rate', entityType: 'tax_rate', entityId: input.id, changes: { active: input.active, isDefault: input.isDefault } });
        });
      } catch (e) {
        if (e === conflict) return { ok: false, fieldErrors: {}, error: CONFLICT };
        throw e;
      }
      return { ok: true, value: await taxRates() };
    },

    async paymentMethods() {
      requireSession(deps.session());
      return paymentMethods();
    },

    async addPaymentMethod(input): Promise<SaveResult<PaymentMethod, 'name'>> {
      const session = admin();
      const name = cleanName(input.name);
      if (!name) return { ok: false, fieldErrors: { name: 'Escribe el nombre del método de pago.' } };
      if (await db.get('SELECT 1 FROM payment_methods WHERE name = ? COLLATE NOCASE', [name])) {
        return { ok: false, fieldErrors: { name: 'Ya hay un método con ese nombre.' } };
      }
      const id = deps.ids.next();
      const now = clock.now();
      await db.transaction(async (tx) => {
        const order = await tx.get<{ n: number }>('SELECT coalesce(max(sort_order), 0) + 1 AS n FROM payment_methods');
        await tx.run('INSERT INTO payment_methods (id, name, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [id, name, order?.n ?? 1, now, now]);
        await logActivity(tx, deps, { userId: session.userId, action: 'settings.payment_method_added', entityType: 'payment_method', entityId: id, changes: { name } });
      });
      const created = (await paymentMethods()).find((m) => m.id === id);
      if (!created) throw new Error('No se ha podido crear el método de pago.');
      return { ok: true, value: created };
    },

    async updatePaymentMethod(input): Promise<SaveResult<PaymentMethod[], 'active'>> {
      const session = admin();
      const all = await paymentMethods();
      if (!all.some((m) => m.id === input.id)) throw new Error('Ese método de pago no existe.');
      if (!input.active && !all.some((m) => m.active && m.id !== input.id)) {
        return { ok: false, fieldErrors: { active: 'Tiene que quedar al menos un método de pago activo.' } };
      }
      const { changes } = await db.transaction(async (tx) => {
        const r = await tx.run('UPDATE payment_methods SET active = ?, updated_at = ?, version = version + 1 WHERE id = ? AND version = ?', [
          input.active ? 1 : 0, clock.now(), input.id, input.version,
        ]);
        if (r.changes > 0) await logActivity(tx, deps, { userId: session.userId, action: 'settings.payment_method', entityType: 'payment_method', entityId: input.id, changes: { active: input.active } });
        return r;
      });
      if (changes === 0) return { ok: false, fieldErrors: {}, error: CONFLICT };
      return { ok: true, value: await paymentMethods() };
    },
  };
}
