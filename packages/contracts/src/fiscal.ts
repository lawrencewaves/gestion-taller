/**
 * Subsistema fiscal (ARCHITECTURE §9, D-014, D-039). Por ahora solo existe su esqueleto:
 * la modalidad, las reglas de quién puede emitir y quién puede hablar con la AEAT, y el puerto de envío.
 * Formatos, huella, QR y servicio web se implementan en la Fase 8 y solo con la especificación oficial vigente.
 */

/** `settings.fiscal_mode`. Desactivada hasta la validación fiscal. */
export type FiscalMode = 'off' | 'verifactu' | 'no_verifactu';

export const FISCAL_MODE_LABELS: Record<FiscalMode, string> = {
  off: 'Desactivada',
  verifactu: 'VERI*FACTU',
  no_verifactu: 'NO VERI*FACTU',
};

/** Qué puede hacer la facturación en este entorno y con esta modalidad. */
export interface FiscalPolicy {
  mode: FiscalMode;
  /** Se pueden emitir facturas en este programa. */
  canIssue: boolean;
  /** Las facturas emitidas son simulaciones marcadas como DEMO (fuera de TALLER). */
  simulated: boolean;
  /** Este entorno puede comunicarse con la AEAT. Solo TALLER y solo con la modalidad activada (RF-FIS-10). */
  aeatAllowed: boolean;
  /** Explicación para la interfaz. */
  reason: string;
}
