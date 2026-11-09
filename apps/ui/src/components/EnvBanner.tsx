import type { AppInfo } from '@gonzalvo/contracts';
import { texts } from '../texts';

/** Franja de entorno con rayas de seguridad (RF-DEM-07). No existe en TALLER. */
export function EnvBanner({ info }: { info: AppInfo }) {
  if (info.environment === 'TALLER') return null;
  const label =
    info.environment === 'PREVIEW' ? texts.env.PREVIEW(info.branch ?? 'rama') : texts.env[info.environment];
  return (
    <div className="gz-env" role="status">
      <span className="gz-env__tag">{label}</span>
    </div>
  );
}
