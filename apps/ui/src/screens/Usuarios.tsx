import { type FormEvent, useCallback, useEffect, useState } from 'react';
import {
  formatDate, IDLE_MINUTES_RANGE, type Permission, PERMISSION_GROUPS, type Role, ROLE_LABELS, ROLES, type RolePermissions,
  type Session, type UserField, type UserSummary,
} from '@gonzalvo/contracts';
import { Button, CheckboxField, SelectField, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';

const t = texts.users;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
const roleOptions = ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }));
type Errors = Partial<Record<UserField, string>>;
type Note = { kind: 'ok' | 'error'; text: string } | null;

function Notice({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`body ${note.kind === 'error' ? 'gz-danger' : 'gz-muted'}`} role="status">{note.text}</p>;
}

function NewUserForm({ onDone, onCancel }: { onDone: (u: UserSummary) => void; onCancel: () => void }) {
  const { users } = useServices();
  const [form, setForm] = useState({ displayName: '', username: '', role: 'mecanico' as Role, password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const r = await users.create(form);
      if (r.ok) onDone(r.value);
      else setErrors(r.fieldErrors);
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="gz-card gz-stack" onSubmit={(e) => void submit(e)} noValidate>
      <h2 className="section-title">{t.add}</h2>
      <TextField label={t.displayName} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} error={errors.displayName} required />
      <div className="gz-form-row">
        <TextField label={t.username} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} help={t.usernameHelp} error={errors.username} autoComplete="off" spellCheck={false} required />
        <SelectField label={t.role} value={form.role} options={roleOptions} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} error={errors.role} />
      </div>
      <TextField label={t.password} type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} help={t.passwordHelp} error={errors.password} required />
      <div className="gz-actions">
        <Button type="submit" variant="primary" disabled={busy}>{t.create}</Button>
        <Button variant="ghost" onClick={onCancel}>{t.cancel}</Button>
      </div>
      <Notice note={note} />
    </form>
  );
}

function EditUserForm({ user, isSelf, onDone, onCancel }: { user: UserSummary; isSelf: boolean; onDone: (u: UserSummary) => void; onCancel: () => void }) {
  const { users } = useServices();
  const [form, setForm] = useState({ displayName: user.displayName, role: user.role, active: user.active });
  const [errors, setErrors] = useState<Errors>({});
  const [note, setNote] = useState<Note>(null);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [passwordNote, setPasswordNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    try {
      const r = await users.update({ id: user.id, version: user.version, ...form });
      if (r.ok) onDone(r.value);
      else {
        setErrors(r.fieldErrors);
        if (r.error) setNote({ kind: 'error', text: r.error });
      }
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setPasswordNote(null);
    setPasswordError(undefined);
    try {
      const r = await users.resetPassword(user.id, password);
      if (r.ok) {
        setPassword('');
        setPasswordNote({ kind: 'ok', text: t.resetDone });
      } else setPasswordError(r.fieldErrors.password);
    } catch (err) {
      setPasswordNote({ kind: 'error', text: errorText(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gz-card gz-stack">
      <form className="gz-stack" onSubmit={(e) => void save(e)} noValidate>
        <h2 className="section-title">{user.displayName} <span className="caption gz-muted">@{user.username}</span></h2>
        <TextField label={t.displayName} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} error={errors.displayName} required />
        <SelectField label={t.role} value={form.role} options={roleOptions} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} error={errors.role} disabled={isSelf} />
        <CheckboxField label={t.activeLabel} checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} help={t.activeHelp} error={errors.active} disabled={isSelf} />
        <div className="gz-actions">
          <Button type="submit" variant="primary" disabled={busy}>{t.save}</Button>
          <Button variant="ghost" onClick={onCancel}>{t.cancel}</Button>
        </div>
        <Notice note={note} />
      </form>
      {!isSelf && (
        <form className="gz-stack gz-subsection" onSubmit={(e) => void reset(e)} noValidate>
          <h3 className="body-strong">{t.resetTitle}</h3>
          <TextField label={t.password} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} help={t.resetHelp} error={passwordError} />
          <div className="gz-actions">
            <Button type="submit" disabled={busy || !password}>{t.resetButton}</Button>
          </div>
          <Notice note={passwordNote} />
        </form>
      )}
    </div>
  );
}

function stateOf(u: UserSummary) {
  if (!u.active) return <span className="gz-badge">{t.inactive}</span>;
  if (u.locked) return <span className="gz-badge gz-badge--negative">{t.locked}</span>;
  return <span className="gz-badge gz-badge--done">{t.active}</span>;
}

function UserList({ session }: { session: Session }) {
  const { users } = useServices();
  const [list, setList] = useState<UserSummary[] | null>(null);
  const [mode, setMode] = useState<{ kind: 'list' } | { kind: 'new' } | { kind: 'edit'; user: UserSummary }>({ kind: 'list' });
  const [note, setNote] = useState<Note>(null);

  const load = useCallback(() => {
    users.list().then(setList, (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [users]);
  useEffect(load, [load]);

  if (mode.kind === 'new') {
    return (
      <NewUserForm
        onCancel={() => setMode({ kind: 'list' })}
        onDone={(u) => {
          setNote({ kind: 'ok', text: t.created(u.displayName) });
          setMode({ kind: 'list' });
          load();
        }}
      />
    );
  }
  if (mode.kind === 'edit') {
    return (
      <EditUserForm
        user={mode.user}
        isSelf={mode.user.id === session.userId}
        onCancel={() => setMode({ kind: 'list' })}
        onDone={() => {
          setNote({ kind: 'ok', text: t.saved });
          setMode({ kind: 'list' });
          load();
        }}
      />
    );
  }
  return (
    <section className="gz-card gz-stack">
      <div className="gz-section-head">
        <h2 className="section-title">{t.title}</h2>
        <Button variant="primary" onClick={() => {
          setNote(null);
          setMode({ kind: 'new' });
        }}>{t.add}</Button>
      </div>
      <Notice note={note} />
      {list && (
        <div className="gz-table-wrap">
          <table className="gz-table">
            <thead>
              <tr>
                <th>{t.colName}</th>
                <th className="gz-wide-only">{t.colRole}</th>
                <th>{t.colState}</th>
                <th className="gz-wide-only">{t.colLast}</th>
                <th><span className="gz-sr">{t.edit}</span></th>
              </tr>
            </thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="body-strong">{u.displayName}</span> {u.id === session.userId && <span className="caption gz-muted">{t.you}</span>}
                    <br />
                    <span className="caption gz-muted">@{u.username}<span className="gz-narrow-only"> · {ROLE_LABELS[u.role]}</span></span>
                  </td>
                  <td className="gz-wide-only">{ROLE_LABELS[u.role]}</td>
                  <td>{stateOf(u)}</td>
                  <td className="caption gz-wide-only">{u.lastLoginAt ? formatDate(u.lastLoginAt, true) : t.never}</td>
                  <td>
                    <Button className="gz-btn--sm" variant="ghost" onClick={() => {
                      setNote(null);
                      setMode({ kind: 'edit', user: u });
                    }}>{t.edit}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PermissionMatrix() {
  const { users } = useServices();
  const [roles, setRoles] = useState<RolePermissions[] | null>(null);
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    users.rolePermissions().then(setRoles, (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [users]);

  if (!roles) return <Notice note={note} />;
  const editable = roles.filter((r) => r.editable);

  const toggle = async (role: RolePermissions, permission: Permission, on: boolean) => {
    setNote(null);
    const next = on ? [...role.permissions, permission] : role.permissions.filter((p) => p !== permission);
    const before = roles;
    // La casilla cambia al momento; después se pone lo que ha guardado `core`, que completa
    // lo que falte (quien edita ve). Si falla, vuelve a como estaba.
    setRoles(roles.map((r) => (r.role === role.role ? { ...r, permissions: next } : r)));
    try {
      const saved = await users.setRolePermissions(role.role, next);
      setRoles((current) => current?.map((r) => (r.role === saved.role ? saved : r)) ?? null);
    } catch (e) {
      setRoles(before);
      setNote({ kind: 'error', text: errorText(e) });
    }
  };

  const box = (role: RolePermissions, permission: Permission, label: string) => (
    <input
      type="checkbox"
      aria-label={`${ROLE_LABELS[role.role]}: ${label}`}
      checked={role.permissions.includes(permission)}
      onChange={(e) => void toggle(role, permission, e.target.checked)}
    />
  );

  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.permissionsTitle}</h2>
      <p className="caption gz-muted">{t.permissionsIntro}</p>
      <div className="gz-table-wrap">
        <table className="gz-table gz-table--matrix">
          <thead>
            <tr>
              <th>{t.section}</th>
              {editable.map((r) => <th key={r.role}>{ROLE_LABELS[r.role]}</th>)}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((g) => (
              <tr key={g.label}>
                <th scope="row">{g.label}</th>
                {editable.map((r) => (
                  <td key={r.role}>
                    <span className="gz-perm">
                      <label>{box(r, g.view, `${g.label} · ${t.view}`)} {t.view}</label>
                      <label>{box(r, g.edit, `${g.label} · ${t.editPerm}`)} {t.editPerm}</label>
                      {g.extra && <label>{box(r, g.extra.permission, `${g.label} · ${g.extra.label}`)} {g.extra.label}</label>}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption gz-muted">{t.adminAll}</p>
      <Notice note={note} />
    </section>
  );
}

function IdleSetting() {
  const { users } = useServices();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState<Note>(null);
  const { min, max } = IDLE_MINUTES_RANGE;

  useEffect(() => {
    users.idleMinutes().then((m) => setValue(String(m)), () => setValue(''));
  }, [users]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setNote(null);
    setError(undefined);
    try {
      const r = await users.setIdleMinutes(Number(value));
      if (r.ok) setNote({ kind: 'ok', text: t.idleSaved });
      else setError(r.fieldErrors.idleMinutes);
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  return (
    <form className="gz-card gz-stack" onSubmit={(e) => void save(e)} noValidate>
      <h2 className="section-title">{t.idleTitle}</h2>
      <div className="gz-inline-field">
        <TextField label={t.idleLabel} type="number" inputMode="numeric" min={min} max={max} value={value} onChange={(e) => setValue(e.target.value)} help={t.idleHelp(min, max)} error={error} />
        <Button type="submit">{t.idleSave}</Button>
      </div>
      <Notice note={note} />
    </form>
  );
}

/** Pestaña Usuarios de Configuración (RF-USR-03, RF-USR-05). Solo con `users.manage`. */
export function UsuariosTab({ session }: { session: Session }) {
  return (
    <div className="gz-stack gz-tab-body">
      <UserList session={session} />
      <PermissionMatrix />
      <IdleSetting />
    </div>
  );
}
