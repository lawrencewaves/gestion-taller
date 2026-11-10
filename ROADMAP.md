# ROADMAP

Fases, entregables y criterios de salida. Ninguna fase empieza sin aprobación expresa de la anterior.
La web existe desde el primer commit de la Fase 4: cada avance se prueba en un enlace PREVIEW o DEMO. La antigua fase de "demo online" se integra en las fases 4 y 5.

| Fase | Contenido | Criterio de salida |
|---|---|---|
| 1. Requisitos y análisis | Decisiones, riesgos y alcance | **Cerrada** (2026-11-06) |
| 2. Arquitectura y documentación | Documentos del repositorio, repositorio GitHub, alojamiento de la demo | **Cerrada** (2026-11-08) |
| 3. Diseño UX/UI | Navegación, sistema visual y prototipos de pantallas clave | **Cerrada** (2026-11-09) |
| 4. Núcleo | Ver detalle | Aplicación vacía funcionando en PREVIEW, DEMO y como instalador de prueba en el Mac |
| 5. MVP | Módulos uno a uno (orden abajo) | Cada módulo aprobado en DEMO antes del siguiente |
| 6. Validación con el taller | Uso de prueba en paralelo a Stall, sin facturar | El taller valida los flujos diarios |
| 7. Distribución | Instalador definitivo, copias y restauración probadas, documentación de usuario | Taller trabajando con la aplicación (facturación aún en Stall) |
| 8. Fiscal | Verificación normativa, modalidad, pruebas con la AEAT en entorno de pruebas, asesor | Validación completa antes del 1 de julio de 2027 |

## Fase 4 · Núcleo

Orden de trabajo, un paso cada vez:

1. Monorepo, lint de dependencias y pruebas.
2. Prueba técnica de SQLite WASM con OPFS en Safari y Chrome (D-024). Si falla, se revisa la decisión antes de seguir.
3. GitHub Pages: DEMO desde `main` y PREVIEW por rama con GitHub Actions.
4. `core`, `contracts` y `data` con la primera migración.
5. Contenedor web: Web Worker, proxy de servicios y datos ficticios.
6. Contenedor Tauri y Rust (SQLite), y compilación de macOS en GitHub Actions.
7. Usuarios, permisos, inicio de sesión y registro de actividad.
8. Copias de seguridad y restauración.
9. Esqueleto fiscal desactivado (tablas, triggers, puertos, `fiscal-null`).
10. Actualizador.

## Fase 5 · Orden de los módulos

1. Configuración
2. Clientes
3. Vehículos (con adjuntos)
4. Catálogo
5. Órdenes de trabajo (con recepción)
6. Presupuestos
7. Agenda
8. Facturación (bloqueada en TALLER)
9. Cobros
10. Documentos PDF y envío por email
11. Exportación CSV
12. Importación desde Stall (RF-IMP)
13. Inicio

Inicio va el último porque resume datos de todos los demás. La importación va antes de la validación con el taller (Fase 6), para que el taller pruebe con su propio historial. El formato de los archivos de Stall se estudia ya, porque condiciona las tablas de cada módulo.

## Después del MVP (sin fecha)

Stock y compras, tiempos y fichajes, vehículos de sustitución, Windows y multidispositivo (ver REQUIREMENTS §18).
