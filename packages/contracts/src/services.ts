import type { AuthService } from './auth';
import type { BackupService } from './backup';

/**
 * Lo único que la interfaz conoce del resto del sistema (ARCHITECTURE §5).
 * Cada entorno aporta su implementación: local en escritorio, Web Worker en la demo.
 */

export type Environment = 'LOCAL' | 'PREVIEW' | 'DEMO' | 'TALLER';

export interface AppInfo {
  environment: Environment;
  /** Rama publicada, solo en PREVIEW. */
  branch?: string;
  version: string;
}

/** Qué funciones existen en este entorno. La interfaz no comprueba el entorno por su cuenta. */
export interface Capabilities {
  backups: boolean;
  directPrint: boolean;
  demoReset: boolean;
}

export interface DiagnosticsReport {
  sqliteVersion: string;
  /** Dónde se guardan los datos: almacenamiento persistente del navegador o solo memoria. */
  storage: 'opfs' | 'memory' | 'native';
  dbName: string;
  /** Número de la última migración aplicada. */
  schemaVersion: number;
  /** Veces que se ha abierto esta base de datos, incluida la actual. */
  opens: number;
  transactionsOk: boolean;
  foreignKeysOk: boolean;
  error?: string;
}

export interface SystemService {
  diagnostics(): Promise<DiagnosticsReport>;
}

export interface Services {
  system: SystemService;
  auth: AuthService;
  backups: BackupService;
}
