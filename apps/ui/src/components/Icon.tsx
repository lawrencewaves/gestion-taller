import {
  Calendar, Car, DatabaseBackup, FileText, Gauge, House, LogOut, type LucideIcon, Package, Receipt, Settings, User, Users, Wallet, Wrench,
} from 'lucide-react';

/** Iconos de Lucide a trazo de 1,5px (D-028). Solo los que usa la interfaz. */
const icons = {
  house: House, calendar: Calendar, wrench: Wrench, 'file-text': FileText, receipt: Receipt, wallet: Wallet,
  users: Users, car: Car, package: Package, settings: Settings, 'database-backup': DatabaseBackup, gauge: Gauge, user: User, 'log-out': LogOut,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof icons;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const Svg = icons[name];
  return <Svg className="gz-icon" size={size} strokeWidth={1.5} aria-hidden="true" />;
}
