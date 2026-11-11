/** Ajustes de facturación: series, impuestos y métodos de pago (RF-CFG-02, RF-CFG-03, RF-FAC-01). */
import type { SaveResult } from './workshop';

export const DOC_TYPES = ['work_order', 'quote', 'invoice', 'rectifying_invoice', 'payment_receipt'] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  work_order: 'Órdenes de trabajo',
  quote: 'Presupuestos',
  invoice: 'Facturas',
  rectifying_invoice: 'Facturas rectificativas',
  payment_receipt: 'Recibos de cobro',
};

/** Serie de un tipo de documento para el año en curso. */
export interface SeriesConfig {
  docType: DocType;
  prefix: string;
  year: number;
  /** Número que llevará el siguiente documento. */
  nextNumber: number;
  /** Ya se ha emitido algún documento con esta serie este año: no se puede cambiar. */
  locked: boolean;
  /** Cómo quedará el siguiente número: `F-2026-0001`. */
  example: string;
}

export interface SeriesInput {
  docType: DocType;
  prefix: string;
  nextNumber: number;
}

export interface TaxRate {
  id: string;
  name: string;
  /** Porcentaje en puntos básicos: 2100 = 21 %. */
  rateBp: number;
  isDefault: boolean;
  active: boolean;
  version: number;
}

export interface PaymentMethod {
  id: string;
  name: string;
  active: boolean;
  version: number;
}

export interface BillingService {
  series(): Promise<SeriesConfig[]>;
  saveSeries(input: SeriesInput): Promise<SaveResult<SeriesConfig, 'prefix' | 'nextNumber'>>;
  taxRates(): Promise<TaxRate[]>;
  /** `percent` como lo escribe una persona: «21» o «10,5». */
  addTaxRate(input: { name: string; percent: string }): Promise<SaveResult<TaxRate, 'name' | 'percent'>>;
  /** Activar o desactivar, o marcar como tipo por defecto. */
  updateTaxRate(input: { id: string; active: boolean; isDefault: boolean; version: number }): Promise<SaveResult<TaxRate[], 'active'>>;
  paymentMethods(): Promise<PaymentMethod[]>;
  addPaymentMethod(input: { name: string }): Promise<SaveResult<PaymentMethod, 'name'>>;
  updatePaymentMethod(input: { id: string; active: boolean; version: number }): Promise<SaveResult<PaymentMethod[], 'active'>>;
}
