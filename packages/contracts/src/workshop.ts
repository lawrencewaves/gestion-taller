/** Datos del taller (RF-CFG-01). Salen en presupuestos, facturas y correos. */

export interface WorkshopProfile {
  /** Nombre y apellidos del titular o razón social: el que figura en las facturas. */
  legalName: string;
  /** Nombre comercial, si es distinto. */
  tradeName: string;
  taxId: string;
  addressLine: string;
  postalCode: string;
  city: string;
  /** Se deduce del código postal. */
  province: string;
  phone: string;
  email: string;
  /** IBAN agrupado de cuatro en cuatro, o vacío. */
  iban: string;
  /** Imagen PNG o JPEG como `data:` URL, o `null`. */
  logo: string | null;
  updatedAt: string;
  /** Para no pisar cambios de otro usuario. */
  version: number;
}

export type WorkshopInput = Omit<WorkshopProfile, 'province' | 'updatedAt'>;

export type WorkshopField = keyof Omit<WorkshopInput, 'version'>;

/** Resultado de guardar un formulario: o el valor guardado, o qué campo está mal y por qué. */
export type SaveResult<T, F extends string = string> =
  | { ok: true; value: T }
  | { ok: false; fieldErrors: Partial<Record<F, string>>; error?: string };

/** Tamaño máximo del logotipo ya reducido por la interfaz. */
export const LOGO_MAX_BYTES = 300 * 1024;

export interface WorkshopService {
  /** Cualquier usuario con sesión: los documentos los necesitan. */
  get(): Promise<WorkshopProfile>;
  /** Solo el administrador (`config.manage`). */
  update(input: WorkshopInput): Promise<SaveResult<WorkshopProfile, WorkshopField>>;
}
