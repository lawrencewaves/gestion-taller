import logoUrl from '../assets/gonzalvo-logo.svg';
import { texts } from '../texts';
import { Icon, type IconName } from './Icon';

export type RouteId = keyof typeof texts.nav & string;

interface Item {
  id: Exclude<RouteId, 'menu'>;
  icon: IconName;
}

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

export function NavMenu({ active }: { active: string }) {
  return (
    <nav className="gz-nav" aria-label={texts.nav.menu}>
      <div className="gz-nav__brand">
        <img src={logoUrl} alt="Gonzalvo" height={28} />
      </div>
      {groups.map((group, i) => (
        <ul key={i} className="gz-nav__group">
          {group.map((item) => (
            <li key={item.id}><NavLink item={item} active={item.id === active} /></li>
          ))}
        </ul>
      ))}
      <ul className="gz-nav__group gz-nav__foot">
        {footer.map((item) => (
          <li key={item.id}><NavLink item={item} active={item.id === active} /></li>
        ))}
      </ul>
    </nav>
  );
}
