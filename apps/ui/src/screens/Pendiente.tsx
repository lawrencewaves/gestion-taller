import { texts } from '../texts';

/** Sección todavía sin construir, o sin permiso para verla (con `body`). */
export function Pendiente({ name, body }: { name: string; body?: string }) {
  return (
    <>
      <header className="gz-page-head">
        <h1 className="page-title">{name}</h1>
      </header>
      <section className="gz-card gz-stack">
        {body ? (
          <p className="body">{body}</p>
        ) : (
          <>
            <h2 className="section-title">{texts.pending.title(name)}</h2>
            <p className="body gz-muted">{texts.pending.body}</p>
          </>
        )}
      </section>
    </>
  );
}
