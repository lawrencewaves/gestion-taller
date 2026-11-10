import { useEffect, useState } from 'react';
import type { UpdateInfo } from '@gonzalvo/contracts';
import { useServices } from '../services-context';
import { texts } from '../texts';
import { Button } from './Field';

const t = texts.updates;

/** Versión nueva disponible (D-041). Se mira una vez al entrar; solo para quien puede instalarla. */
export function UpdateNotice() {
  const { updates } = useServices();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    updates.check().then(setUpdate, () => setUpdate(null));
  }, [updates]);

  if (!update) return null;
  const install = async () => {
    setInstalling(true);
    setError(null);
    try {
      await updates.install(); // Si va bien, el programa se cierra y vuelve a abrirse.
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setInstalling(false);
    }
  };
  return (
    <div className="gz-notice gz-warning gz-update">
      <p className="body">{t.available(update.version)}</p>
      {update.notes && <p className="caption">{update.notes}</p>}
      <div className="gz-actions">
        <Button variant="primary" disabled={installing} onClick={() => void install()}>
          {installing ? t.installing : t.install}
        </Button>
      </div>
      {installing && <p className="caption">{t.restartHint}</p>}
      {error && <p className="caption gz-danger">{error}</p>}
    </div>
  );
}
