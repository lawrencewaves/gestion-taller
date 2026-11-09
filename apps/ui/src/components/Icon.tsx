import {
  Calendar, Car, FileText, Gauge, House, type LucideIcon, Package, Receipt, Settings, Users, Wallet, Wrench,
} from 'lucide-react';

/** Iconos de Lucide a trazo de 1,5px (D-028). Solo los que usa la interfaz. */
const icons = {
  house: House, calendar: Calendar, wrench: Wrench, 'file-text': FileText, receipt: Receipt, wallet: Wallet,
  users: Users, car: Car, package: Package, settings: Settings, gauge: Gauge,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Svg = icons[name];
  return <Svg className="gz-icon" size={size} strokeWidth={1.5} aria-hidden="true" />;
}
