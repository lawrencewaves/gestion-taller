# CURRENT_STATE

Dónde estamos. Se actualiza al final de cada sesión. Es lo primero que se lee.

**Fecha:** 2026-11-10
**Fase:** 4 · Núcleo (en curso)

## Hecho

- Fases 1, 2 y 3 cerradas (D-029).
- Diseño de referencia: `UX.md`, `design/tokens.json`, `design/marca/`, sistema visual «Gonzalvo» y lienzo «Gonzalvo · Pantallas» (artifacts privados de Robert).
- Fase 4, pasos 1 a 3 publicados en DEMO (D-030): monorepo, SQLite en el navegador y GitHub Pages.
- Fase 4, pasos 4 y 5 publicados en DEMO (D-031): migrador, primera migración y base real en el navegador.
- Fase 4, paso 6 publicado (D-032 a D-036): app de escritorio para Windows, verificada por Robert. Mac en pausa.
- Fase 4, paso 7 publicado (D-037): usuarios, inicio de sesión, permisos por rol y registro de actividad, verificado por Robert en la demo y en Windows.
- Fase 4, paso 8 publicado (D-038): copias cifradas a la carpeta de Google Drive, diaria, manual y a USB, retención, aviso de 48 horas, hoja de recuperación y restauración.
- Calendario VeriFactu verificado (D-039): vigente el 1 de julio de 2027; aplazamiento a octubre de 2028 anunciado, sin publicar.
- Fase 4, paso 9 en la rama `feature/fase-4-fiscal` (D-040): esqueleto fiscal desactivado.

## Siguiente paso

1. **Robert:** revisar y fusionar `feature/fase-4-fiscal`.
2. **Robert:** conseguir de Stall una exportación de muestra para estudiar su formato (D-035).
3. Paso 10 de la Fase 4: actualizador y primera versión TALLER con etiqueta.

## Preguntas abiertas

| Tema | Dónde está | Bloquea |
|---|---|---|
| Probar la demo en Safari (solo si el titular lo usa) | D-031 | Enseñar la demo al taller |
| Google Drive para escritorio y la carpeta compartida en el ordenador del taller | D-013, D-038 | Copias reales en TALLER |
| Formato de la exportación de Stall | D-035 | Tablas de la Fase 5 |
| Método de conexión con Gmail | D-023 | Fase 5 |
| Obligaciones como productor del software | D-016 | Fase 8 |
| Aplazamiento VeriFactu a octubre de 2028: pendiente de publicarse en el BOE | D-039 | Fecha límite de la Fase 8 |

## Riesgos vigilados

- Las copias son la única protección ante la pérdida del ordenador: comprobar periódicamente que llegan a Google Drive.
- La clave de copias, si se pierde junto con el ordenador, inutiliza las copias: hoja de recuperación impresa y guardada fuera del taller.
- Aviso de Windows SmartScreen en la primera apertura (sin firma de código).
- Los datos de la demo viven en cada navegador: las pruebas del cliente solo llegan si las exporta.
