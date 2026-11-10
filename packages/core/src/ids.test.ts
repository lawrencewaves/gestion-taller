import { describe, expect, it } from 'vitest';
import { createUuidV7Generator } from './ids';

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('UUIDv7', () => {
  it('tiene el formato de la versión 7', () => {
    expect(createUuidV7Generator().next()).toMatch(UUID_V7);
  });

  it('codifica el instante de creación en los 48 primeros bits', () => {
    const ms = Date.UTC(2026, 10, 9, 22, 40);
    const id = createUuidV7Generator(() => ms).next();
    expect(parseInt(id.replace(/-/g, '').slice(0, 12), 16)).toBe(ms);
  });

  it('mantiene el orden aunque se creen muchos en el mismo milisegundo o el reloj retroceda', () => {
    let t = 1_800_000_000_000;
    const clock = [t, t, t, t - 5, t + 1];
    const gen = createUuidV7Generator(() => clock.shift() ?? ++t);
    const ids = Array.from({ length: 5000 }, () => gen.next());
    expect([...ids].sort()).toEqual(ids);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
