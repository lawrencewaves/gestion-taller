import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import type { Session } from '@gonzalvo/contracts';
import { openDatabase } from '@gonzalvo/data';
import { createUuidV7Generator } from '../ids';
import type { Clock, SqlExecutor } from '../ports';
import { createAuthService } from './auth';
import { createBillingService, formatDocNumber, nextDocumentNumber, parsePercent } from './billing';

let now = '2026-11-11T10:00:00.000Z';
const clock: Clock = { now: () => now };
const ids = createUuidV7Generator();
let db: SqlExecutor;
let session: Session | null;
let billing: ReturnType<typeof createBillingService>;

beforeEach(async () => {
  now = '2026-11-11T10:00:00.000Z';
  db = (await openMemoryDatabase()).executor;
  await openDatabase(db, { environment: 'LOCAL', clock });
  const auth = createAuthService({ db, hasher: { hash: async (p) => p, verify: async (p, h) => p === h }, clock, ids });
  session = await auth.setupAdmin({ username: 'robert', displayName: 'Robert', password: 'taller2026' });
  billing = createBillingService({ db, clock, ids, session: () => session });
});

describe('reglas', () => {
  it('formato de número y porcentajes como los escribe una persona', () => {
    expect(formatDocNumber('F', 2026, 7)).toBe('F-2026-0007');
    expect(formatDocNumber('F', 2026, 12345)).toBe('F-2026-12345');
    expect(parsePercent('21')).toBe(2100);
    expect(parsePercent('10,5')).toBe(1050);
    expect(parsePercent('5.25 %')).toBe(525);
    expect(parsePercent('0')).toBe(0);
    expect(parsePercent('101')).toBeNull();
    expect(parsePercent('abc')).toBeNull();
    expect(parsePercent('1,234')).toBeNull();
  });
});

describe('series', () => {
  it('prefijos de fábrica, numeración correlativa y serie nueva cada año', async () => {
    const all = await billing.series();
    expect(all.find((s) => s.docType === 'invoice')).toMatchObject({ prefix: 'F', year: 2026, nextNumber: 1, locked: false, example: 'F-2026-0001' });
    const a = await db.transaction((tx) => nextDocumentNumber(tx, { clock, ids }, 'invoice'));
    const b = await db.transaction((tx) => nextDocumentNumber(tx, { clock, ids }, 'invoice'));
    expect([a.formatted, b.formatted]).toEqual(['F-2026-0001', 'F-2026-0002']);
    expect((await billing.series()).find((s) => s.docType === 'invoice')).toMatchObject({ nextNumber: 3, locked: true });
    now = '2027-01-02T09:00:00.000Z';
    const c = await db.transaction((tx) => nextDocumentNumber(tx, { clock, ids }, 'invoice'));
    expect(c.formatted).toBe('F-2027-0001');
  });

  it('si la transacción del documento falla, el número no se consume', async () => {
    await expect(db.transaction(async (tx) => {
      await nextDocumentNumber(tx, { clock, ids }, 'quote');
      throw new Error('falla al guardar el presupuesto');
    })).rejects.toThrow();
    expect((await billing.series()).find((s) => s.docType === 'quote')?.nextNumber).toBe(1);
  });

  it('cambiar prefijo y primer número mientras no se haya usado; después, bloqueada', async () => {
    const bad = await billing.saveSeries({ docType: 'invoice', prefix: 'f a', nextNumber: 0 });
    expect(!bad.ok && Object.keys(bad.fieldErrors).sort()).toEqual(['nextNumber', 'prefix']);
    const dup = await billing.saveSeries({ docType: 'invoice', prefix: 'p', nextNumber: 1 });
    expect(!dup.ok && dup.fieldErrors.prefix).toContain('otro tipo');
    const ok = await billing.saveSeries({ docType: 'invoice', prefix: 'fa', nextNumber: 120 });
    expect(ok.ok && ok.value).toMatchObject({ prefix: 'FA', nextNumber: 120, example: 'FA-2026-0120', locked: false });
    const first = await db.transaction((tx) => nextDocumentNumber(tx, { clock, ids }, 'invoice'));
    expect(first.formatted).toBe('FA-2026-0120');
    const locked = await billing.saveSeries({ docType: 'invoice', prefix: 'FB', nextNumber: 1 });
    expect(!locked.ok && locked.error).toContain('no se puede cambiar');
    // El año siguiente hereda el prefijo.
    now = '2027-01-02T09:00:00.000Z';
    expect((await billing.series()).find((s) => s.docType === 'invoice')).toMatchObject({ prefix: 'FA', nextNumber: 1, locked: false });
  });
});

describe('impuestos y métodos de pago', () => {
  it('añadir un tipo y cambiar el tipo por defecto (solo uno)', async () => {
    const r = await billing.addTaxRate({ name: 'IGIC 7 %', percent: '7' });
    expect(r.ok && r.value).toMatchObject({ rateBp: 700, isDefault: false, active: true });
    expect((await billing.addTaxRate({ name: 'igic 7 %', percent: '7' })).ok).toBe(false);
    if (!r.ok) throw new Error('Preparación fallida');
    const off = await billing.updateTaxRate({ id: r.value.id, active: false, isDefault: true, version: r.value.version });
    expect(!off.ok && off.fieldErrors.active).toContain('activo');
    const def = await billing.updateTaxRate({ id: r.value.id, active: true, isDefault: true, version: r.value.version });
    expect(def.ok && def.value.filter((t) => t.isDefault).map((t) => t.name)).toEqual(['IGIC 7 %']);
    const general = (await billing.taxRates()).find((t) => t.rateBp === 2100);
    if (!general) throw new Error('Falta el 21 %');
    const stale = await billing.updateTaxRate({ id: r.value.id, active: true, isDefault: false, version: r.value.version });
    expect(!stale.ok && stale.fieldErrors.active).toContain('otro tipo por defecto');
  });

  it('un cambio de tipo por defecto que choca con otra persona no deja el taller sin tipo por defecto', async () => {
    const reduced = (await billing.taxRates()).find((t) => t.rateBp === 1000);
    if (!reduced) throw new Error('Falta el 10 %');
    const stale = await billing.updateTaxRate({ id: reduced.id, active: true, isDefault: true, version: reduced.version - 1 });
    expect(!stale.ok && stale.error).toContain('Otra persona');
    expect((await billing.taxRates()).filter((t) => t.isDefault).map((t) => t.rateBp)).toEqual([2100]);
  });

  it('métodos de pago: añadir y desactivar, pero siempre queda uno', async () => {
    const r = await billing.addPaymentMethod({ name: ' Bizum ' });
    expect(r.ok && r.value.name).toBe('Bizum');
    const methods = await billing.paymentMethods();
    for (const m of methods.slice(0, -1)) expect((await billing.updatePaymentMethod({ id: m.id, active: false, version: m.version })).ok).toBe(true);
    const last = methods[methods.length - 1];
    if (!last) throw new Error('Sin métodos');
    const lastOff = await billing.updatePaymentMethod({ id: last.id, active: false, version: last.version });
    expect(!lastOff.ok && lastOff.fieldErrors.active).toContain('al menos un método');
  });

  it('consultar con sesión; cambiar solo con config.manage', async () => {
    if (!session) throw new Error('Falta la sesión');
    session = { ...session, permissions: ['ordenes.view'] };
    await expect(billing.series()).resolves.toHaveLength(5);
    await expect(billing.addPaymentMethod({ name: 'Cheque' })).rejects.toThrow('no tiene permiso');
  });
});
