import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { BACKUP_RETENTION_RANGE, type BackupFile, type BackupStatus } from '@gonzalvo/contracts';
import { formatBytes, formatDate } from '@gonzalvo/contracts';
import { Button, TextField } from '../components/Field';
import { useServices } from '../services-context';
import { texts } from '../texts';

const t = texts.backups;
const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

function Message({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null;
  return <p className={`body ${feedback.kind === 'error' ? 'gz-danger' : 'gz-muted'}`} role="status">{feedback.text}</p>;
}

/** Hoja de recuperación: se ve en pantalla y es lo único que sale al imprimir. */
function RecoverySheet({ recoveryKey, onClose }: { recoveryKey: string; onClose: () => void }) {
  const sheet = (
    <>
      <h2 className="section-title">{t.sheetTitle}</h2>
      <p className="gz-recovery__key">{recoveryKey}</p>
      <p className="body">{t.sheetBody}</p>
      <p className="caption gz-muted">{t.sheetSteps}</p>
    </>
  );
  return (
    <div className="gz-recovery gz-stack">
      {sheet}
      <div className="gz-actions">
        <Button variant="secondary" onClick={() => window.print()}>{t.print}</Button>
        <Button variant="primary" onClick={onClose}>{t.sheetDone}</Button>
      </div>
      <div className="gz-print-sheet">
        <p className="caption">Gonzalvo · {formatDate(new Date())}</p>
        {sheet}
      </div>
    </div>
  );
}

function KeyCard({ status, onChange }: { status: BackupStatus; onChange: () => void }) {
  const { backups } = useServices();
  const [shown, setShown] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setFeedback(null);
    try {
      await work();
    } catch (e) {
      setFeedback({ kind: 'error', text: errorText(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.keyTitle}</h2>
      {shown ? (
        <RecoverySheet recoveryKey={shown} onClose={() => setShown(null)} />
      ) : status.hasKey ? (
        <>
          <p className="body">{t.keyStored}</p>
          <div className="gz-actions">
            <Button disabled={busy} onClick={() => void run(async () => setShown(await backups.revealKey()))}>{t.showKey}</Button>
          </div>
        </>
      ) : (
        <>
          <p className="body">{t.keyIntro}</p>
          {entering ? (
            <form
              className="gz-stack"
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await backups.enterKey(typed);
                  setFeedback({ kind: 'ok', text: t.keySaved });
                  setEntering(false);
                  onChange();
                });
              }}
            >
              <TextField
                label={t.keyInput}
                help={t.keyInputHelp}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                required
              />
              <div className="gz-actions">
                <Button type="submit" variant="primary" disabled={busy}>{t.saveKey}</Button>
                <Button variant="ghost" onClick={() => setEntering(false)}>{t.cancel}</Button>
              </div>
            </form>
          ) : (
            <div className="gz-actions">
              <Button
                variant="primary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    setShown(await backups.createKey());
                    onChange();
                  })
                }
              >
                {t.createKey}
              </Button>
              <Button variant="ghost" onClick={() => setEntering(true)}>{t.haveKey}</Button>
            </div>
          )}
        </>
      )}
      <Message feedback={feedback} />
    </section>
  );
}

function BackupList({ status }: { status: BackupStatus }) {
  const { backups } = useServices();
  const [files, setFiles] = useState<BackupFile[] | null>(null);
  const [confirm, setConfirm] = useState<BackupFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    backups.list().then(setFiles, (e: unknown) => setFeedback({ kind: 'error', text: errorText(e) }));
  }, [backups, status]);

  const restore = async (file: BackupFile) => {
    setBusy(true);
    setFeedback(null);
    try {
      await backups.restore(file.name);
      // La base es otra: se arranca de nuevo la interfaz y se vuelve a entrar.
      window.location.reload();
    } catch (e) {
      setFeedback({ kind: 'error', text: errorText(e) });
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <section className="gz-card gz-stack">
      <h2 className="section-title">{t.listTitle}</h2>
      <p className="caption gz-muted">{t.retention(status.keepDaily, status.keepMonthly)}</p>
      {files?.length === 0 && <p className="body gz-muted">{t.listEmpty}</p>}
      {files && files.length > 0 && (
        <ul className="gz-list">
          {files.map((f) => (
            <li key={f.name} className="gz-list__row">
              <span className="body">{formatDate(f.createdAt, true)}</span>
              <span className="caption gz-muted gz-list__grow">{formatBytes(f.sizeBytes)}</span>
              {confirm?.name === f.name ? null : (
                <Button className="gz-btn--sm" variant="ghost" disabled={busy} onClick={() => setConfirm(f)}>{t.restore}</Button>
              )}
              {confirm?.name === f.name && (
                <div className="gz-confirm gz-stack">
                  <p className="body">{t.restoreConfirm(formatDate(f.createdAt, true))}</p>
                  <div className="gz-actions">
                    <Button variant="danger" disabled={busy} onClick={() => void restore(f)}>{busy ? t.restoring : t.restoreYes}</Button>
                    <Button variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>{t.cancel}</Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <Message feedback={feedback} />
    </section>
  );
}

/** Cuántas copias se conservan (RF-BAK-07, RF-CFG-05). */
function RetentionForm({ status, onSaved }: { status: BackupStatus; onSaved: (s: BackupStatus) => void }) {
  const { backups } = useServices();
  const [daily, setDaily] = useState(String(status.keepDaily));
  const [monthly, setMonthly] = useState(String(status.keepMonthly));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const { daily: d, monthly: m } = BACKUP_RETENTION_RANGE;
  const dirty = daily !== String(status.keepDaily) || monthly !== String(status.keepMonthly);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    try {
      onSaved(await backups.setRetention(Number(daily), Number(monthly)));
      setFeedback({ kind: 'ok', text: t.retentionSaved });
    } catch (err) {
      setFeedback({ kind: 'error', text: errorText(err) });
    }
  };

  return (
    <form className="gz-card gz-stack" onSubmit={(e) => void save(e)} noValidate>
      <h2 className="section-title">{t.retentionTitle}</h2>
      <div className="gz-inline-field">
        <TextField label={t.keepDaily} type="number" inputMode="numeric" min={d.min} max={d.max} value={daily} onChange={(e) => setDaily(e.target.value)} />
        <TextField label={t.keepMonthly} type="number" inputMode="numeric" min={m.min} max={m.max} value={monthly} onChange={(e) => setMonthly(e.target.value)} />
        <Button type="submit" disabled={!dirty}>{t.retentionSave}</Button>
      </div>
      <Message feedback={feedback} />
    </form>
  );
}

/** Copias de seguridad (REQUIREMENTS §14). Solo el administrador entra aquí (`config.manage`). */
export function Copias() {
  const { backups } = useServices();
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState<'backup' | 'export' | 'folder' | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const refresh = useCallback(() => {
    backups.status().then(setStatus, (e: unknown) => setFeedback({ kind: 'error', text: errorText(e) }));
  }, [backups]);
  useEffect(refresh, [refresh]);

  const act = async (kind: NonNullable<typeof busy>, work: () => Promise<string | null>) => {
    setBusy(kind);
    setFeedback(null);
    try {
      const done = await work();
      if (done) setFeedback({ kind: 'ok', text: done });
    } catch (e) {
      // Un fallo de la copia a la carpeta queda en el historial y se ve en «El último intento falló».
      if (kind !== 'backup') setFeedback({ kind: 'error', text: errorText(e) });
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const head = (
    <header className="gz-page-head">
      <div>
        <h1 className="page-title">{t.title}</h1>
        <p className="caption gz-muted">{t.intro}</p>
      </div>
    </header>
  );

  if (!status) return <>{head}<Message feedback={feedback} /></>;
  if (!status.available) {
    return (
      <>
        {head}
        <section className="gz-card"><p className="body">{t.demo}</p></section>
      </>
    );
  }

  const configured = !!status.folder && status.hasKey;
  return (
    <>
      {head}
      <section className="gz-card gz-stack" aria-live="polite">
        <h2 className="section-title">{t.statusTitle}</h2>
        {status.overdue && <p className="gz-notice body">{configured ? t.overdue : t.notConfigured}</p>}
        <dl className="gz-diag">
          <div className="gz-diag__row">
            <dt className="body gz-muted">{t.lastOk}</dt>
            <dd className="body">{status.lastOk ? formatDate(status.lastOk.createdAt, true) : t.none}</dd>
          </div>
        </dl>
        {status.lastError?.error && <p className="body gz-danger">{t.lastError(status.lastError.error)}</p>}
        <div className="gz-actions">
          <Button
            variant="primary"
            disabled={!configured || busy !== null}
            onClick={() => void act('backup', async () => t.done((await backups.backupNow()).fileName ?? ''))}
          >
            {busy === 'backup' ? t.working : t.backupNow}
          </Button>
          <Button
            disabled={!configured || busy !== null}
            onClick={() => void act('export', async () => {
              const r = await backups.exportCopy();
              return r ? t.exported(r.destination) : null;
            })}
          >
            {t.exportCopy}
          </Button>
        </div>
        <p className="caption gz-muted">{t.exportHelp}</p>
        <Message feedback={feedback} />
      </section>

      <section className="gz-card gz-stack">
        <h2 className="section-title">{t.folderTitle}</h2>
        <p className="body gz-path">{status.folder ?? t.folderNone}</p>
        <p className="caption gz-muted">{t.folderHelp}</p>
        <div className="gz-actions">
          <Button
            disabled={busy !== null}
            onClick={() => void act('folder', async () => {
              await backups.chooseFolder();
              return null;
            })}
          >
            {t.chooseFolder}
          </Button>
        </div>
      </section>

      <KeyCard status={status} onChange={refresh} />
      {status.folder && <BackupList status={status} />}
      <RetentionForm status={status} onSaved={setStatus} />
    </>
  );
}

/** Aviso en todas las pantallas cuando no hay copia reciente (RF-BAK-08). Solo para quien puede arreglarlo. */
export function BackupWarning({ route }: { route: string }) {
  const { backups } = useServices();
  const [overdue, setOverdue] = useState(false);
  useEffect(() => {
    backups.status().then((s) => setOverdue(s.available && s.overdue), () => setOverdue(false));
  }, [backups, route]);
  if (!overdue || route === 'copias') return null;
  return (
    <p className="gz-notice body gz-warning">
      {t.warning} <a href="#/copias">{t.warningLink}</a>
    </p>
  );
}
