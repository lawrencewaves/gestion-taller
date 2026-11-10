import type { Permission, Session } from '@gonzalvo/contracts';
import { ROLE_LABELS } from '@gonzalvo/contracts';
import logoUrl from '../assets/gonzalvo-logo.svg';
import { texts } from '../texts';
import { Icon, type IconName } from './Icon';

export type RouteId = Exclude<keyof typeof texts.nav, 'menu'>;

interface Item {
  id: RouteId;
  icon: IconName;
}

/** Permiso necesario para ver cada sección. Inicio no necesita ninguno. */
export const ROUTE_PERMISSION: Partial<Record<RouteId, Permission>> = {
  agenda: 'agenda.view',
  ordenes: 'ordenes.view',
  presupuestos: 'presupuestos.view',
  facturas: 'facturas.view',
  cobros: 'cobros.view',
  clientes: 'clientes.view',
  vehiculos: 'vehiculos.view',
  catalogo: 'catalogo.view',
  configuracion: 'config.manage',
  diagnostico: 'system.diagnostics',
};

export const canSee = (session: Session, route: RouteId) => {
  const needed = ROUTE_PERMISSION[route];
  return !needed || session.permissions.includes(needed);
};

/** Grupos sin título: día a día, ventas y datos (UX §2). */
const groups: Item[][] = [
  [{ id: 'inicio', icon: 'house' }, { id: 'agenda', icon: 'calendar' }, { id: 'ordenes', icon: 'wrench' }],
  [{ id: 'presupuestos', icon: 'file-text' }, { id: 'facturas', icon: 'receipt' }, { id: 'cobros', icon: 'wallet' }],
  [{ id: 'clientes', icon: 'users' }, { id: 'vehiculos', icon: 'car' }, { id: 'catalogo', icon: 'package' }],
];
const footer: Item[] = [{ id: 'configuracion', icon: 'settings' }, { id: 'diagnostico', icon: 'gauge' }];

function NavLink({ item, active }: { item: Item; active: boolean }) {
  return (
    <a href={`#/${item.id}`} className={`gz-nav__item${active ? ' gz-nav__item--on' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon name={item.icon} size={18} />
      <span>{texts.nav[item.id]}</span>
    </a>
  );
}

export function NavMenu({ active, session, onLogout }: { active: string; session: Session; onLogout: () => void }) {
  const visible = (items: Item[]) => items.filter((i) => canSee(session, i.id));
  return (
    <nav className="gz-nav" aria-label={texts.nav.menu}>
      <div className="gz-nav__brand">
        <img src={logoUrl} alt="Gonzalvo" height={28} />
      </div>
      {groups.map(visible).filter((g) => g.length > 0).map((group, i) => (
        <ul key={i} className="gz-nav__group">
          {group.map((item) => (
            <li key={item.id}><NavLink item={item} active={item.id === active} /></li>
          ))}
        </ul>
      ))}
      <div className="gz-nav__foot">
        <ul className="gz-nav__group">
          {visible(footer).map((item) => (
            <li key={item.id}><NavLink item={item} active={item.id === active} /></li>
          ))}
        </ul>
        <div className="gz-nav__user">
          <span className="gz-nav__user-name">
            <Icon name="user" size={18} />
            <span>
              <span className="body-strong">{session.displayName}</span>
              <span className="caption gz-muted">{ROLE_LABELS[session.role]}</span>
            </span>
          </span>
          <button type="button" className="gz-btn gz-btn--ghost gz-btn--sm" onClick={onLogout}>
            <Icon name="log-out" size={16} />
            {texts.access.logout}
          </button>
        </div>
      </div>
    </nav>
  );
}
