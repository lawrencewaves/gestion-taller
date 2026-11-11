import { useCallback, useEffect, useState } from 'react';
import type { AppInfo, AuthStatus, Capabilities, Services, Session } from '@gonzalvo/contracts';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/app.css';
import { EnvBanner } from './components/EnvBanner';
import { canSee, NavMenu, type RouteId } from './components/NavMenu';
import { UpdateNotice } from './components/UpdateNotice';
import { Login, Setup } from './screens/Acceso';
import { Configuracion } from './screens/Configuracion';
import { BackupWarning, Copias } from './screens/Copias';
import { Diagnostico } from './screens/Diagnostico';
import { Inicio } from './screens/Inicio';
import { Pendiente } from './screens/Pendiente';
import { ServicesContext } from './services-context';
import { texts } from './texts';

export interface AppProps {
  services: Services;
  info: AppInfo;
  capabilities: Capabilities;
}

/** Minutos sin tocar el ratón ni el teclado antes de cerrar la sesión (RF-USR-05). Se hará configurable en Configuración. */
export const IDLE_MINUTES = 30;

const routes = new Set<string>(Object.keys(texts.nav).filter((k) => k !== 'menu'));

/** Rutas con almohadilla (#/clientes): funcionan en GitHub Pages y en Tauri sin servidor. */
function useRoute(): RouteId {
  const read = () => {
    const id = window.location.hash.replace(/^#\/?/, '').split('/')[0] ?? '';
    return (routes.has(id) ? id : 'inicio') as RouteId;
  };
  const [route, setRoute] = useState<RouteId>(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}

/** Llama a `onIdle` tras `minutes` sin actividad mientras `active` sea verdadero. */
function useIdle(active: boolean, minutes: number, onIdle: () => void) {
  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(onIdle, minutes * 60_000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onIdle, minutes * 60_000);
    };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [active, minutes, onIdle]);
}

function Screen({ route, session, version }: { route: RouteId; session: Session; version: string }) {
  if (!canSee(session, route)) return <Pendiente name={texts.access.forbiddenTitle} body={texts.access.forbiddenBody} />;
  if (route === 'inicio') return <Inicio />;
  if (route === 'diagnostico') return <Diagnostico version={version} />;
  if (route === 'copias') return <Copias />;
  if (route === 'configuracion') return <Configuracion />;
  return <Pendiente name={texts.nav[route]} />;
}

type AuthState =
  | { step: 'loading' }
  | { step: 'setup' }
  | { step: 'login'; status: AuthStatus; notice?: string }
  | { step: 'in'; session: Session }
  | { step: 'error'; message: string };

export function App({ services, info }: AppProps) {
  const route = useRoute();
  const [auth, setAuth] = useState<AuthState>({ step: 'loading' });

  const toLogin = useCallback(
    async (notice?: string) => {
      const status = await services.auth.status();
      setAuth(status.needsSetup ? { step: 'setup' } : { step: 'login', status, ...(notice ? { notice } : {}) });
    },
    [services],
  );

  useEffect(() => {
    services.auth
      .session()
      .then((s) => (s ? setAuth({ step: 'in', session: s }) : toLogin()))
      .catch((err: unknown) => setAuth({ step: 'error', message: err instanceof Error ? err.message : String(err) }));
  }, [services, toLogin]);

  const logout = useCallback(
    async (notice?: string) => {
      await services.auth.logout();
      await toLogin(notice);
    },
    [services, toLogin],
  );
  const onIdle = useCallback(() => void logout(texts.access.idle), [logout]);
  useIdle(auth.step === 'in', IDLE_MINUTES, onIdle);

  const signedIn = (session: Session) => setAuth({ step: 'in', session });

  let body: React.ReactNode;
  switch (auth.step) {
    case 'loading':
      body = <main className="gz-access"><p className="body gz-muted">Abriendo Gonzalvo…</p></main>;
      break;
    case 'error':
      body = <main className="gz-access"><p className="body gz-danger">No se ha podido abrir Gonzalvo: {auth.message}</p></main>;
      break;
    case 'setup':
      body = <Setup onCreated={signedIn} />;
      break;
    case 'login':
      body = <Login status={auth.status} notice={auth.notice} onLogin={signedIn} />;
      break;
    case 'in':
      body = (
        <div className="gz-shell">
          <NavMenu active={route} session={auth.session} onLogout={() => void logout()} />
          <main className="gz-main">
            {auth.session.permissions.includes('config.manage') && (
              <>
                <UpdateNotice />
                <BackupWarning route={route} />
              </>
            )}
            <Screen route={route} session={auth.session} version={info.version} />
          </main>
        </div>
      );
  }

  return (
    <ServicesContext.Provider value={services}>
      <div className="gz-app">
        <EnvBanner info={info} />
        {body}
      </div>
    </ServicesContext.Provider>
  );
}
