import type { Session, SaveResult, WorkshopField, WorkshopInput, WorkshopProfile, WorkshopService } from '@gonzalvo/contracts';
import { LOGO_MAX_BYTES } from '@gonzalvo/contracts';
import {
  formatIban, isValidEmail, isValidIban, isValidPhone, normalizeIban, normalizeTaxId, provinceFromPostalCode, taxIdKind,
} from '../domain/identity';
import type { Clock, IdGenerator, SqlExecutor } from '../ports';
import { logActivity } from './activity';
import { requirePermission, requireSession } from './auth';

interface Row {
  legal_name: string;
  trade_name: string;
  tax_id: string;
  address_line: string;
  postal_code: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  iban: string;
  logo: string | null;
  updated_at: string;
  version: number;
}

const toProfile = (r: Row): WorkshopProfile => ({
  legalName: r.legal_name,
  tradeName: r.trade_name,
  taxId: r.tax_id,
  addressLine: r.address_line,
  postalCode: r.postal_code,
  city: r.city,
  province: r.province,
  phone: r.phone,
  email: r.email,
  iban: r.iban,
  logo: r.logo,
  updatedAt: r.updated_at,
  version: r.version,
});

const LOGO_PREFIX = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+=*$/;
/** Bytes reales de una imagen en base64. */
const logoBytes = (dataUrl: string) => Math.floor(((dataUrl.length - dataUrl.indexOf(',') - 1) * 3) / 4);

/**
 * Normaliza y valida (RF-CFG-01). Los datos que exige la factura son obligatorios;
 * el resto, si se rellena, tiene que ser correcto.
 */
export function validateWorkshop(input: WorkshopInput): { value: Omit<WorkshopProfile, 'updatedAt'> } | { fieldErrors: Partial<Record<WorkshopField, string>> } {
  const errors: Partial<Record<WorkshopField, string>> = {};
  const text = (v: string) => v.trim().replace(/\s+/g, ' ');
  const legalName = text(input.legalName);
  const tradeName = text(input.tradeName);
  const taxId = normalizeTaxId(input.taxId);
  const addressLine = text(input.addressLine);
  const postalCode = input.postalCode.trim();
  const city = text(input.city);
  const phone = text(input.phone);
  const email = input.email.trim().toLowerCase();
  const ibanRaw = normalizeIban(input.iban);

  if (!legalName) errors.legalName = 'Escribe el nombre del titular o la razón social, como debe salir en las facturas.';
  if (!taxId) errors.taxId = 'El NIF es obligatorio en las facturas.';
  else if (!taxIdKind(taxId)) errors.taxId = 'El NIF no es correcto: revisa los números y la letra.';
  if (!addressLine) errors.addressLine = 'La dirección fiscal es obligatoria en las facturas.';
  const province = provinceFromPostalCode(postalCode);
  if (!postalCode) errors.postalCode = 'El código postal es obligatorio.';
  else if (!province) errors.postalCode = 'El código postal tiene 5 cifras y empieza entre 01 y 52.';
  if (!city) errors.city = 'Escribe la población.';
  if (phone && !isValidPhone(phone)) errors.phone = 'El teléfono tiene que tener entre 9 y 15 cifras.';
  if (email && !isValidEmail(email)) errors.email = 'El email no es correcto.';
  if (ibanRaw && !isValidIban(ibanRaw)) errors.iban = 'El IBAN no es correcto: revisa que esté completo.';
  if (input.logo !== null) {
    if (!LOGO_PREFIX.test(input.logo)) errors.logo = 'El logotipo tiene que ser una imagen PNG o JPG.';
    else if (logoBytes(input.logo) > LOGO_MAX_BYTES) errors.logo = 'El logotipo es demasiado grande.';
  }
  if (Object.keys(errors).length > 0) return { fieldErrors: errors };
  return {
    value: {
      legalName, tradeName, taxId, addressLine, postalCode, city, province: province ?? '', phone, email,
      iban: ibanRaw ? formatIban(ibanRaw) : '', logo: input.logo, version: input.version,
    },
  };
}

export function createWorkshopService(deps: { db: SqlExecutor; clock: Clock; ids: IdGenerator; session: () => Session | null }): WorkshopService {
  const { db, clock } = deps;
  const read = async () => {
    const row = await db.get<Row>(
      `SELECT legal_name, trade_name, tax_id, address_line, postal_code, city, province, phone, email, iban, logo, updated_at, version
       FROM settings WHERE id = 1`,
    );
    if (!row) throw new Error('Falta la configuración del taller.');
    return toProfile(row);
  };

  return {
    async get() {
      requireSession(deps.session());
      return read();
    },

    async update(input): Promise<SaveResult<WorkshopProfile, WorkshopField>> {
      const session = requirePermission(deps.session(), 'config.manage');
      const checked = validateWorkshop(input);
      if ('fieldErrors' in checked) return { ok: false, fieldErrors: checked.fieldErrors };
      const v = checked.value;
      const before = await read();
      const changed = (Object.keys(v) as (keyof typeof v)[]).filter((k) => k !== 'version' && v[k] !== before[k]);
      if (changed.length === 0) return { ok: true, value: before };

      const saved = await db.transaction(async (tx) => {
        const { changes } = await tx.run(
          `UPDATE settings SET legal_name = ?, trade_name = ?, tax_id = ?, address_line = ?, postal_code = ?, city = ?, province = ?,
             phone = ?, email = ?, iban = ?, logo = ?, updated_at = ?, version = version + 1
           WHERE id = 1 AND version = ?`,
          [v.legalName, v.tradeName, v.taxId, v.addressLine, v.postalCode, v.city, v.province, v.phone, v.email, v.iban, v.logo, clock.now(), v.version],
        );
        if (changes === 0) return false;
        // Qué campos cambiaron, no sus valores: el registro no duplica datos.
        await logActivity(tx, deps, { userId: session.userId, action: 'settings.workshop', entityType: 'settings', changes: { fields: changed } });
        return true;
      });
      if (!saved) {
        return { ok: false, fieldErrors: {}, error: 'Otra persona ha cambiado estos datos mientras los editabas. Vuelve a abrir la pantalla para ver los últimos.' };
      }
      return { ok: true, value: await read() };
    },
  };
}
