# DECISIONS

Registro de decisiones. Una decisión solo cambia con una nueva entrada que la sustituya.
Estado: **Vigente**, **Sustituida** (indica por cuál) o **A verificar** (vigente, pendiente de confirmación externa).

---

### D-001 · Software propio; Stall solo como referencia
2026-11-06 · Vigente
Diseño, pantallas y flujos propios. De Stall solo se toma el mapa funcional. No se copia código, recursos ni elementos visuales.

### D-002 · Aplicación instalada, licencia perpetua y coste cero
2026-11-06 · Vigente · Sustituye al modelo "web con datos reales en la nube" (descartado el mismo día)
El taller usa una aplicación instalada con datos locales. Sin servidor, sin suscripción.
**Motivo:** coste cero para todos y funcionamiento sin Internet.
**Consecuencia:** las copias externas son la única protección ante la pérdida del ordenador (ver D-013).

### D-003 · Mac primero; Windows opcional
2026-11-06 · Vigente
Instalador universal para Intel y Apple Silicon. El código no tendrá nada específico de macOS, de modo que Windows solo requeriría compilar otro instalador.

### D-004 · Stack
2026-11-04 · Vigente
Tauri 2 y Rust para escritorio, React + TypeScript + Vite para la interfaz, SQLite para los datos locales, GitHub para el código.

### D-005 · libSQL en lugar de PostgreSQL para la demo
2026-11-06 · Sustituida por D-024
**Motivo:** libSQL usa el mismo dialecto que SQLite. Hay un único esquema, unas únicas migraciones y unos únicos repositorios, y la demo prueba el mismo SQL que se ejecuta en el taller.
**Coste:** proveedor menos maduro que PostgreSQL. Si algún día hace falta un servidor central, se añade otro adaptador sin tocar la lógica.

### D-006 · La web es solo DEMO y PREVIEW
2026-11-06 · Vigente
Nunca contiene datos reales. Las facturas llevan la marca DEMO y no existe ningún adaptador que comunique con la AEAT en estos entornos.

### D-007 · Una única base de código con la lógica en `core`
2026-11-06 · Vigente; la parte web está sustituida por D-024
Las reglas de negocio viven solo en `packages/core`. La interfaz depende de una interfaz de servicios con dos implementaciones: local (escritorio) y remota (web), esta última mediante un RPC genérico hacia una API que ejecuta el mismo `core`. Detalle en `ARCHITECTURE.md`.

### D-008 · Acceso a SQLite mediante comandos Rust propios (rusqlite)
2026-11-06 · Vigente
Se descarta `tauri-plugin-sql`.
**Motivo:**
- Transacciones fiables con una única conexión de escritura.
- Acceso directo a la SQLite Backup API.
- Control de la verificación de integridad.

### D-009 · Entornos
2026-11-06 · Vigente; la base compartida de PREVIEW está sustituida por D-024
LOCAL, PREVIEW, DEMO y TALLER, aislados entre sí (tabla en `ARCHITECTURE.md`).
PREVIEW usa **una** base de datos compartida que se reinicia con datos ficticios en cada despliegue, en lugar de una por rama.
**Motivo:** sencillez y límites de los planes gratuitos.

### D-010 · Flujo de ramas y publicación
2026-11-06 · Vigente
- `feature/*` genera un enlace PREVIEW.
- `main` (solo mediante pull request aprobada) actualiza DEMO.
- Una etiqueta `vX.Y.Z` compila el instalador y publica la versión para el TALLER.

Nada llega al taller sin aprobación previa en DEMO.

### D-011 · Repositorio público, sin licencia abierta
2026-11-06 · Vigente
**Motivo:**
- Permite descargar actualizaciones sin credenciales.
- Las compilaciones de macOS en GitHub Actions son gratuitas en repositorios públicos.

**Consecuencias:**
- El código es visible para cualquiera. Sin fichero de licencia, sigue reservado a su autor.
- Ningún secreto se guarda en el repositorio: todos van a los secretos de GitHub y del alojamiento.

### D-012 · Actualizaciones
2026-11-06 · Vigente
Actualizador de Tauri desde GitHub Releases. Las actualizaciones van firmadas con la clave del actualizador, que es gratuita.
No se usa la firma ni notarización de Apple (de pago anual). macOS mostrará un aviso la primera vez que se abra la aplicación y habrá que autorizarla manualmente una sola vez.

### D-013 · Copias de seguridad
2026-11-06 · Vigente
1. La copia se genera con la SQLite Backup API.
2. Se verifica su integridad.
3. Se cifra.
4. Se mueve, ya completa, a la carpeta que Google Drive para escritorio sincroniza en el Mac (sin API ni credenciales de Google).

Además: copia manual a USB y política de retención. Detalle en `ARCHITECTURE.md`.

### D-014 · Arquitectura fiscal desde la versión 1, desactivada
2026-11-06 · Vigente
- La arquitectura de registros, encadenamiento, cola y adaptadores existe desde la primera versión.
- La modalidad (VERI\*FACTU o NO VERI\*FACTU) se decide cuando sea necesario.
- En TALLER, la emisión de facturas reales queda bloqueada hasta la validación fiscal; mientras tanto se factura con Stall.

### D-015 · El taller es autónomo
2026-11-06 · A verificar
Fecha de obligatoriedad VeriFactu vigente: 1 de julio de 2027 (RDL 15/2025). Se revisará si se publica el aplazamiento anunciado a octubre de 2028.

### D-016 · Productor del software
2026-11-06 · A verificar
Robert Lawrence Arasa Ribas figura como productor del sistema informático de facturación. Antes de activar el módulo fiscal hay que confirmar con un asesor sus obligaciones, como la declaración responsable.

### D-017 · Alcance del MVP
2026-11-06 · Vigente
Módulos de `REQUIREMENTS.md`, más recepción del vehículo, adjuntos, envío de PDF por email y exportación CSV.
Las "valoraciones" se resuelven como un presupuesto a un cliente ocasional, sin módulo propio.

### D-018 · Encargado del tratamiento (RGPD)
2026-11-06 · Vigente
Se firmará un contrato de encargado del tratamiento entre el taller y quien acceda a las copias compartidas.

### D-019 · Convenciones de datos
2026-11-06 · Vigente
Identificadores UUIDv7, importes en céntimos enteros y fechas ISO 8601 en UTC. Detalle en `DATABASE.md`.

### D-020 · Reorganización de fases
2026-11-06 · Vigente
- La web existe desde la Fase 4: la antigua Fase 6 "Demo online" se reparte entre las fases 4 y 5.
- La Fase 6 pasa a ser la validación con el taller.
- La validación fiscal se separa en una Fase 8 propia, con fecha límite el 1 de julio de 2027.

### D-021 · Sin firma en pantalla en el MVP
2026-11-08 · Vigente
El Mac del taller no es táctil. La autorización del presupuesto se registra con un documento impreso firmado (escaneado y adjunto) o con la conformidad del cliente anotada por el trabajador. La firma en pantalla queda para cuando haya tablet.

### D-022 · Sin facturas simplificadas
2026-11-08 · Vigente
Solo facturas completas (ordinarias y rectificativas). Simplifica las series y los registros fiscales.

### D-023 · Envío de emails por la cuenta de Gmail del taller
2026-11-08 · Vigente
El administrador conecta la cuenta de Gmail del taller en Configuración. Los envíos salen desde Rust; la credencial se guarda en el Llavero de macOS y nunca pasa por la interfaz ni por la base de datos.
**Método de conexión, a decidir en la Fase 5 con la documentación vigente de Google:**
- Contraseña de aplicación de Google y SMTP: es lo más sencillo, pero exige verificación en dos pasos en la cuenta.
- Inicio de sesión con Google (OAuth): es más cómodo para el usuario, pero exige un proyecto en Google Cloud y Google puede mostrar el aviso de "aplicación no verificada".

Ambos son gratuitos. En DEMO, PREVIEW y LOCAL los envíos se simulan.

### D-024 · Demo en GitHub Pages, ejecutada en el navegador
2026-11-08 · Vigente · Sustituye a D-005 y a la parte web de D-007 y D-009
La demo se publica en GitHub Pages: DEMO desde `main` y PREVIEW en una subcarpeta por rama. `core` y `data` se ejecutan en un Web Worker con SQLite compilado a WebAssembly, y los datos ficticios se guardan en el navegador de quien prueba.
**Excepción a una regla del proyecto:** se permite SQLite en el navegador **solo** en DEMO, PREVIEW y LOCAL, siempre con datos ficticios. La compilación TALLER no incluye este adaptador.
**Motivo:**
- Coste cero sin cuentas externas ni límites de uso.
- La demo ejecuta exactamente el mismo código y SQL que el Mac.
- Desaparecen la API, Turso y el adaptador remoto.

**Se descartan** Vercel Hobby (no admite uso comercial), Cloudflare Workers con Turso (más piezas y límite de CPU) y Netlify (créditos limitados).
**Consecuencias aceptadas:**
- Cada navegador tiene sus propios datos. El cliente envía lo que ha probado mediante la exportación de la demo (RF-DEM-06).
- La web es pública. El inicio de sesión de la demo solo sirve para probar los roles y no protege nada.
- GitHub Pages no crea enlaces por rama por sí mismo; los genera GitHub Actions.
**A verificar en la Fase 4:** almacenamiento OPFS sin cabeceras especiales en Safari y Chrome.

### D-025 · Nombre del software: Gonzalvo
2026-11-08 · Vigente
Se usa en la interfaz, en los PDF, en el instalador y como nombre de la aplicación en macOS. El repositorio conserva el nombre `gestion-taller`.

### D-026 · Una sola persona hace todo; todos los roles ven importes
2026-11-08 · Vigente
El titular es a la vez mecánico, recepción y administración, y trabaja con una cuenta de Administrador. La interfaz se diseña para una persona que hace todo el ciclo. Los roles Recepción y Mecánico se mantienen por si hay empleados, y por defecto ven importes y precios (incluido el coste).
