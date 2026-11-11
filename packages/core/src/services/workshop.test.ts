import { beforeEach, describe, expect, it } from 'vitest';
import { openMemoryDatabase } from '@gonzalvo/adapter-browser';
import type { Session, WorkshopInput } from '@gonzalvo/contracts';
import { openDatabase } from '@gonzalvo/data';
import { createUuidV7Generator } from '../ids';
import type { SqlExecutor } from '../ports';
import { systemClock } from '../ports';
import { createAuthService } from './auth';
import { createWorkshopService, validateWorkshop } from './workshop';

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const valid: WorkshopInput = {
  legalName: '  Taller   de Prueba ',
  tradeName: '',
  taxId: '00000000-t',
  addressLine: 'Calle Ficticia, 1',
  postalCode: '08320',
  city: 'El Masnou',
  phone: '',
  email: 'Taller@Ejemplo.es',
  iban: 'es91 2100 0418 4502 0005 1332',
  logo: null,
  version: 1,
};

describe('validación de los datos del taller', () => {
  it('normaliza y deduce la provincia', () => {
    const r = validateWorkshop(valid);
    expect('value' in r && r.value).toMatchObject({
      legalName: 'Taller de Prueba', taxId: '00000000T', province: 'Barcelona', email: 'taller@ejemplo.es', iban: 'ES91 2100 0418 4502 0005 1332',
    });
  });

  it('obligatorios para facturar y formato de lo opcional', () => {
    const r = validateWorkshop({ ...valid, legalName: ' ', taxId: '12345678A', postalCode: '99999', city: '', phone: '12', email: 'x@', iban: 'ES00', logo: 'data:image/svg+xml;base64,PHN2Zz4=' });
    expect('fieldErrors' in r && Object.keys(r.fieldErrors).sort()).toEqual(
      ['city', 'email', 'iban', 'legalName', 'logo', 'phone', 'postalCode', 'taxId'].sort(),
    );
    const big = `data:image/png;base64,${'A'.repeat(420_000)}`;
    expect('fieldErrors' in validateWorkshop({ ...valid, logo: big })).toBe(true);
    expect('value' in validateWorkshop({ ...valid, logo: PNG })).toBe(true);
  });
});

let db: SqlExecutor;
let session: Session | null;
let workshop: ReturnType<typeof createWorkshopService>;
/** Versión de partida: al abrir la base ya se anota el entorno. */
let v0: number;

beforeEach(async () => {
  db = (await openMemoryDatabase()).executor;
  await openDatabase(db, { environment: 'LOCAL', clock: systemClock });
  const ids = createUuidV7Generator();
  const auth = createAuthService({ db, hasher: { hash: async (p) => p, verify: async (p, h) => p === h }, clock: systemClock, ids });
  session = await auth.setupAdmin({ username: 'robert', displayName: 'Robert', password: 'taller2026' });
  workshop = createWorkshopService({ db, clock: systemClock, ids, session: () => session });
  v0 = (await workshop.get()).version;
});

describe('servicio de datos del taller', () => {
  it('guarda, registra qué cambió y devuelve la versión nueva', async () => {
    expect(await workshop.get()).toMatchObject({ legalName: '', logo: null });
    const r = await workshop.update({ ...valid, logo: PNG, version: v0 });
    expect(r.ok && r.value).toMatchObject({ legalName: 'Taller de Prueba', province: 'Barcelona', logo: PNG, version: v0 + 1 });
    const log = await db.get<{ changes: string }>("SELECT changes FROM activity_log WHERE action = 'settings.workshop'");
    expect(JSON.parse(log?.changes ?? '{}').fields).toEqual(
      expect.arrayContaining(['legalName', 'taxId', 'addressLine', 'postalCode', 'city', 'province', 'email', 'iban', 'logo']),
    );
    // Sin cambios no se toca nada.
    const again = await workshop.update({ ...valid, logo: PNG, version: v0 + 1 });
    expect(again.ok && again.value.version).toBe(v0 + 1);
  });

  it('no pisa los cambios de otra persona', async () => {
    expect((await workshop.update({ ...valid, version: v0 })).ok).toBe(true);
    const stale = await workshop.update({ ...valid, city: 'Teià', version: v0 });
    expect(stale.ok).toBe(false);
    expect(!stale.ok && stale.error).toContain('Otra persona');
    expect((await workshop.get()).city).toBe('El Masnou');
  });

  it('cualquiera lo consulta; solo el administrador lo cambia', async () => {
    if (!session) throw new Error('Falta la sesión de prueba');
    session = { ...session, permissions: ['ordenes.view'] };
    await expect(workshop.get()).resolves.toMatchObject({ version: v0 });
    await expect(workshop.update({ ...valid, version: v0 })).rejects.toThrow('no tiene permiso');
    session = null;
    await expect(workshop.get()).rejects.toThrow('sesión ha caducado');
  });

  it('errores de formulario sin tocar la base', async () => {
    const r = await workshop.update({ ...valid, taxId: 'X', version: v0 });
    expect(!r.ok && r.fieldErrors.taxId).toContain('no es correcto');
    expect((await workshop.get()).version).toBe(v0);
  });
});
