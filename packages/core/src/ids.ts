import type { IdGenerator } from './ports';

/** Web Crypto existe en navegadores, Workers, Node y Tauri; se tipa aquí para no depender de una plataforma. */
export function webCrypto(): { getRandomValues(b: Uint8Array): Uint8Array; subtle: { digest(alg: string, data: Uint8Array): Promise<ArrayBuffer> } } {
  return (globalThis as unknown as { crypto: ReturnType<typeof webCrypto> }).crypto;
}

const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

/**
 * UUID versión 7 (RFC 9562): 48 bits de milisegundos + aleatorio.
 * Ordenable por fecha y sin colisiones entre dispositivos (ARCHITECTURE §13).
 * Dentro del mismo milisegundo se mantiene el orden incrementando el contador.
 */
export function createUuidV7Generator(
  now: () => number = Date.now,
  random: (bytes: Uint8Array) => void = (b) => webCrypto().getRandomValues(b),
): IdGenerator {
  let lastMs = -1;
  let counter = 0;
  return {
    next() {
      let ms = now();
      if (ms <= lastMs) {
        ms = lastMs;
        counter++;
        if (counter > 0xfff) {
          ms = ++lastMs;
          counter = 0;
        }
      } else {
        counter = 0;
      }
      lastMs = ms;

      const b = new Uint8Array(16);
      random(b);
      // 48 bits de marca de tiempo, big-endian.
      for (let i = 5; i >= 0; i--) {
        b[i] = ms % 256;
        ms = Math.floor(ms / 256);
      }
      // Versión 7 y contador de 12 bits para el orden dentro del milisegundo.
      b[6] = 0x70 | ((counter >> 8) & 0x0f);
      b[7] = counter & 0xff;
      // Variante RFC 9562.
      b[8] = 0x80 | ((b[8] ?? 0) & 0x3f);
      const h = hex(b);
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
    },
  };
}
