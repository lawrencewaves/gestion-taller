import { useEffect, useState } from 'react';
import type { AppInfo, Capabilities, Services } from '@gonzalvo/contracts';
import '@fontsource-variable/archivo';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles/tokens.css';
import './styles/app.css';
import { EnvBanner } from './components/EnvBanner';
import { NavMenu, type RouteId } from './components/NavMenu';
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

function Screen({ route }: { route: RouteId }) {
  if (route === 'inicio') return <Inicio />;
  if (route === 'diagnostico') return <Diagnostico />;
  return <Pendiente name={texts.nav[route]} />;
}

export function App({ services, info }: AppProps) {
  const route = useRoute();
  return (
    <ServicesContext.Provider value={services}>
      <div className="gz-app">
        <EnvBanner info={info} />
        <div className="gz-shell">
          <NavMenu active={route} />
          <main className="gz-main">
            <Screen route={route} />
          </main>
        </div>
      </div>
    </ServicesContext.Provider>
  );
}
