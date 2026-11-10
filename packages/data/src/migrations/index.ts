import type { Migration } from '../migrator';
import m0001 from './0001_inicial.sql?raw';

/**
 * Lista ordenada de migraciones (DATABASE §5). Solo se añaden al final;
 * una migración publicada no se edita: el migrador lo detecta por su suma de verificación.
 */
export const migrations: readonly Migration[] = [{ version: 1, name: '0001_inicial', sql: m0001 }];
