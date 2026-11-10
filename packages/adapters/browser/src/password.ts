import type { PasswordHasher } from '@gonzalvo/core';

/**
 * Cifrado de contraseñas de la demo con PBKDF2-SHA256 del propio navegador (D-037):
 * sin dependencias y suficiente para usuarios de prueba. El escritorio usa Argon2id en Rust.
 * Formato: pbkdf2-sha256$<iteraciones>$<sal base64>$<resultado base64>.
 */
export const PBKDF2_ITERATIONS = 600_000;

const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

/** Comparación en tiempo constante: no revela cuántos bytes coinciden. */
function equal(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

export function createPbkdf2Hasher(iterations = PBKDF2_ITERATIONS): PasswordHasher {
  return {
    async hash(password) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      return `pbkdf2-sha256$${iterations}$${b64(salt)}$${b64(await derive(password, salt, iterations))}`;
    },
    async verify(password, stored) {
      const [alg, iter, salt, hash] = stored.split('$');
      const n = Number(iter);
      if (alg !== 'pbkdf2-sha256' || !Number.isInteger(n) || n < 1 || !salt || !hash) return false;
      return equal(await derive(password, unb64(salt), n), unb64(hash));
    },
  };
}
