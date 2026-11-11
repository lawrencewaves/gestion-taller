import { type FormEvent, useState } from 'react';
import { ROLE_LABELS, type Session, type UserField } from '@gonzalvo/contracts';
import { Button, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';

const t = texts.account;

/** Mi cuenta: cualquier usuario cambia aquí su contraseña (RF-USR-01). */
export function Cuenta({ session }: { session: Session }) {
  const { users } = useServices();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [errors, setErrors] = useState<Partial<Record<UserField | 'repeat', string>>>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (next !== repeat) {
      setErrors({ repeat: t.mismatch });
      return;
    }
    setBusy(true);
    try {
      const r = await users.changeOwnPassword(current, next);
      if (r.ok) {
        setCurrent('');
        setNext('');
        setRepeat('');
        setErrors({});
        setMessage({ kind: 'ok', text: t.saved });
      } else {
        setErrors(r.fieldErrors);
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="gz-page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="caption gz-muted">{t.intro}</p>
        </div>
      </header>
      <section className="gz-card">
        <dl className="gz-diag">
          <div className="gz-diag__row">
            <dt className="body gz-muted">{t.username}</dt>
            <dd className="body">{session.username}</dd>
          </div>
          <div className="gz-diag__row">
            <dt className="body gz-muted">{t.role}</dt>
            <dd className="body">{ROLE_LABELS[session.role]}</dd>
          </div>
        </dl>
      </section>
      <form className="gz-card gz-stack" onSubmit={(e) => void submit(e)} noValidate>
        <h2 className="section-title">{t.passwordTitle}</h2>
        <TextField label={t.current} type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.currentPassword} required />
        <TextField label={t.next} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} help={t.nextHelp} error={errors.password} required />
        <TextField label={t.repeat} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} required />
        <div className="gz-actions">
          <Button type="submit" variant="primary" disabled={busy || !current || !next || !repeat}>{t.save}</Button>
        </div>
        {message && <p className={`body ${message.kind === 'error' ? 'gz-danger' : 'gz-muted'}`} role="status">{message.text}</p>}
      </form>
    </>
  );
}
