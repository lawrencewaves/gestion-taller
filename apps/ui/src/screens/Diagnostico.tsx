import { useEffect, useState } from 'react';
import { type DiagnosticsReport, FISCAL_MODE_LABELS } from '@gonzalvo/contracts';
import { useServices } from '../services-context';

type State = { status: 'loading' } | { status: 'ready'; report: DiagnosticsReport } | { status: 'error'; message: string };

function Row({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="gz-diag__row">
      <dt className="body gz-muted">{label}</dt>
      <dd className="body">
        {ok !== undefined && <span className={`gz-badge gz-badge--${ok ? 'done' : 'negative'}`}>{ok ? 'Correcto' : 'Fallo'}</span>}
        <span>{value}</span>
      </dd>
    </div>
  );
}

/** Estado de la base de datos en este entorno: almacenamiento, versión del esquema e integridad. */
export function Diagnostico() {
  const services = useServices();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    services.system.diagnostics().then(
      (report) => setState({ status: 'ready', report }),
      (err: unknown) => setState({ status: 'error', message: err instanceof Error ? err.message : String(err) }),
    );
  }, [services]);

  const r = state.status === 'ready' ? state.report : null;
  const persistent = r?.storage === 'opfs' || r?.storage === 'native';
  const allOk = !!r && persistent && r.transactionsOk && r.foreignKeysOk;

  return (
    <>
      <header className="gz-page-head">
        <div>
          <h1 className="page-title">Diagnóstico</h1>
          <p className="caption gz-muted">Comprueba que este navegador puede guardar los datos de Gonzalvo.</p>
        </div>
      </header>
      <section className="gz-card gz-stack" aria-live="polite">
        {state.status === 'loading' && <p className="body">Abriendo la base de datos…</p>}
        {state.status === 'error' && (
          <p className="body gz-danger">No se ha podido abrir la base de datos: {state.message}</p>
        )}
        {r && (
          <>
            <h2 className="section-title">{allOk ? 'Todo correcto' : 'Hay algo que revisar'}</h2>
            <dl className="gz-diag">
              <Row
                label="Almacenamiento"
                ok={persistent}
                value={persistent ? 'Persistente en este navegador' : 'Solo en memoria: los datos se pierden al cerrar'}
              />
              <Row label="Veces abierta" value={`${r.opens}. Recarga la página: si el número sube, los datos se guardan.`} />
              <Row label="Transacciones" ok={r.transactionsOk} value="Una operación a medias se deshace entera" />
              <Row label="Relaciones entre datos" ok={r.foreignKeysOk} value="No se pueden guardar datos huérfanos" />
              <Row label="Facturación fiscal" value={`${FISCAL_MODE_LABELS[r.fiscal.mode]}. ${r.fiscal.reason}`} />
              <Row label="Base de datos" value={`Versión ${r.schemaVersion} · ${r.dbName}`} />
              <Row label="Motor" value={`SQLite ${r.sqliteVersion}`} />
              <Row label="Navegador" value={navigator.userAgent} />
            </dl>
            {r.error && <p className="caption gz-muted">Detalle técnico: {r.error}</p>}
          </>
        )}
      </section>
    </>
  );
}
