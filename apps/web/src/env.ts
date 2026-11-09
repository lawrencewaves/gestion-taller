import type { AppInfo, Environment } from '@gonzalvo/contracts';

/** El entorno lo fija la compilación, nunca el usuario (ARCHITECTURE §10). */
const environments: Environment[] = ['LOCAL', 'PREVIEW', 'DEMO'];
const raw = import.meta.env.VITE_ENV as string | undefined;
const environment: Environment = environments.find((e) => e === raw) ?? 'LOCAL';
const branch = (import.meta.env.VITE_BRANCH as string | undefined) ?? '';

export const appInfo: AppInfo = {
  environment,
  version: (import.meta.env.VITE_VERSION as string | undefined) ?? 'dev',
  ...(environment === 'PREVIEW' && branch ? { branch } : {}),
};

/** Un archivo de base de datos por entorno y rama: DEMO y PREVIEW comparten dominio (ARCHITECTURE §7). */
export function databaseName(info: AppInfo): string {
  const slug = (info.branch ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (info.environment === 'PREVIEW') return `preview-${slug || 'rama'}.db`;
  return `${info.environment.toLowerCase()}.db`;
}
