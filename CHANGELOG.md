# CHANGELOG

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/). Versionado semántico.

## [Sin publicar]

### Añadido
- Configuración: pestaña Usuarios (crear, editar, desactivar, poner contraseña nueva), permisos por rol para Recepción y Mecánico, y cierre por inactividad configurable. «Mi cuenta» para cambiar la propia contraseña.
- Configuración: pestaña Taller con los datos que salen en los documentos (titular, NIF, dirección, contacto, IBAN y logotipo), validados y con vista previa del encabezado.
- Actualizaciones firmadas: aviso al administrador e instalación con un clic. Canal de prueba y canal del taller (versiones `vX.Y.Z` publicadas como borrador hasta su aprobación). Versión instalada en el Diagnóstico.
- Esqueleto fiscal desactivado: reglas de emisión por entorno, pasarela de envío nula con barrera y estado fiscal en el Diagnóstico.
- Copias de seguridad cifradas a la carpeta de Google Drive: diaria automática, manual y a USB; retención de 30 días y 12 meses; aviso si no hay copia en 48 horas; clave en el Administrador de credenciales con hoja de recuperación; restauración con copia previa del estado actual; copia local antes de cada migración.
- Usuarios con roles, inicio de sesión, primer administrador, bloqueo por intentos, cierre por inactividad, permisos por rol y registro de actividad inalterable.
- Instalador de prueba para Windows (`.exe`), compilado junto al de macOS.
- App de escritorio para macOS (Tauri) con SQLite en Rust e instalador de prueba universal compilado en GitHub Actions.
- Base de datos real: migrador con verificación, primera migración (configuración, series, IVA, métodos de pago) y protección de entorno.
- Monorepo con pnpm: `core` (importes, IVA y matrículas), `contracts` (servicios y formatos), adaptador `worker-rpc`, `ui` y `web`.
- Interfaz base con el sistema visual: menú lateral, franja de entorno, Inicio y pantalla de Diagnóstico.
- SQLite en el navegador (Web Worker + OPFS) con prueba de persistencia, transacciones y claves foráneas.
- Comprobación automática (lint, tipos, pruebas) y publicación en GitHub Pages: DEMO desde `main`, PREVIEW por rama.
- Documentación inicial de arquitectura y requisitos (Fase 2).
- Demo en GitHub Pages, ejecutada en el navegador (D-024).

### Corregido
- Demo: algunas pantallas repetían peticiones sin parar porque el cliente del Worker devolvía un objeto nuevo en cada acceso.
