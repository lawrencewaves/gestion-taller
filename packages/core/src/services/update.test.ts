import { describe, expect, it } from 'vitest';
import type { Session } from '@gonzalvo/contracts';
import type { UpdatePort } from '../ports';
import { createUnavailableUpdateService, createUpdateService } from './update';

const admin: Session = { userId: 'u1', username: 'robert', displayName: 'Robert', role: 'admin', permissions: ['config.manage'], idleMinutes: 30 };
const mecanico: Session = { ...admin, role: 'mecanico', permissions: ['ordenes.view'] };

describe('actualizaciones', () => {
  it('solo el administrador comprueba e instala', async () => {
    let installed = 0;
    const port: UpdatePort = {
      check: async () => ({ version: '0.2.0', notes: 'Clientes', date: null }),
      install: async () => {
        installed++;
      },
    };
    let session: Session | null = mecanico;
    const updates = createUpdateService({ port, session: () => session });
    await expect(updates.check()).rejects.toThrow('no tiene permiso');
    await expect(updates.install()).rejects.toThrow('no tiene permiso');
    session = admin;
    expect(await updates.check()).toEqual({ version: '0.2.0', notes: 'Clientes', date: null });
    await updates.install();
    expect(installed).toBe(1);
  });

  it('sin conexión no molesta: simplemente no hay versión nueva', async () => {
    const port: UpdatePort = {
      check: async () => {
        throw new Error('No se ha podido comprobar');
      },
      install: async () => undefined,
    };
    expect(await createUpdateService({ port, session: () => admin }).check()).toBeNull();
  });

  it('en la demo no hay actualizaciones', async () => {
    const demo = createUnavailableUpdateService();
    expect(await demo.check()).toBeNull();
    await expect(demo.install()).rejects.toThrow('demo web');
  });
});
