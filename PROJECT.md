# PROJECT

Visión, alcance y mapa de la documentación. Las decisiones concretas están en `DECISIONS.md`.

## Propósito

**Gonzalvo** es el software de gestión propio para **un único taller mecánico en España**, cuyo titular es **autónomo**. Sustituye a Stall, que se usa solo como referencia funcional, nunca visual ni de código.

## Principios

1. **Sencillo:** pocos clics para las operaciones diarias de un taller.
2. **Local y sin Internet:** el taller trabaja aunque no haya conexión.
3. **Coste cero:** sin servidor, sin suscripción, sin licencias de pago.
4. **Fiscalmente sólido:** arquitectura VeriFactu desde la primera versión.
5. **Modular:** cada módulo se desarrolla, prueba y aprueba por separado.

## Modelo de producto

| Aspecto | Decisión |
|---|---|
| Licencia | Perpetua y gratuita para el taller |
| Plataforma | Aplicación de escritorio (Tauri 2). Mac primero; Windows solo si hace falta |
| Datos | SQLite en el ordenador del taller |
| Internet | Solo para actualizaciones y, cuando se active, VeriFactu |
| Copias | Cifradas, en la carpeta sincronizada de Google Drive y en USB |
| Web | Solo DEMO y PREVIEW, con datos ficticios |

## Personas

| Persona | Papel |
|---|---|
| Robert Lawrence Arasa Ribas | Dirige y desarrolla el proyecto. Figura como productor del software |
| Titular del taller | Cliente. Valida cada funcionalidad en la demo |
| Usuarios del taller | Administrador, Recepción y Mecánico |

## Restricciones

- **VeriFactu.** Fecha vigente para autónomos: 1 de julio de 2027 (RDL 15/2025). Hacienda ha anunciado un aplazamiento a octubre de 2028 que aún no está publicado; se planifica con la fecha vigente.
- **Facturación real.** El taller sigue facturando con Stall hasta que el módulo fiscal esté validado.
- **RGPD.** Datos personales de clientes en local y en copias compartidas.

## Mapa de documentación

| Documento | Función | Cuándo se actualiza |
|---|---|---|
| `README.md` | Presentación y arranque rápido | Al cambiar comandos o estructura |
| `PROJECT.md` | Visión, alcance y personas | Rara vez |
| `REQUIREMENTS.md` | Qué debe hacer el software (requisitos con identificador) | Al aprobar o cambiar un requisito |
| `ARCHITECTURE.md` | Cómo está construido y desplegado | Al cambiar la estructura técnica |
| `DATABASE.md` | Modelo de datos, convenciones y migraciones | Con cada migración |
| `UX.md` | Navegación, flujos y patrones de pantalla | Al aprobar o cambiar el diseño |
| `ROADMAP.md` | Fases, orden de módulos y criterios de salida | Al cerrar una fase |
| `DECISIONS.md` | Registro de decisiones y su justificación | Con cada decisión |
| `CHANGELOG.md` | Cambios por versión | Con cada versión |
| `CURRENT_STATE.md` | Dónde estamos, siguiente paso, preguntas abiertas | Al final de cada sesión |
| `CLAUDE.md` | Instrucciones de trabajo para Claude | Al cambiar el método de trabajo |
