import { texts } from '../texts';

export function Pendiente({ name }: { name: string }) {
  return (
    <>
      <header className="gz-page-head">
        <h1 className="page-title">{name}</h1>
      </header>
      <section className="gz-card gz-stack">
        <h2 className="section-title">{texts.pending.title(name)}</h2>
        <p className="body gz-muted">{texts.pending.body}</p>
      </section>
    </>
  );
}
