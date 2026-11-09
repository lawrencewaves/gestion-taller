# Gonzalvo

Software de gestión para un taller mecánico: clientes, vehículos, órdenes de trabajo, presupuestos, facturación, cobros y agenda.

- **Aplicación de escritorio** para macOS, con datos locales y funcionamiento sin Internet.
- **Demo web** con datos ficticios para probar cada novedad antes de publicarla.

> Estado: Fase 4, base técnica. Todavía no hay código de aplicación. Ver `CURRENT_STATE.md`.

## Documentación

| Documento | Para qué |
|---|---|
| [PROJECT.md](PROJECT.md) | Visión, alcance y mapa de la documentación |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Qué hace el software |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Cómo está construido y desplegado |
| [DATABASE.md](DATABASE.md) | Modelo de datos y migraciones |
| [UX.md](UX.md) | Navegación y flujos |
| [ROADMAP.md](ROADMAP.md) | Fases y orden de desarrollo |
| [DECISIONS.md](DECISIONS.md) | Decisiones y su justificación |
| [CURRENT_STATE.md](CURRENT_STATE.md) | Estado actual |
| [CHANGELOG.md](CHANGELOG.md) | Cambios por versión |

## Puesta en marcha

Requisitos: Node 22 y pnpm (`corepack enable pnpm`).

```sh
pnpm install
pnpm dev      # versión web en local
pnpm check    # lint, tipos y pruebas
```

Demo: `https://lawrencewaves.github.io/gestion-taller/` · Cada rama `feature/*`: `…/gestion-taller/preview/<rama>/`.

## Licencia

Todos los derechos reservados. El código es visible, pero no se concede licencia de uso, copia ni distribución.
