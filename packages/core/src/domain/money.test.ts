import { describe, expect, it } from 'vitest';
import { documentTotals, lineAmount, roundHalfAwayFromZero } from './money';

describe('roundHalfAwayFromZero', () => {
  it('redondea la mitad alejándose del cero', () => {
    expect(roundHalfAwayFromZero(2.5)).toBe(3);
    expect(roundHalfAwayFromZero(-2.5)).toBe(-3);
    expect(roundHalfAwayFromZero(2.4999)).toBe(2);
  });
});

describe('lineAmount', () => {
  it('multiplica cantidades con decimales sin errores de coma flotante', () => {
    expect(lineAmount(4800, 1.2)).toBe(5760);
    expect(lineAmount(980, 4.5)).toBe(4410);
    expect(lineAmount(1120, 4.2)).toBe(4704);
  });

  it('aplica el descuento en centésimas', () => {
    expect(lineAmount(10000, 1, 1000)).toBe(9000);
    expect(lineAmount(999, 1, 1500)).toBe(849);
  });

  it('rechaza precios que no son céntimos enteros y descuentos fuera de rango', () => {
    expect(() => lineAmount(10.5, 1)).toThrow(RangeError);
    expect(() => lineAmount(100, 1, 10001)).toThrow(RangeError);
    expect(() => lineAmount(100, Number.NaN)).toThrow(RangeError);
  });
});

describe('documentTotals', () => {
  it('calcula la orden OT-2026-0142 del prototipo', () => {
    const lines = [5760, 5490, 11800, 1250, 2400].map((base) => ({ base, taxRate: 2100 }));
    expect(documentTotals(lines)).toMatchObject({ base: 26700, tax: 5607, total: 32307 });
  });

  it('calcula el presupuesto P-2026-0101 y la factura F-2026-0001 del prototipo', () => {
    const quote = [28900, 16800, 4410, 1140, 1690, 1950, 3840].map((base) => ({ base, taxRate: 2100 }));
    expect(documentTotals(quote)).toMatchObject({ base: 58730, tax: 12333, total: 71063 });
    const invoice = [4704, 1280, 2160, 4800, 2890].map((base) => ({ base, taxRate: 2100 }));
    expect(documentTotals(invoice)).toMatchObject({ base: 15834, tax: 3325, total: 19159 });
  });

  it('desglosa varios tipos impositivos, del mayor al menor', () => {
    const totals = documentTotals([
      { base: 10000, taxRate: 2100 },
      { base: 5000, taxRate: 1000 },
      { base: 2000, taxRate: 2100 },
    ]);
    expect(totals.taxes).toEqual([
      { taxRate: 2100, base: 12000, tax: 2520 },
      { taxRate: 1000, base: 5000, tax: 500 },
    ]);
    expect(totals.total).toBe(20020);
  });

  it('admite bases negativas de una rectificativa', () => {
    expect(documentTotals([{ base: -26700, taxRate: 2100 }])).toMatchObject({ tax: -5607, total: -32307 });
  });

  it('devuelve cero sin líneas', () => {
    expect(documentTotals([])).toEqual({ taxes: [], base: 0, tax: 0, total: 0 });
  });
});
