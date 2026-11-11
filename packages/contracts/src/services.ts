import type { AuthService } from './auth';
import type { BackupService } from './backup';
import type { BillingService } from './billing';
import type { FiscalPolicy } from './fiscal';
import type { UpdateService } from './update';
import type { UsersService } from './users';
import type { WorkshopService } from './workshop';

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
  /** Modalidad fiscal y qué permite en este entorno (D-039). */
  fiscal: FiscalPolicy;
  error?: string;
}

export interface SystemService {
  diagnostics(): Promise<DiagnosticsReport>;
}

export interface Services {
  system: SystemService;
  auth: AuthService;
  backups: BackupService;
  updates: UpdateService;
  workshop: WorkshopService;
  users: UsersService;
  billing: BillingService;
}
