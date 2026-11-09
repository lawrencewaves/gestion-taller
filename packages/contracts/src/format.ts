/**
 * Formatos del taller para pantalla y PDF (sistema visual, «Formatos del taller»).
 * Funciones puras, sin plataforma: las comparten la interfaz y los documentos.
 */

const eur = new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' });
const int = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: 'always' });

/** Céntimos → «1.482,35 €». */
export function formatEUR(cents: number): string {
  return `${eur.format(cents / 100)} €`;
}

/** 128400 → «128.400 km». */
export function formatKm(km: number): string {
  return `${int.format(km)} km`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Fecha local → «08/11/2026», o «08/11/2026 · 09:30» con hora. */
export function formatDate(value: Date | string, withTime = false): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const date = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return withTime ? `${date} · ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
}

/** «1234klm» → «1234 KLM». Las matrículas que no siguen el formato actual se muestran en mayúsculas. */
export function formatPlate(raw: string): string {
  const v = raw.toUpperCase().replace(/[\s.\-·]/g, '');
  const m = /^(\d{4})([B-DF-HJ-NP-TV-Z]{3})$/.exec(v);
  return m ? `${m[1]} ${m[2]}` : v;
}
