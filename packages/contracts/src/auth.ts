/**
 * Usuarios, roles y permisos (REQUIREMENTS §2, UX §3).
 * La lista de permisos es cerrada: la base de datos solo guarda nombres de esta lista.
 */

export const ROLES = ['admin', 'recepcion', 'mecanico'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  recepcion: 'Recepción',
  mecanico: 'Mecánico',
};

export const PERMISSIONS = [
  'agenda.view', 'agenda.edit',
  'ordenes.view', 'ordenes.edit',
  'presupuestos.view', 'presupuestos.edit',
  'facturas.view', 'facturas.edit', 'facturas.emit',
  'cobros.view', 'cobros.edit', 'cobros.refund',
  'clientes.view', 'clientes.edit',
  'vehiculos.view', 'vehiculos.edit',
  'catalogo.view', 'catalogo.edit',
  'config.manage', 'users.manage', 'activity.view',
  'system.diagnostics',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export interface Session {
  userId: string;
  username: string;
  displayName: string;
  role: Role;
  permissions: Permission[];
  /** Minutos sin actividad tras los que se cierra la sesión (RF-USR-05). */
  idleMinutes: number;
}

export interface AuthStatus {
  /** Sin usuarios todavía: hay que crear el primer administrador. */
  needsSetup: boolean;
  /** Solo en la demo: usuarios de prueba y su contraseña pública, para mostrarlos en la entrada. */
  demo?: { usernames: string[]; password: string };
}

export interface NewAdmin {
  username: string;
  displayName: string;
  password: string;
}

export interface AuthService {
  status(): Promise<AuthStatus>;
  /** Solo funciona mientras no exista ningún usuario. */
  setupAdmin(input: NewAdmin): Promise<Session>;
  login(username: string, password: string): Promise<Session>;
  logout(): Promise<void>;
  /** Sesión abierta en este programa, o `null`. */
  session(): Promise<Session | null>;
}

/** Normas de contraseña (RF-USR-01): longitud antes que símbolos raros, como recomiendan las guías actuales. */
export const PASSWORD_MIN_LENGTH = 8;
