// Las migraciones se importan como texto; la declaración viaja con ellas a cualquier paquete que las use.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../sql.d.ts" />
import type { Migration } from '../migrator';
import m0001 from './0001_inicial.sql?raw';
import m0002 from './0002_usuarios.sql?raw';
import m0003 from './0003_copias.sql?raw';

/**
 * Lista ordenada de migraciones (DATABASE §5). Solo se añaden al final;
 * una migración publicada no se edita: el migrador lo detecta por su suma de verificación.
 */
export const migrations: readonly Migration[] = [
  { version: 1, name: '0001_inicial', sql: m0001 },
  { version: 2, name: '0002_usuarios', sql: m0002 },
  { version: 3, name: '0003_copias', sql: m0003 },
];
