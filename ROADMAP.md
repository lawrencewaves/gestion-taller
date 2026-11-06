# ROADMAP

Fases, entregables y criterios de salida. Ninguna fase empieza sin aprobación expresa de la anterior.
La web existe desde el primer commit de la Fase 4: cada avance se prueba en un enlace PREVIEW o DEMO. La antigua fase de "demo online" se integra en las fases 4 y 5.

| Fase | Contenido | Criterio de salida |
|---|---|---|
| 1. Requisitos y análisis | Decisiones, riesgos y alcance | **Cerrada** (2026-11-06) |
| 2. Arquitectura y documentación | Documentos del repositorio, repositorio GitHub, alojamiento de la demo | Documentos aprobados y repositorio publicado |
| 3. Diseño UX/UI | Navegación, sistema visual y prototipos de pantallas clave | Prototipos aprobados por Robert y por el taller |
| 4. Núcleo | Ver detalle | Aplicación vacía funcionando en PREVIEW, DEMO y como instalador de prueba en el Mac |
| 5. MVP | Módulos uno a uno (orden abajo) | Cada módulo aprobado en DEMO antes del siguiente |
| 6. Validación con el taller | Uso de prueba en paralelo a Stall, sin facturar | El taller valida los flujos diarios |
| 7. Distribución | Instalador definitivo, copias y restauración probadas, documentación de usuario | Taller trabajando con la aplicación (facturación aún en Stall) |
| 8. Fiscal | Verificación normativa, modalidad, pruebas con la AEAT en entorno de pruebas, asesor | Validación completa antes del 1 de julio de 2027 |

## Fase 4 · Núcleo

Orden de trabajo, un paso cada vez:

1. Monorepo, lint de dependencias y pruebas.
2. Alojamiento de la demo, PREVIEW y protección de `main`.
3. `core`, `contracts` y `data` con la primera migración.
4. API de la demo, RPC y base libSQL con datos ficticios.
5. Contenedor Tauri y Rust (SQLite), y compilación de macOS en GitHub Actions.
6. Usuarios, permisos, inicio de sesión y registro de actividad.
7. Copias de seguridad y restauración.
8. Esqueleto fiscal desactivado (tablas, triggers, puertos, `fiscal-null`).
9. Actualizador.

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
12. Inicio

Inicio va el último porque resume datos de todos los demás.

## Después del MVP (sin fecha)

Stock y compras, tiempos y fichajes, vehículos de sustitución, Windows y multidispositivo (ver REQUIREMENTS §18).
