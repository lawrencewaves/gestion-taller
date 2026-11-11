import { type FormEvent, useEffect, useState } from 'react';
import {
  DOC_TYPE_LABELS, type FiscalPolicy, FISCAL_MODE_LABELS, formatPercentBp, type PaymentMethod, type SeriesConfig, type TaxRate,
} from '@gonzalvo/contracts';
import { Button, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';

const t = texts.billing;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));
type Note = { kind: 'ok' | 'error'; text: string } | null;

function Notice({ note }: { note: Note }) {
  if (!note) return null;
  return <p className={`caption ${note.kind === 'error' ? 'gz-danger' : 'gz-muted'}`} role="status">{note.text}</p>;
}

function SeriesRow({ initial }: { initial: SeriesConfig }) {
  const { billing } = useServices();
  const [series, setSeries] = useState(initial);
  const [prefix, setPrefix] = useState(initial.prefix);
  const [next, setNext] = useState(String(initial.nextNumber));
  const [errors, setErrors] = useState<{ prefix?: string; nextNumber?: string }>({});
  const [note, setNote] = useState<Note>(null);
  const label = DOC_TYPE_LABELS[series.docType];
  const dirty = prefix.trim().toUpperCase() !== series.prefix || next !== String(series.nextNumber);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setNote(null);
    try {
      const r = await billing.saveSeries({ docType: series.docType, prefix, nextNumber: Number(next) });
      if (r.ok) {
        setSeries(r.value);
        setPrefix(r.value.prefix);
        setNext(String(r.value.nextNumber));
        setErrors({});
        setNote({ kind: 'ok', text: t.saved });
      } else {
        setErrors(r.fieldErrors);
        if (r.error) setNote({ kind: 'error', text: r.error });
      }
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  return (
    <form className="gz-series" onSubmit={(e) => void save(e)} noValidate>
      <p className="body-strong gz-series__doc">{label}</p>
      {series.locked ? (
        <p className="caption gz-muted gz-series__locked">{t.inUse}</p>
      ) : (
        <>
          <TextField label={t.prefix} value={prefix} maxLength={10} onChange={(e) => setPrefix(e.target.value)} error={errors.prefix} aria-label={`${t.prefix} · ${label}`} />
          <TextField label={t.next} type="number" inputMode="numeric" min={1} value={next} onChange={(e) => setNext(e.target.value)} error={errors.nextNumber} aria-label={`${t.next} · ${label}`} />
        </>
      )}
      <div className="gz-series__example">
        <span className="caption gz-muted">{t.example}</span>
        <span className="gz-mono">{series.example}</span>
      </div>
      {!series.locked && <Button type="submit" disabled={!dirty}>{t.save}</Button>}
      <Notice note={note} />
    </form>
  );
}

function SeriesCard() {
  const { billing } = useServices();
  const [list, setList] = useState<SeriesConfig[] | null>(null);
  const [note, setNote] = useState<Note>(null);
  useEffect(() => {
    billing.series().then(setList, (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [billing]);
  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.seriesTitle}</h2>
      <p className="caption gz-muted">{t.seriesIntro}</p>
      {list?.map((s) => <SeriesRow key={s.docType} initial={s} />)}
      <Notice note={note} />
    </section>
  );
}

function TaxCard() {
  const { billing } = useServices();
  const [rates, setRates] = useState<TaxRate[] | null>(null);
  const [name, setName] = useState('');
  const [percent, setPercent] = useState('');
  const [errors, setErrors] = useState<{ name?: string; percent?: string }>({});
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    billing.taxRates().then(setRates, (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [billing]);
  if (!rates) return <Notice note={note} />;

  const change = async (rate: TaxRate, patch: { active?: boolean; isDefault?: boolean }) => {
    setNote(null);
    const before = rates;
    const active = patch.active ?? rate.active;
    const isDefault = patch.isDefault ?? rate.isDefault;
    // El control cambia al momento; después se pone lo guardado, o se vuelve atrás si falla.
    setRates(rates.map((x) => (x.id === rate.id ? { ...x, active, isDefault } : isDefault ? { ...x, isDefault: false } : x)));
    try {
      const r = await billing.updateTaxRate({ id: rate.id, active, isDefault, version: rate.version });
      if (r.ok) setRates(r.value);
      else {
        setRates(before);
        setNote({ kind: 'error', text: r.error ?? r.fieldErrors.active ?? '' });
      }
    } catch (err) {
      setRates(before);
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setNote(null);
    try {
      const r = await billing.addTaxRate({ name, percent });
      if (r.ok) {
        setRates([...rates, r.value]);
        setName('');
        setPercent('');
        setErrors({});
      } else setErrors(r.fieldErrors);
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.taxTitle}</h2>
      <p className="caption gz-muted">{t.taxIntro}</p>
      <div className="gz-table-wrap">
        <table className="gz-table">
          <thead>
            <tr>
              <th>{t.colName}</th>
              <th>{t.colRate}</th>
              <th>{t.colDefault}</th>
              <th>{t.colActive}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((r) => (
              <tr key={r.id} className={r.active ? undefined : 'gz-row-off'}>
                <td>{r.name}</td>
                <td className="gz-num">{formatPercentBp(r.rateBp)}</td>
                <td>
                  <input type="radio" name="tax-default" aria-label={`${t.colDefault}: ${r.name}`} checked={r.isDefault} disabled={!r.active} onChange={() => void change(r, { isDefault: true })} />
                </td>
                <td>
                  <input type="checkbox" aria-label={`${t.colActive}: ${r.name}`} checked={r.active} disabled={r.isDefault} onChange={(e) => void change(r, { active: e.target.checked })} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Notice note={note} />
      <form className="gz-inline-field" onSubmit={(e) => void add(e)} noValidate>
        <TextField label={t.taxName} value={name} onChange={(e) => setName(e.target.value)} help={t.taxNameHelp} error={errors.name} />
        <TextField label={t.taxPercent} value={percent} inputMode="decimal" onChange={(e) => setPercent(e.target.value)} error={errors.percent} />
        <Button type="submit" disabled={!name || !percent}>{t.add}</Button>
      </form>
    </section>
  );
}

function PaymentCard() {
  const { billing } = useServices();
  const [methods, setMethods] = useState<PaymentMethod[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [note, setNote] = useState<Note>(null);

  useEffect(() => {
    billing.paymentMethods().then(setMethods, (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [billing]);
  if (!methods) return <Notice note={note} />;

  const toggle = async (m: PaymentMethod, active: boolean) => {
    setNote(null);
    const before = methods;
    setMethods(methods.map((x) => (x.id === m.id ? { ...x, active } : x)));
    try {
      const r = await billing.updatePaymentMethod({ id: m.id, active, version: m.version });
      if (r.ok) setMethods(r.value);
      else {
        setMethods(before);
        setNote({ kind: 'error', text: r.error ?? r.fieldErrors.active ?? '' });
      }
    } catch (err) {
      setMethods(before);
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setNote(null);
    setError(undefined);
    try {
      const r = await billing.addPaymentMethod({ name });
      if (r.ok) {
        setMethods([...methods, r.value]);
        setName('');
      } else setError(r.fieldErrors.name);
    } catch (err) {
      setNote({ kind: 'error', text: errorText(err) });
    }
  };

  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.paymentsTitle}</h2>
      <p className="caption gz-muted">{t.paymentsIntro}</p>
      <ul className="gz-list">
        {methods.map((m) => (
          <li key={m.id} className="gz-list__row">
            <label className="gz-check-inline">
              <input type="checkbox" checked={m.active} onChange={(e) => void toggle(m, e.target.checked)} />
              <span className={m.active ? 'body' : 'body gz-muted'}>{m.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <Notice note={note} />
      <form className="gz-inline-field" onSubmit={(e) => void add(e)} noValidate>
        <TextField label={t.paymentName} value={name} onChange={(e) => setName(e.target.value)} error={error} />
        <Button type="submit" disabled={!name.trim()}>{t.add}</Button>
      </form>
    </section>
  );
}

/** Pestaña Facturación de Configuración (RF-CFG-02, RF-CFG-03). */
export function FacturacionTab() {
  return (
    <div className="gz-stack gz-tab-body">
      <SeriesCard />
      <TaxCard />
      <PaymentCard />
    </div>
  );
}

/** Pestaña Fiscal: solo consulta (RF-CFG-04). La activación llega con la validación fiscal (D-014, D-040). */
export function FiscalTab() {
  const { system } = useServices();
  const [policy, setPolicy] = useState<FiscalPolicy | null>(null);
  const [note, setNote] = useState<Note>(null);
  const f = texts.fiscal;
  useEffect(() => {
    system.diagnostics().then((r) => setPolicy(r.fiscal), (e: unknown) => setNote({ kind: 'error', text: errorText(e) }));
  }, [system]);
  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{f.title}</h2>
      {policy && (
        <dl className="gz-diag">
          <div className="gz-diag__row">
            <dt className="body gz-muted">{f.mode}</dt>
            <dd className="body">{FISCAL_MODE_LABELS[policy.mode]}</dd>
          </div>
          <div className="gz-diag__row">
            <dt className="body gz-muted">{f.status}</dt>
            <dd className="body">{policy.reason}</dd>
          </div>
          <div className="gz-diag__row">
            <dt className="body gz-muted">{f.calendar}</dt>
            <dd className="body">{f.calendarValue}</dd>
          </div>
        </dl>
      )}
      <p className="caption gz-muted">{f.plan}</p>
      <Notice note={note} />
    </section>
  );
}
