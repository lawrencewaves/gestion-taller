import { describe, expect, it } from 'vitest';
import type { Environment, FiscalMode } from '@gonzalvo/contracts';
import { assertCanIssue, createNullFiscalGateway, FiscalError, fiscalPolicy, type FiscalGateway, guardFiscalGateway } from './fiscal';

const environments: Environment[] = ['LOCAL', 'PREVIEW', 'DEMO', 'TALLER'];
const modes: FiscalMode[] = ['off', 'verifactu', 'no_verifactu'];
const submission = { recordId: 'r1', specVersion: 'x', payload: {} };

describe('reglas fiscales', () => {
  it('fuera de TALLER nunca se habla con la AEAT, sea cual sea la modalidad (RF-FIS-10)', () => {
    for (const env of environments.filter((e) => e !== 'TALLER')) {
      for (const mode of modes) {
        for (const ready of [false, true]) {
          expect(fiscalPolicy(env, mode, ready)).toMatchObject({ aeatAllowed: false, canIssue: true, simulated: true });
        }
      }
    }
  });

  it('en TALLER no se emite mientras la modalidad esté desactivada o el módulo sin validar (D-014)', () => {
    for (const mode of modes) {
      const p = fiscalPolicy('TALLER', mode);
      expect(p).toMatchObject({ canIssue: false, aeatAllowed: false, simulated: false });
      expect(() => assertCanIssue(p)).toThrow('se factura con Stall');
    }
    expect(fiscalPolicy('TALLER', 'off', true).canIssue).toBe(false);
    expect(fiscalPolicy('TALLER', 'verifactu', true)).toMatchObject({ canIssue: true, aeatAllowed: true, simulated: false });
  });

  it('la barrera sustituye cualquier pasarela si no se permite hablar con la AEAT', async () => {
    let calls = 0;
    const real: FiscalGateway = {
      submit: async () => {
        calls++;
        return { status: 'accepted', response: null };
      },
    };
    for (const env of environments) {
      for (const mode of modes) {
        await expect(guardFiscalGateway(fiscalPolicy(env, mode), real).submit(submission)).rejects.toThrow(FiscalError);
      }
    }
    expect(calls).toBe(0);
    await guardFiscalGateway(fiscalPolicy('TALLER', 'verifactu', true), real).submit(submission);
    expect(calls).toBe(1);
  });

  it('la pasarela nula no envía', async () => {
    await expect(createNullFiscalGateway().submit(submission)).rejects.toThrow('desactivada');
  });
});
