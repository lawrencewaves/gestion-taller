import { formatDate } from '@gonzalvo/contracts';

export function Inicio() {
  return (
    <>
      <header className="gz-page-head">
        <div>
          <h1 className="page-title">Inicio</h1>
          <p className="caption gz-muted">{formatDate(new Date())}</p>
        </div>
      </header>
      <section className="gz-card gz-stack">
        <h2 className="section-title">Gonzalvo está en construcción</h2>
        <p className="body">
          Esto ya es el programa real: el menú, el sistema visual y la base de datos funcionan en tu navegador.
          Los módulos (Clientes, Órdenes, Facturas…) se irán añadiendo de uno en uno y aparecerán aquí.
        </p>
        <p className="body">
          Antes de seguir, comprueba que tu navegador guarda los datos en la pantalla de{' '}
          <a href="#/diagnostico">Diagnóstico</a>.
        </p>
      </section>
    </>
  );
}
