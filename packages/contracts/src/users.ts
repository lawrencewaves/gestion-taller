/** Gestión de usuarios y permisos (RF-USR-03, RF-USR-05). Solo con `users.manage`. */
import type { Permission, Role } from './auth';
import type { SaveResult } from './workshop';

export interface UserSummary {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  active: boolean;
  /** Bloqueado ahora mismo por intentos fallidos. */
  locked: boolean;
  lastLoginAt: string | null;
  version: number;
}

export interface NewUser {
  username: string;
  displayName: string;
  role: Role;
  password: string;
}

export interface UserUpdate {
  id: string;
  displayName: string;
  role: Role;
  active: boolean;
  version: number;
}

export type UserField = 'username' | 'displayName' | 'role' | 'active' | 'password' | 'currentPassword';

/** Permisos que se pueden ajustar por rol. Los de administración son siempre y solo del administrador. */
export const PERMISSION_GROUPS: readonly { label: string; view: Permission; edit: Permission; extra?: { permission: Permission; label: string } }[] = [
  { label: 'Agenda', view: 'agenda.view', edit: 'agenda.edit' },
  { label: 'Órdenes', view: 'ordenes.view', edit: 'ordenes.edit' },
  { label: 'Presupuestos', view: 'presupuestos.view', edit: 'presupuestos.edit' },
  { label: 'Facturas', view: 'facturas.view', edit: 'facturas.edit', extra: { permission: 'facturas.emit', label: 'Emitir' } },
  { label: 'Cobros', view: 'cobros.view', edit: 'cobros.edit', extra: { permission: 'cobros.refund', label: 'Devolver' } },
  { label: 'Clientes', view: 'clientes.view', edit: 'clientes.edit' },
  { label: 'Vehículos', view: 'vehiculos.view', edit: 'vehiculos.edit' },
  { label: 'Catálogo', view: 'catalogo.view', edit: 'catalogo.edit' },
];

export const ADMIN_ONLY_PERMISSIONS: readonly Permission[] = ['config.manage', 'users.manage', 'activity.view', 'system.diagnostics'];

export interface RolePermissions {
  role: Role;
  permissions: Permission[];
  /** El administrador tiene siempre todos: no se edita. */
  editable: boolean;
}

/** Límites del cierre de sesión por inactividad, en minutos. */
export const IDLE_MINUTES_RANGE = { min: 5, max: 480 } as const;

export interface UsersService {
  list(): Promise<UserSummary[]>;
  create(input: NewUser): Promise<SaveResult<UserSummary, UserField>>;
  update(input: UserUpdate): Promise<SaveResult<UserSummary, UserField>>;
  /** El administrador pone una contraseña nueva a otro usuario. También lo desbloquea. */
  resetPassword(id: string, password: string): Promise<SaveResult<null, UserField>>;
  /** Cualquier usuario cambia la suya sabiendo la actual. */
  changeOwnPassword(currentPassword: string, password: string): Promise<SaveResult<null, UserField>>;
  rolePermissions(): Promise<RolePermissions[]>;
  setRolePermissions(role: Role, permissions: Permission[]): Promise<RolePermissions>;
  idleMinutes(): Promise<number>;
  setIdleMinutes(minutes: number): Promise<SaveResult<number, 'idleMinutes'>>;
}
