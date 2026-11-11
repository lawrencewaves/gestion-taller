import { describe, expect, it } from 'vitest';
import {
  formatIban, isValidEmail, isValidIban, isValidPhone, normalizeIban, normalizeTaxId, provinceFromPostalCode, taxIdKind,
} from './identity';

describe('NIF', () => {
  it('normaliza lo que se escribe a mano', () => {
    expect(normalizeTaxId(' 12.345.678-z ')).toBe('12345678Z');
  });

  it('DNI con su letra', () => {
    expect(taxIdKind('12345678Z')).toBe('dni');
    expect(taxIdKind('00000000T')).toBe('dni');
    expect(taxIdKind('12345678A')).toBeNull();
    expect(taxIdKind('1234567Z')).toBeNull();
  });

  it('NIE con X, Y o Z', () => {
    expect(taxIdKind('X1234567L')).toBe('nie');
    expect(taxIdKind('Y1234567X')).toBe('nie');
    expect(taxIdKind('Z1234567R')).toBe('nie');
    expect(taxIdKind('X1234567A')).toBeNull();
  });

  it('NIF de entidades: número o letra de control según el tipo', () => {
    expect(taxIdKind('B12345674')).toBe('entity');
    expect(taxIdKind('B1234567D')).toBeNull(); // Las B llevan número.
    expect(taxIdKind('P1234567D')).toBe('entity'); // Las P llevan letra.
    expect(taxIdKind('P12345674')).toBeNull();
    expect(taxIdKind('G12345674')).toBe('entity'); // Las G admiten las dos.
    expect(taxIdKind('G1234567D')).toBe('entity');
    expect(taxIdKind('B12345675')).toBeNull();
  });

  it('NIF especiales K, L y M', () => {
    expect(taxIdKind('K1234567L')).toBe('special');
    expect(taxIdKind('K1234567A')).toBeNull();
  });
});

describe('IBAN', () => {
  it('comprueba el control y la longitud española', () => {
    const iban = normalizeIban('es91 2100 0418 4502 0005 1332');
    expect(iban).toBe('ES9121000418450200051332');
    expect(isValidIban(iban)).toBe(true);
    expect(isValidIban('ES9121000418450200051333')).toBe(false);
    expect(isValidIban('ES91210004184502000513')).toBe(false);
    expect(isValidIban('DE89370400440532013000')).toBe(true);
    expect(formatIban(iban)).toBe('ES91 2100 0418 4502 0005 1332');
  });
});

describe('dirección y contacto', () => {
  it('provincia por el código postal', () => {
    expect(provinceFromPostalCode('08320')).toBe('Barcelona');
    expect(provinceFromPostalCode('01001')).toBe('Araba/Álava');
    expect(provinceFromPostalCode('52001')).toBe('Melilla');
    expect(provinceFromPostalCode('53001')).toBeNull();
    expect(provinceFromPostalCode('00001')).toBeNull();
    expect(provinceFromPostalCode('8320')).toBeNull();
  });

  it('email y teléfono', () => {
    expect(isValidEmail('taller@ejemplo.es')).toBe(true);
    expect(isValidEmail('taller@ejemplo')).toBe(false);
    expect(isValidPhone('+34 600 000 000')).toBe(true);
    expect(isValidPhone('93 555 12 12')).toBe(true);
    expect(isValidPhone('600-000')).toBe(false);
  });
});
