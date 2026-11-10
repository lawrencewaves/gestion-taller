/** Actualizaciones del programa instalado (D-012, D-041). En la demo no existen: la web siempre es la última. */

export interface UpdateInfo {
  version: string;
  /** Novedades de la versión, del CHANGELOG. */
  notes: string | null;
  date: string | null;
}

export interface UpdateService {
  /** `null` si ya es la última o si no se puede comprobar ahora (sin conexión). */
  check(): Promise<UpdateInfo | null>;
  /** Descarga, comprueba la firma, instala y reinicia el programa. */
  install(): Promise<void>;
}
