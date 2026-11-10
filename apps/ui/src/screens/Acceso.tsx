import { type FormEvent, useState } from 'react';
import type { AuthStatus, Session } from '@gonzalvo/contracts';
import logoUrl from '../assets/gonzalvo-logo.svg';
import { Button, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

function Frame({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <main className="gz-access">
      <div className="gz-access__card">
        <img src={logoUrl} alt="Gonzalvo" height={32} className="gz-access__logo" />
        <h1 className="page-title">{title}</h1>
        {intro && <p className="body gz-muted">{intro}</p>}
        {children}
      </div>
    </main>
  );
}

export function Login({ status, notice, onLogin }: { status: AuthStatus; notice?: string | undefined; onLogin: (s: Session) => void }) {
  const { auth } = useServices();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      onLogin(await auth.login(username, password));
    } catch (err) {
      setError(message(err));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title={texts.access.loginTitle}>
      {notice && <p className="gz-notice body" role="status">{notice}</p>}
      <form className="gz-stack" onSubmit={submit} noValidate>
        <TextField label={texts.access.username} autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
        <TextField label={texts.access.password} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="gz-field__error" role="alert">{error}</p>}
        <Button variant="primary" type="submit" disabled={busy || !username || !password}>
          {busy ? texts.access.checking : texts.access.login}
        </Button>
      </form>
      {status.demo && (
        <p className="caption gz-muted gz-access__demo">
          {texts.access.demoHint(status.demo.usernames, status.demo.password)}
        </p>
      )}
    </Frame>
  );
}

export function Setup({ onCreated }: { onCreated: (s: Session) => void }) {
  const { auth } = useServices();
  const [form, setForm] = useState({ displayName: '', username: '', password: '', repeat: '' });
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const mismatch = form.repeat !== '' && form.repeat !== form.password;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    setBusy(true);
    setError(undefined);
    try {
      onCreated(await auth.setupAdmin({ displayName: form.displayName, username: form.username, password: form.password }));
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Frame title={texts.access.setupTitle} intro={texts.access.setupIntro}>
      <form className="gz-stack" onSubmit={submit} noValidate>
        <TextField label={texts.access.displayName} autoComplete="name" autoFocus required value={form.displayName} onChange={set('displayName')} />
        <TextField label={texts.access.username} autoComplete="username" required help={texts.access.usernameHelp} value={form.username} onChange={set('username')} />
        <TextField label={texts.access.password} type="password" autoComplete="new-password" required help={texts.access.passwordHelp} value={form.password} onChange={set('password')} />
        <TextField label={texts.access.repeat} type="password" autoComplete="new-password" required error={mismatch ? texts.access.mismatch : undefined} value={form.repeat} onChange={set('repeat')} />
        {error && <p className="gz-field__error" role="alert">{error}</p>}
        <Button variant="primary" type="submit" disabled={busy || mismatch || !form.displayName || !form.username || !form.password || !form.repeat}>
          {busy ? texts.access.creating : texts.access.create}
        </Button>
      </form>
    </Frame>
  );
}
