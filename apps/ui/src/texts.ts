/** Textos de la interfaz, centralizados para poder traducir en el futuro (RNF-06). */
export const texts = {
  nav: {
    inicio: 'Inicio',
    agenda: 'Agenda',
    ordenes: 'Órdenes',
    presupuestos: 'Presupuestos',
    facturas: 'Facturas',
    cobros: 'Cobros',
    clientes: 'Clientes',
    vehiculos: 'Vehículos',
    catalogo: 'Catálogo',
    configuracion: 'Configuración',
    diagnostico: 'Diagnóstico',
    menu: 'Menú principal',
  },
  env: {
    DEMO: 'DEMO · Datos ficticios',
    PREVIEW: (branch: string) => `PREVIEW · ${branch} · Datos ficticios`,
    LOCAL: 'LOCAL · Desarrollo',
  },
  pending: {
    title: (name: string) => `${name} llegará en la Fase 5`,
    body: 'Los módulos se construyen de uno en uno y se aprueban en la DEMO antes de pasar al siguiente. El primero será Configuración, seguido de Clientes y Vehículos.',
  },
} as const;
