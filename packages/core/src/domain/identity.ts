/**
 * Datos de identificación de España (RF-CFG-01, y más adelante clientes y proveedores):
 * NIF de personas (DNI), NIE, NIF de entidades (antiguo CIF), IBAN, código postal y provincia.
 * Solo comprueban el formato y el dígito de control: no dicen si el número existe.
 */

const DNI_LETTERS = 'TRWAGMYFPDXBNJZSQVHLCKE';

/** Mayúsculas y sin espacios, guiones ni puntos. */
export const normalizeTaxId = (raw: string) => raw.toUpperCase().replace(/[\s.-]/g, '');

const dniLetter = (digits: string) => DNI_LETTERS[Number(digits) % 23];

function validEntityNif(nif: string): boolean {
  const m = /^([ABCDEFGHJNPQRSUVW])(\d{7})([0-9A-J])$/.exec(nif);
  if (!m) return false;
  const [, kind = '', body = '', control = ''] = m;
  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const d = Number(body[i]);
    if (i % 2 === 0) {
      const doubled = d * 2;
      sum += Math.floor(doubled / 10) + (doubled % 10);
    } else {
      sum += d;
    }
  }
  const digit = (10 - (sum % 10)) % 10;
  const letter = 'JABCDEFGHI'[digit] ?? '';
  // Unas entidades llevan letra de control, otras número; el resto admite ambos.
  if ('PQRSNW'.includes(kind)) return control === letter;
  if ('ABEH'.includes(kind)) return control === String(digit);
  return control === letter || control === String(digit);
}

export type TaxIdKind = 'dni' | 'nie' | 'entity' | 'special';

/** Tipo de NIF si es válido; `null` si no lo es. Espera el valor ya normalizado. */
export function taxIdKind(nif: string): TaxIdKind | null {
  let m = /^(\d{8})([A-Z])$/.exec(nif);
  if (m) return dniLetter(m[1] ?? '') === m[2] ? 'dni' : null;
  m = /^([XYZ])(\d{7})([A-Z])$/.exec(nif);
  if (m) return dniLetter(`${'XYZ'.indexOf(m[1] ?? '')}${m[2] ?? ''}`) === m[3] ? 'nie' : null;
  // K, L y M: NIF de personas sin DNI (menores, no residentes...), con letra calculada como el DNI.
  m = /^([KLM])(\d{7})([A-Z])$/.exec(nif);
  if (m) return dniLetter(m[2] ?? '') === m[3] ? 'special' : null;
  return validEntityNif(nif) ? 'entity' : null;
}

/** IBAN sin espacios y en mayúsculas. */
export const normalizeIban = (raw: string) => raw.toUpperCase().replace(/\s/g, '');

/** Comprueba el dígito de control (ISO 13616, módulo 97). Los IBAN españoles tienen 24 caracteres. */
export function isValidIban(iban: string): boolean {
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban)) return false;
  if (iban.startsWith('ES') && iban.length !== 24) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const value = ch >= 'A' ? String(ch.charCodeAt(0) - 55) : ch;
    for (const d of value) remainder = (remainder * 10 + Number(d)) % 97;
  }
  return remainder === 1;
}

/** «ES91 2100 0418 4502 0005 1332». */
export const formatIban = (iban: string) => iban.replace(/(.{4})(?=.)/g, '$1 ');

/** Provincias por los dos primeros dígitos del código postal (01–52). */
const PROVINCES = [
  'Araba/Álava', 'Albacete', 'Alicante/Alacant', 'Almería', 'Ávila', 'Badajoz', 'Illes Balears', 'Barcelona', 'Burgos',
  'Cáceres', 'Cádiz', 'Castellón/Castelló', 'Ciudad Real', 'Córdoba', 'A Coruña', 'Cuenca', 'Girona', 'Granada',
  'Guadalajara', 'Gipuzkoa', 'Huelva', 'Huesca', 'Jaén', 'León', 'Lleida', 'La Rioja', 'Lugo', 'Madrid', 'Málaga',
  'Murcia', 'Navarra', 'Ourense', 'Asturias', 'Palencia', 'Las Palmas', 'Pontevedra', 'Salamanca',
  'Santa Cruz de Tenerife', 'Cantabria', 'Segovia', 'Sevilla', 'Soria', 'Tarragona', 'Teruel', 'Toledo',
  'Valencia/València', 'Valladolid', 'Bizkaia', 'Zamora', 'Zaragoza', 'Ceuta', 'Melilla',
] as const;

/** Provincia de un código postal español, o `null` si el código no es válido. */
export function provinceFromPostalCode(postalCode: string): string | null {
  if (!/^\d{5}$/.test(postalCode)) return null;
  return PROVINCES[Number(postalCode.slice(0, 2)) - 1] ?? null;
}

export const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/** Teléfono: entre 9 y 15 cifras, con espacios y prefijo «+» opcionales. */
export function isValidPhone(phone: string): boolean {
  if (!/^\+?[\d\s]+$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '').length;
  return digits >= 9 && digits <= 15;
}
