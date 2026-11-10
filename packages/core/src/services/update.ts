import type { Session, UpdateInfo, UpdateService } from '@gonzalvo/contracts';
import type { UpdatePort } from '../ports';
import { requirePermission } from './auth';

/** Solo el administrador ve e instala actualizaciones (`config.manage`). */
export function createUpdateService(deps: { port: UpdatePort; session: () => Session | null }): UpdateService {
  return {
    async check(): Promise<UpdateInfo | null> {
      requirePermission(deps.session(), 'config.manage');
      try {
        return await deps.port.check();
      } catch {
        return null; // Sin conexión o sin publicaciones: se volverá a mirar en la próxima entrada.
      }
    },
    async install() {
      requirePermission(deps.session(), 'config.manage');
      await deps.port.install();
    },
  };
}

/** Demo: la web se actualiza sola al publicar. */
export function createUnavailableUpdateService(): UpdateService {
  return {
    check: async () => null,
    install: async () => {
      throw new Error('La demo web no se instala: siempre es la última versión publicada.');
    },
  };
}
