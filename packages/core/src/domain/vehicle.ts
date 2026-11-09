/**
 * Matrícula normalizada para buscar y evitar duplicados (RF-VEH-05):
 * mayúsculas, sin espacios, guiones ni puntos.
 */
export function normalizePlate(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-·]/g, '');
}
