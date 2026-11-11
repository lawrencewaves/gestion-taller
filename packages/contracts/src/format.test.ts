import { describe, expect, it } from 'vitest';
import { formatBytes, formatPercentBp, formatDate, formatEUR, formatKm, formatPlate } from './format';

describe('formatos del taller', () => {
  it('importes con punto de miles, coma decimal y símbolo detrás', () => {
    expect(formatEUR(148235)).toBe('1.482,35 €');
    expect(formatEUR(5607)).toBe('56,07 €');
    expect(formatEUR(-32307)).toBe('-323,07 €');
    expect(formatEUR(0)).toBe('0,00 €');
  });

  it('kilómetros con punto de miles, también por debajo de 10.000', () => {
    expect(formatKm(128400)).toBe('128.400 km');
    expect(formatKm(4500)).toBe('4.500 km');
  });

  it('porcentajes desde puntos básicos', () => {
    expect(formatPercentBp(2100)).toBe('21 %');
    expect(formatPercentBp(1050)).toBe('10,5 %');
    expect(formatPercentBp(0)).toBe('0 %');
  });

  it('tamaños de archivo en KB y MB', () => {
    expect(formatBytes(300)).toBe('1 KB');
    expect(formatBytes(870_400)).toBe('850 KB');
    expect(formatBytes(13_002_342)).toBe('12,4 MB');
  });

  it('fechas dd/mm/aaaa y hora de 24 horas', () => {
    const d = new Date(2026, 10, 8, 9, 30);
    expect(formatDate(d)).toBe('08/11/2026');
    expect(formatDate(d, true)).toBe('08/11/2026 · 09:30');
    expect(formatDate('no es una fecha')).toBe('');
  });

  it('matrículas actuales con espacio; el resto en mayúsculas', () => {
    expect(formatPlate('1234klm')).toBe('1234 KLM');
    expect(formatPlate('9087-HBD')).toBe('9087 HBD');
    expect(formatPlate('b-1234-xy')).toBe('B1234XY');
  });
});
