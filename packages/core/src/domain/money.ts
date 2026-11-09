/**
 * Importes del taller. Todo importe es un número entero de céntimos (DATABASE §2)
 * y todo porcentaje, un entero de centésimas: 21 % = 2100.
 */

export type Cents = number;
/** Porcentaje en centésimas: 2100 = 21 %. */
export type BasisPoints = number;

/** Redondeo comercial: la mitad se aleja del cero (0,5 → 1; -0,5 → -1). */
export function roundHalfAwayFromZero(value: number): number {
  const rounded = Math.round(Math.abs(value) + Number.EPSILON * Math.abs(value));
  return value < 0 ? -rounded : rounded;
}

function assertCents(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`${name} debe ser un número entero de céntimos`);
}

/**
 * Importe de una línea: precio unitario × cantidad, menos el descuento.
 * La cantidad admite decimales (1,2 h de mano de obra; 4,5 L de aceite).
 */
export function lineAmount(unitPrice: Cents, quantity: number, discount: BasisPoints = 0): Cents {
  assertCents(unitPrice, 'El precio');
  if (!Number.isFinite(quantity)) throw new RangeError('La cantidad no es válida');
  if (!Number.isInteger(discount) || discount < 0 || discount > 10000) throw new RangeError('El descuento debe estar entre 0 y 10000');
  return roundHalfAwayFromZero((unitPrice * quantity * (10000 - discount)) / 10000);
}

export interface TaxableLine {
  base: Cents;
  taxRate: BasisPoints;
}

export interface TaxLine {
  taxRate: BasisPoints;
  base: Cents;
  tax: Cents;
}

export interface Totals {
  taxes: TaxLine[];
  base: Cents;
  tax: Cents;
  total: Cents;
}

/**
 * Totales de un documento: agrupa las bases por tipo impositivo y calcula la
 * cuota de cada tipo sobre la suma de sus bases, como en la factura impresa.
 */
export function documentTotals(lines: readonly TaxableLine[]): Totals {
  const byRate = new Map<BasisPoints, Cents>();
  for (const line of lines) {
    assertCents(line.base, 'La base');
    if (!Number.isInteger(line.taxRate) || line.taxRate < 0) throw new RangeError('El tipo impositivo no es válido');
    byRate.set(line.taxRate, (byRate.get(line.taxRate) ?? 0) + line.base);
  }
  const taxes = [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([taxRate, base]) => ({ taxRate, base, tax: roundHalfAwayFromZero((base * taxRate) / 10000) }));
  const base = taxes.reduce((sum, t) => sum + t.base, 0);
  const tax = taxes.reduce((sum, t) => sum + t.tax, 0);
  return { taxes, base, tax, total: base + tax };
}
