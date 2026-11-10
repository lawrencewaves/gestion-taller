# CURRENT_STATE

Dónde estamos. Se actualiza al final de cada sesión. Es lo primero que se lee.

**Fecha:** 2026-11-10
**Fase:** 4 · Núcleo (en curso)

## Hecho

- Fases 1, 2 y 3 cerradas (D-029).
- Diseño de referencia: `UX.md`, `design/tokens.json`, `design/marca/`, sistema visual «Gonzalvo» y lienzo «Gonzalvo · Pantallas» (artifacts privados de Robert).
- Fase 4, pasos 1 a 3 publicados en DEMO (D-030): monorepo, SQLite en el navegador y GitHub Pages.
- Fase 4, pasos 4 y 5 publicados en DEMO (D-031): migrador, primera migración y base real en el navegador.
- Fase 4, paso 6 en la rama `feature/fase-4-escritorio` (D-032): app de Mac con Tauri y SQLite en Rust; instalador de prueba compilado en GitHub.

## Siguiente paso

1. **Robert:** instalar la app de prueba en el Mac y abrir Diagnóstico.
2. Paso 7 de la Fase 4: usuarios, permisos, inicio de sesión y registro de actividad.

## Preguntas abiertas

| Tema | Dónde está | Bloquea |
|---|---|---|
| Probar la demo en Safari (solo si el titular lo usa) | D-031 | Enseñar la demo al taller |
| Método de conexión con Gmail | D-023 | Fase 5 |
| Obligaciones como productor del software | D-016 | Fase 8 |
| Confirmar aplazamiento VeriFactu (publicación en BOE) | D-015 | Fase 8 |

## Riesgos vigilados

- Las copias son la única protección ante la pérdida del Mac: comprobar periódicamente que llegan a Google Drive.
- La contraseña de copias, si se pierde, inutiliza las copias: hoja de recuperación impresa.
- Aviso de macOS en la primera apertura (sin firma de Apple).
- Los datos de la demo viven en cada navegador: las pruebas del cliente solo llegan si las exporta.
