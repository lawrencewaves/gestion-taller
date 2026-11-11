import { type ChangeEvent, type FormEvent, useEffect, useRef, useState } from 'react';
import { LOGO_MAX_BYTES, type Session, type WorkshopField, type WorkshopInput, type WorkshopProfile } from '@gonzalvo/contracts';
import { Button, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';
import { UsuariosTab } from './Usuarios';

const t = texts.config;
const w = t.workshop;
type Tab = keyof typeof t.tabs;
const TABS = Object.keys(t.tabs) as Tab[];

/**
 * Reduce la imagen a 512 px como máximo, conservando la transparencia de los PNG.
 * Solo presentación: la validación del formato y el tamaño la hace `core`.
 */
async function prepareLogo(file: File): Promise<string> {
  const image = await createImageBitmap(file);
  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  for (const side of [512, 384, 256]) {
    const scale = Math.min(1, side / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL(type, 0.9);
    if ((url.length * 3) / 4 <= LOGO_MAX_BYTES) return url;
  }
  throw new Error(w.logoError);
}

type Errors = Partial<Record<WorkshopField, string>>;
const without = (errors: Errors, field: WorkshopField): Errors =>
  Object.fromEntries(Object.entries(errors).filter(([k]) => k !== field));

const toInput = (p: WorkshopProfile): WorkshopInput => ({
  legalName: p.legalName, tradeName: p.tradeName, taxId: p.taxId, addressLine: p.addressLine, postalCode: p.postalCode,
  city: p.city, phone: p.phone, email: p.email, iban: p.iban, logo: p.logo, version: p.version,
});

/** Encabezado de los documentos con los datos tal y como están escritos. */
function DocumentHeader({ form, province }: { form: WorkshopInput; province: string }) {
  const name = form.tradeName.trim() || form.legalName.trim();
  if (!name && !form.logo) return <p className="caption gz-muted">{w.previewEmpty}</p>;
  const place = [form.postalCode, form.city, province && `(${province})`].filter(Boolean).join(' ');
  return (
    <div className="gz-doc-head">
      {form.logo && <img className="gz-doc-head__logo" src={form.logo} alt={w.logoAlt} />}
      <div className="gz-doc-head__text">
        {name && <p className="gz-doc-head__name">{name}</p>}
        {form.tradeName.trim() && form.legalName.trim() && <p className="caption">{form.legalName}</p>}
        {form.taxId && <p className="caption">NIF {form.taxId.toUpperCase()}</p>}
        {form.addressLine && <p className="caption">{form.addressLine}</p>}
        {place && <p className="caption">{place}</p>}
        {(form.phone || form.email) && <p className="caption">{[form.phone, form.email].filter(Boolean).join(' · ')}</p>}
      </div>
    </div>
  );
}

function WorkshopTab() {
  const { workshop } = useServices();
  const [saved, setSaved] = useState<WorkshopProfile | null>(null);
  const [form, setForm] = useState<WorkshopInput | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    workshop.get().then(
      (p) => {
        setSaved(p);
        setForm(toInput(p));
      },
      (e: unknown) => setMessage({ kind: 'error', text: e instanceof Error ? e.message : String(e) }),
    );
  }, [workshop]);

  if (!form || !saved) return message ? <p className="body gz-danger">{message.text}</p> : null;

  const dirty = JSON.stringify(form) !== JSON.stringify(toInput(saved));
  const set = (field: WorkshopField) => (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [field]: e.target.value });
    setErrors(without(errors, field));
    setMessage(null);
  };
  const field = (name: WorkshopField, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField label={label} value={form[name] ?? ''} onChange={set(name)} error={errors[name]} {...extra} />
  );

  const chooseLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setForm({ ...form, logo: await prepareLogo(file) });
      setErrors(without(errors, 'logo'));
    } catch {
      setErrors({ ...errors, logo: w.logoError });
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const result = await workshop.update(form);
      if (result.ok) {
        setSaved(result.value);
        setForm(toInput(result.value));
        setErrors({});
        setMessage({ kind: 'ok', text: w.saved });
      } else {
        setErrors(result.fieldErrors);
        setMessage({ kind: 'error', text: result.error ?? w.fixErrors });
      }
    } catch (err) {
      setMessage({ kind: 'error', text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="gz-config" onSubmit={(e) => void submit(e)} noValidate>
      <div className="gz-config__form">
        <section className="gz-card gz-stack">
          <h2 className="section-title">{w.identity}</h2>
          {field('legalName', w.legalName, { help: w.legalNameHelp, required: true, autoComplete: 'organization' })}
          {field('tradeName', w.tradeName, { help: w.tradeNameHelp })}
          {field('taxId', w.taxId, { required: true, autoComplete: 'off', spellCheck: false })}
        </section>

        <section className="gz-card gz-stack">
          <h2 className="section-title">{w.address}</h2>
          {field('addressLine', w.addressLine, { required: true, autoComplete: 'street-address' })}
          <div className="gz-form-row">
            {field('postalCode', w.postalCode, { required: true, inputMode: 'numeric', maxLength: 5, autoComplete: 'postal-code' })}
            {field('city', w.city, { required: true, autoComplete: 'address-level2' })}
          </div>
          <div className="gz-field">
            <span className="gz-field__label">{w.province}</span>
            <p className="body">{saved.province || '—'}</p>
            <p className="gz-field__help">{w.provinceAuto}</p>
          </div>
        </section>

        <section className="gz-card gz-stack">
          <h2 className="section-title">{w.contact}</h2>
          <div className="gz-form-row">
            {field('phone', w.phone, { type: 'tel', autoComplete: 'tel' })}
            {field('email', w.email, { type: 'email', autoComplete: 'email' })}
          </div>
          <h2 className="section-title">{w.bank}</h2>
          {field('iban', w.iban, { help: w.ibanHelp, autoComplete: 'off', spellCheck: false })}
        </section>

        <section className="gz-card gz-stack">
          <h2 className="section-title">{w.logo}</h2>
          {form.logo && <img className="gz-logo-preview" src={form.logo} alt={w.logoAlt} />}
          <p className={errors.logo ? 'gz-field__error' : 'caption gz-muted'}>{errors.logo ?? w.logoHelp}</p>
          <input ref={fileInput} type="file" accept="image/png,image/jpeg" hidden onChange={(e) => void chooseLogo(e)} />
          <div className="gz-actions">
            <Button onClick={() => fileInput.current?.click()}>{form.logo ? w.logoChange : w.logoChoose}</Button>
            {form.logo && <Button variant="ghost" onClick={() => setForm({ ...form, logo: null })}>{w.logoRemove}</Button>}
          </div>
        </section>

        <div className="gz-config__bar">
          <Button type="submit" variant="primary" disabled={!dirty || busy}>{busy ? w.saving : w.save}</Button>
          {dirty && (
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                setForm(toInput(saved));
                setErrors({});
                setMessage(null);
              }}
            >
              {w.discard}
            </Button>
          )}
          {message && <p className={`body ${message.kind === 'error' ? 'gz-danger' : 'gz-muted'}`} role="status">{message.text}</p>}
        </div>
      </div>

      <aside className="gz-card gz-stack gz-config__aside">
        <h2 className="section-title">{w.preview}</h2>
        <DocumentHeader form={form} province={saved.province} />
      </aside>
    </form>
  );
}

/** Configuración (REQUIREMENTS §12). Solo el administrador (`config.manage`). */
export function Configuracion({ session }: { session: Session }) {
  const [tab, setTab] = useState<Tab>('taller');
  return (
    <>
      <header className="gz-page-head">
        <div>
          <h1 className="page-title">{t.title}</h1>
          <p className="caption gz-muted">{t.intro}</p>
        </div>
      </header>
      <div className="gz-tabs" role="tablist" aria-label={t.title}>
        {TABS.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={`gz-tabs__tab${tab === id ? ' gz-tabs__tab--on' : ''}`}
            onClick={() => setTab(id)}
          >
            {t.tabs[id]}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'taller' ? (
          <WorkshopTab />
        ) : tab === 'usuarios' && session.permissions.includes('users.manage') ? (
          <UsuariosTab session={session} />
        ) : (
          <section className="gz-card">
            <p className="body gz-muted">{t.nextStep}</p>
          </section>
        )}
      </div>
    </>
  );
}
