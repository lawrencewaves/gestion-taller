import { createContext, useContext } from 'react';
import type { Services } from '@gonzalvo/contracts';

/** La interfaz recibe los servicios desde fuera; nunca sabe si vienen de Tauri o del Worker (D-007). */
export const ServicesContext = createContext<Services | null>(null);

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('Faltan los servicios: monta <App> con la prop services.');
  return services;
}
