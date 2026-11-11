/** Copias de seguridad (REQUIREMENTS §14, ARCHITECTURE §8, D-038). Solo existen en el programa instalado. */

/** Automática diaria, manual a la carpeta de copias, o copia suelta a otra carpeta (USB). */
export type BackupKind = 'auto' | 'manual' | 'export';

export interface BackupRecord {
  id: string;
  createdAt: string;
  kind: BackupKind;
  /** Carpeta de destino. */
  destination: string;
  /** `null` si la copia falló. */
  fileName: string | null;
  sizeBytes: number | null;
  error: string | null;
}

/** Una copia que está en la carpeta de copias. */
export interface BackupFile {
  name: string;
  createdAt: string;
  sizeBytes: number;
}

export interface BackupStatus {
  /** `false` en la demo: los datos viven en el navegador (RF-DEM-05). */
  available: boolean;
  folder: string | null;
  /** Hay clave de copias guardada en este ordenador. */
  hasKey: boolean;
  /** Última copia correcta a la carpeta de copias. */
  lastOk: BackupRecord | null;
  /** Último intento, solo si falló después de la última correcta. */
  lastError: BackupRecord | null;
  /** No hay copia correcta en las últimas 48 horas (RF-BAK-08). */
  overdue: boolean;
  keepDaily: number;
  keepMonthly: number;
}

export const BACKUP_OVERDUE_HOURS = 48;

/** Límites de la retención: días con copia diaria y meses con copia mensual. */
export const BACKUP_RETENTION_RANGE = { daily: { min: 1, max: 366 }, monthly: { min: 0, max: 120 } } as const;

export interface BackupService {
  status(): Promise<BackupStatus>;
  /** Abre el selector de carpetas. Si se cancela, no cambia nada. */
  chooseFolder(): Promise<BackupStatus>;
  /** Crea la clave y la devuelve para apuntarla en la hoja de recuperación. */
  createKey(): Promise<string>;
  /** Vuelve a mostrar la clave guardada, para reimprimir la hoja. */
  revealKey(): Promise<string>;
  /** Clave de una instalación anterior: solo se acepta si abre la copia más reciente de la carpeta. */
  enterKey(key: string): Promise<void>;
  backupNow(): Promise<BackupRecord>;
  /** Copia a otra carpeta (USB o disco externo). `null` si se cancela el selector. */
  exportCopy(): Promise<BackupRecord | null>;
  /** Cuántas copias diarias y mensuales se conservan (RF-CFG-05). */
  setRetention(keepDaily: number, keepMonthly: number): Promise<BackupStatus>;
  list(): Promise<BackupFile[]>;
  /** Sustituye los datos actuales por los de la copia. Después hay que volver a arrancar la interfaz. */
  restore(fileName: string): Promise<void>;
}
