# CLAUDE.md

Instrucciones de trabajo para Claude en este repositorio.

## Al empezar cada sesión

1. Leer `CURRENT_STATE.md`.
2. Leer solo los documentos que la tarea necesite (`PROJECT.md` tiene el mapa).
3. No volver a preguntar lo que ya figura en `DECISIONS.md`.

## Método

- Una fase y una funcionalidad cada vez. Nada se empieza sin aprobación.
- Una pregunta cada vez, la más importante.
- Antes de modificar un archivo, revisar su estado actual.
- Mostrar solo los cambios, no archivos completos.
- Las decisiones nuevas se registran en `DECISIONS.md`. Para cambiar una, se añade otra que la sustituya.
- Al terminar una sesión: actualizar `CURRENT_STATE.md` y, si hay versión, `CHANGELOG.md`.
- Commits pequeños y en español, con el identificador de requisito cuando aplique: `feat(clientes): alta y edición (RF-CLI-01)`.

## Reglas que no se rompen

- La lógica de negocio va solo en `packages/core`. Nada de reglas en componentes React.
- `apps/ui` no importa Tauri, `core`, `data` ni adaptadores.
- Un solo esquema y unas solas migraciones SQLite para escritorio y demo.
- SQLite en el navegador solo en DEMO, PREVIEW y LOCAL, y siempre con datos ficticios (D-024).
- Nunca se usan datos reales fuera de TALLER, ni en pruebas.
- Nunca se comunican DEMO, PREVIEW o LOCAL con la AEAT.
- Ningún requisito fiscal se implementa sin fuente oficial vigente de la AEAT. No se afirma cumplimiento de VeriFactu sin verificarlo.
- Los registros fiscales y las facturas emitidas no se modifican ni se borran.
- Ningún secreto en el repositorio. Nada sensible con prefijo `VITE_`.
- Ninguna dependencia nueva sin justificarla en el pull request.
- Nada se publica en DEMO ni en TALLER sin aprobación.

## Ramas

`feature/<nombre>` → pull request → aprobación → `main` (DEMO) → etiqueta `vX.Y.Z` (TALLER). Ver ARCHITECTURE §11.

## Comandos

Se completarán en la Fase 4.
