import type { Environment, FiscalMode, FiscalPolicy } from '@gonzalvo/contracts';
import type { SqlExecutor } from '../ports';

/**
 * Esqueleto fiscal (ARCHITECTURE §9, D-014, D-039).
 *
 * Aquí solo están las reglas que no dependen de la especificación técnica de la AEAT.
 * Los registros, la huella, el QR y el envío real llegan en la Fase 8, con la documentación
 * oficial vigente; hasta entonces `FISCAL_MODULE_READY` es falso y en TALLER no se emiten facturas.
 */
export const FISCAL_MODULE_READY = false;

export class FiscalError extends Error {
  override name = 'FiscalError';
}

/** RF-FIS-10: DEMO, PREVIEW y LOCAL no hablan nunca con la AEAT. */
export const isAeatEnvironment = (environment: Environment) => environment === 'TALLER';

export function fiscalPolicy(environment: Environment, mode: FiscalMode, moduleReady = FISCAL_MODULE_READY): FiscalPolicy {
  if (!isAeatEnvironment(environment)) {
    return {
      mode,
      canIssue: true,
      simulated: true,
      aeatAllowed: false,
      reason: 'Facturas simuladas, marcadas como DEMO. Nunca se envían a la AEAT.',
    };
  }
  if (mode === 'off' || !moduleReady) {
    return {
      mode,
      canIssue: false,
      simulated: false,
      aeatAllowed: false,
      reason: 'La emisión de facturas se activa tras la validación fiscal. Mientras tanto se factura con Stall.',
    };
  }
  return { mode, canIssue: true, simulated: false, aeatAllowed: true, reason: 'Facturación con registro fiscal activa.' };
}

export async function readFiscalMode(db: SqlExecutor): Promise<FiscalMode> {
  const row = await db.get<{ fiscal_mode: FiscalMode }>('SELECT fiscal_mode FROM settings WHERE id = 1');
  return row?.fiscal_mode ?? 'off';
}

/** Para los casos de uso de facturación (Fase 5): falla si este programa no puede emitir. */
export function assertCanIssue(policy: FiscalPolicy): void {
  if (!policy.canIssue) throw new FiscalError(policy.reason);
}

// ---------------------------------------------------------------------------
// Puerto de envío
// ---------------------------------------------------------------------------

/** Resultado de un envío. Los estados finales siguen ARCHITECTURE §9; su traducción a la respuesta real de la AEAT se fija en la Fase 8. */
export type FiscalSubmissionResult =
  | { status: 'accepted'; response: unknown }
  | { status: 'accepted_with_errors'; response: unknown }
  | { status: 'rejected'; response: unknown }
  /** No se ha podido enviar (sin conexión, servicio caído): el registro sigue en la cola. */
  | { status: 'retry'; error: string };

export interface FiscalSubmission {
  recordId: string;
  /** Versión de la especificación con la que se generó el registro (RF-FIS-07). */
  specVersion: string;
  /** Contenido ya preparado según la especificación. Este puerto no lo interpreta. */
  payload: unknown;
}

export interface FiscalGateway {
  submit(submission: FiscalSubmission): Promise<FiscalSubmissionResult>;
}

/** Pasarela de la modalidad desactivada y de todos los entornos que no son TALLER: no envía nada. */
export function createNullFiscalGateway(): FiscalGateway {
  return {
    submit: async () => {
      throw new FiscalError('La comunicación con la AEAT está desactivada.');
    },
  };
}

/**
 * Barrera: aunque por error se configure una pasarela real fuera de TALLER o con la modalidad
 * desactivada, no llega a llamarse (RF-FIS-10). Toda pasarela se monta a través de esta función.
 */
export function guardFiscalGateway(policy: FiscalPolicy, gateway: FiscalGateway): FiscalGateway {
  return policy.aeatAllowed ? gateway : createNullFiscalGateway();
}
