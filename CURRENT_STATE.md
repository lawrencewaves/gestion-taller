# CURRENT_STATE

Dónde estamos. Se actualiza al final de cada sesión. Es lo primero que se lee.

**Fecha:** 2026-11-09
**Fase:** 4 · Núcleo (en curso)

## Hecho

- Fases 1, 2 y 3 cerradas (D-029).
- Diseño de referencia: `UX.md`, `design/tokens.json`, `design/marca/`, sistema visual «Gonzalvo» y lienzo «Gonzalvo · Pantallas» (artifacts privados de Robert).
- Fase 4, pasos 1 a 3 en la rama `feature/fase-4-base` (D-030): monorepo, prueba de SQLite en el navegador (correcta en Chromium) y publicación en GitHub Pages.

## Siguiente paso

1. **Robert:** activar GitHub Pages (Settings → Pages → Deploy from a branch → `gh-pages` / root) y abrir la pantalla de diagnóstico del PREVIEW en Safari.
2. Si el diagnóstico es correcto: paso 4 de la Fase 4 (`core`, `contracts` y `data` con la primera migración).

## Preguntas abiertas

| Tema | Dónde está | Bloquea |
|---|---|---|
| Funcionamiento de OPFS sin cabeceras especiales en Safari | D-024 | Fase 4, paso 4 |
| Método de conexión con Gmail | D-023 | Fase 5 |
| Obligaciones como productor del software | D-016 | Fase 8 |
| Confirmar aplazamiento VeriFactu (publicación en BOE) | D-015 | Fase 8 |

## Riesgos vigilados

- Las copias son la única protección ante la pérdida del Mac: comprobar periódicamente que llegan a Google Drive.
- La contraseña de copias, si se pierde, inutiliza las copias: hoja de recuperación impresa.
- Aviso de macOS en la primera apertura (sin firma de Apple).
- Los datos de la demo viven en cada navegador: las pruebas del cliente solo llegan si las exporta.
