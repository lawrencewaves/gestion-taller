import { describe, expect, it } from 'vitest';
import { normalizePlate } from './vehicle';

describe('normalizePlate', () => {
  it('unifica las formas habituales de escribir una matrícula', () => {
    for (const raw of ['1234 klm', '1234-KLM', ' 1234KLM ', '1234.KLM']) {
      expect(normalizePlate(raw)).toBe('1234KLM');
    }
  });

  it('respeta matrículas antiguas y extranjeras', () => {
    expect(normalizePlate('B-1234-XY')).toBe('B1234XY');
    expect(normalizePlate('AB 123 CD')).toBe('AB123CD');
  });
});
