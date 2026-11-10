import { describe, expect, it } from 'vitest';
import { createPbkdf2Hasher } from './password';

// Pocas iteraciones para que la prueba sea rápida: el algoritmo es el mismo.
const hasher = createPbkdf2Hasher(1000);

describe('PBKDF2 de la demo', () => {
  it('verifica la contraseña correcta y rechaza las demás', async () => {
    const h = await hasher.hash('taller2026');
    expect(h).toMatch(/^pbkdf2-sha256\$1000\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
    expect(await hasher.verify('taller2026', h)).toBe(true);
    expect(await hasher.verify('Taller2026', h)).toBe(false);
  });

  it('usa una sal distinta cada vez', async () => {
    expect(await hasher.hash('igual')).not.toBe(await hasher.hash('igual'));
  });

  it('rechaza formatos desconocidos sin fallar', async () => {
    expect(await hasher.verify('x', '$argon2id$v=19$...')).toBe(false);
    expect(await hasher.verify('x', 'pbkdf2-sha256$abc$$')).toBe(false);
  });

  it('verifica con las iteraciones guardadas, aunque cambie el valor por defecto', async () => {
    const old = await hasher.hash('clave1234');
    expect(await createPbkdf2Hasher(2000).verify('clave1234', old)).toBe(true);
  });
});
