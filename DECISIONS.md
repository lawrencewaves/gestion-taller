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

### D-027 · Sistema visual y logotipo
2026-11-09 · Vigente
- **Dirección:** fondo claro y grises neutros, grafito como único color de acción, amarillo de taller (`signal`) como marca, Archivo para la interfaz e IBM Plex Mono para bastidores y referencias.
- **Logotipo:** cuadrado amarillo con la G y el nombre GONZALVO en mayúsculas espaciadas. Archivos en `design/marca/`.
- **Referencia viva:** el sistema visual «Gonzalvo» (artifact privado de Robert) contiene los colores, tipos, espacios, radios, reglas de uso y logotipos. Es la fuente de los tokens de la Fase 4.
- **Los documentos emitidos** (presupuestos, facturas, justificantes) llevan el logotipo y los datos del taller, nunca el de Gonzalvo.

### D-028 · Componentes base e iconos Lucide
2026-11-09 · Vigente
- **Componentes de referencia en el sistema visual:** Button, TextField, Select, StatusBadge, Plate, DataTable, Tabs, SidePanel, NavMenu, EnvBanner, Logo e Icon, con funciones de formato (`formatEUR`, `formatKm`, `formatDate`, `formatPlate`). En la Fase 4 se reimplementan en `apps/ui` con TypeScript a partir de estos y de `design/tokens.json`.
- **Iconos: Lucide (licencia ISC).** Juego abierto, de línea, completo para un taller y sin coste. Se incluye solo el subconjunto usado, con su aviso de licencia.
- **Estados:** cada estado de orden, presupuesto, factura, cobro y cita tiene una clave fija y una familia de color (UX §6).

### D-029 · Cierre de la Fase 3
2026-11-09 · Vigente
Robert aprueba la navegación, el sistema visual, el logotipo, los componentes y los prototipos. La validación con el titular del taller no bloquea la Fase 4: se hará sobre la DEMO, módulo a módulo, en la Fase 5.

### D-030 · Base técnica de la Fase 4
2026-11-09 · Vigente
- **Herramientas:** pnpm (workspaces), TypeScript estricto, Vite 6, React 18, Vitest, ESLint con reglas que impiden saltarse las capas (ARCHITECTURE §2). Versiones fijadas y publicadas hace al menos dos semanas.
- **Formatos compartidos** (`formatEUR`, `formatKm`, `formatDate`, `formatPlate`) en `contracts`: la interfaz no puede importar `core` y los PDF necesitan los mismos formatos.
- **Fuentes incluidas en la aplicación** (Fontsource) en lugar de Google Fonts: funcionan sin Internet en el Mac y no envían peticiones a terceros.
- **Iconos:** `lucide-react`, mismo juego que el sistema visual (D-028).
- **Rutas con almohadilla** (`#/clientes`): funcionan en GitHub Pages y en Tauri sin servidor.
- **Publicación propia en `gh-pages`** con un guion en el workflow, sin acciones de terceros: la DEMO sustituye la raíz y cada PREVIEW su carpeta.
- **Prueba técnica de D-024:** correcta en Chromium (persistencia, transacciones, claves foráneas). Falta confirmarla en Safari en el Mac.

### D-031 · Base de datos: migrador, apertura y adaptador del navegador
2026-11-10 · Vigente
- **Prueba técnica de D-024 confirmada** por Robert en Chrome en su Mac: la demo guarda los datos. Safari queda sin probar; solo afecta a quien abra la demo con Safari.
- **Migraciones por módulo**, cada una en su transacción, con suma SHA-256: el programa se detiene si una migración aplicada cambia o si la base es más nueva que el programa.
- **Protección de entorno:** la base guarda su entorno al crearse y se niega a abrirse con otro (DEMO frente a TALLER).
- **Tablas `STRICT`** y restricciones `CHECK`: la base rechaza datos mal tipados aunque el código falle.
- **Adaptador del navegador con cola:** una sola conexión, operaciones en serie, transacciones anidadas con SAVEPOINT.
- **Pruebas con el mismo motor que la demo** (SQLite WASM en Node), no con un sustituto.
- **Datos de referencia con identificadores fijos** (tipos de IVA y métodos de pago), iguales en todas las instalaciones.

### D-032 · App de escritorio de prueba
2026-11-10 · Vigente
- **Lógica compartida:** la cola de operaciones y transacciones (`createSerialExecutor`) y el diagnóstico viven en `core` y los usan igual el navegador y el Mac. Cada adaptador solo sabe ejecutar SQL.
- **Rust mínimo:** el crate `gonzalvo-db` (rusqlite con SQLite incluido) ejecuta SQL con parámetros JSON. Tiene sus propias pruebas, que se ejecutan en cada comprobación.
- **Compilaciones de prueba en entorno LOCAL** (`local.db`, franja «LOCAL · Pruebas · Datos ficticios»). Solo una versión con etiqueta se compilará como TALLER (`taller.db`), cuando haya actualizador (paso 10). Así los datos de prueba nunca acaban en la base del taller.
- **Instalador:** app universal con firma ad hoc (`signingIdentity: "-"`), compilada en GitHub Actions. macOS pide autorizarla una vez en Ajustes del Sistema (D-012).
- **Nombre interno:** `com.lawrencewaves.gonzalvo`. Cambiarlo más adelante movería la carpeta de datos, así que se mantiene.

### D-033 · Instalador también para Windows
2026-11-10 · Vigente · Amplía D-003
Robert pide la versión de Windows. Se compila junto a la de Mac, con el mismo código.
- **Instalador:** `.exe` (NSIS) en español, instalación para el usuario actual sin permisos de administrador. Windows 10 y 11 de 64 bits; usa WebView2, que ya viene con Windows.
- **Sin firma de código** (certificado de pago): Windows SmartScreen avisará la primera vez; se abre con «Más información → Ejecutar de todas formas».
- **Datos:** `%APPDATA%\com.lawrencewaves.gonzalvo\` (`local.db` en pruebas, `taller.db` en el taller).
- **Saltos de línea LF en todo el repositorio** (`.gitattributes`): las migraciones son idénticas en ambos sistemas.
- **Pendiente según el ordenador del taller:** la contraseña de las copias usará el Llavero en Mac y el Administrador de credenciales en Windows (paso 8).

### D-034 · Windows primero; Mac en pausa
2026-11-10 · Vigente · Sustituye a D-003 en el orden de plataformas
Robert pide seguir solo con Windows por ahora. Se compila y prueba únicamente el instalador de Windows. El código sigue sin nada específico de un sistema y la configuración de macOS se conserva (comentario en `escritorio.yml`), así que reactivarla es añadir una entrada.
- **Descarga directa de pruebas:** cada compilación publica `Gonzalvo-prueba-windows.zip` en la publicación fija `prueba-windows` (prerelease) del repositorio, descargable sin iniciar sesión. Las versiones del taller tendrán sus propias publicaciones `vX.Y.Z` (paso 10).
- **Pendiente:** la contraseña de las copias irá en el Administrador de credenciales de Windows (paso 8).

### D-035 · Importar la base de datos de Stall
2026-11-10 · Vigente
El titular ya tiene su historial en Stall y debe poder llevárselo entero a Gonzalvo (REQUIREMENTS §16 bis).
- **Fuente:** lo que Stall permita sacar. Según su web, ofrece copias de seguridad descargables y exportación a Excel; el formato real se comprueba con un archivo de muestra antes de diseñar las tablas de los módulos.
- **Las tablas se diseñan ya pensando en la importación:** cada registro importado guarda `source_system` y `source_id` para poder repetir la importación sin duplicar.
- **Facturas de Stall = históricas:** se conservan tal cual, en solo lectura y fuera de la cadena fiscal de Gonzalvo. Gonzalvo empieza su propia numeración y su propio registro fiscal (D-014).
- **Privacidad (RGPD):** la importación se hace en el programa instalado del taller. Para desarrollarla basta con la estructura de los archivos (columnas) y filas de ejemplo inventadas; ningún dato real entra en el repositorio, la demo ni las pruebas.
- **Orden:** el importador se construye después de los módulos de datos y antes de la validación con el taller (ROADMAP, Fase 5).

### D-036 · Instalador de Windows verificado
2026-11-10 · Vigente
Robert instala la versión de prueba en Windows: arranca, el Diagnóstico da todo correcto y el contador de aperturas sube al cerrar y abrir. El paso 6 de la Fase 4 queda validado en Windows.

### D-037 · Usuarios, inicio de sesión y permisos
2026-11-10 · Vigente
- **Sesión local en memoria:** vive en el programa (escritorio) o en el Worker de cada pestaña (demo). Cerrar el programa la cierra. Cierre automático tras 30 minutos sin actividad; se hará configurable en el módulo Configuración.
- **Primer arranque del programa instalado:** pide crear el usuario administrador. No hay usuarios ni contraseñas por defecto.
- **Demo:** tres usuarios de prueba (admin, recepcion, mecanico) con contraseña pública «gonzalvo», visible en la pantalla de entrada (RF-DEM-01: no es una protección real).
- **Contraseñas:** al menos 8 caracteres y distinta del usuario; longitud antes que símbolos, según las guías actuales. Escritorio: Argon2id en Rust (19 MiB, 2 pasadas, crate `gonzalvo-password`); demo: PBKDF2-SHA256 del navegador con 600.000 iteraciones, sin dependencias. Cada valor guardado incluye su algoritmo y parámetros.
- **Bloqueo:** 5 intentos fallidos bloquean el usuario 15 minutos. El mensaje no revela si el usuario existe.
- **Permisos:** lista cerrada en `contracts`; los iniciales por rol se cargan con la migración 0002 según UX §3. Los servicios los comprueban con `requirePermission`; la interfaz solo oculta lo que no se puede usar.
- **Registro de actividad:** entradas, salidas, fallos, bloqueos y alta de usuarios. La base de datos impide modificarlo o borrarlo, y los usuarios no se borran: se desactivan.
- **Adaptadores por plataforma:** `adapter-browser` (SQLite WASM y PBKDF2) y `adapter-tauri` (SQLite y Argon2id en Rust) sustituyen a `adapter-sql-wasm` y `adapter-sql-tauri`.
- **La gestión de usuarios** (crear, desactivar, cambiar rol y contraseña) se hará en el módulo Configuración (Fase 5).

### D-038 · Copias de seguridad cifradas y restauración
2026-11-10 · Vigente · Concreta D-013 y sustituye en ARCHITECTURE §8 la «contraseña de copias» por una clave generada
- **Clave de recuperación generada por Gonzalvo**, no elegida: 25 letras y números (125 bits) en 5 grupos, sin letras que se confundan. No se teclea nunca en el día a día: se guarda en el Administrador de credenciales de Windows (Llavero en macOS), una por base (`copias-taller`, `copias-local`), y se muestra una vez para apuntarla o imprimir la **hoja de recuperación**. Se puede volver a ver desde Copias.
- **Formato `.gonzalvo` v1:** Argon2id (los mismos parámetros que las contraseñas, guardados en cada copia) y XChaCha20-Poly1305 en modo STREAM por bloques de 64 KiB, con la cabecera autenticada. Detecta clave equivocada, cambios y archivos cortados. Detalle en `apps/desktop/src-tauri/backup/src/lib.rs`.
- **Cómo se hace:** Backup API de SQLite (incluye lo que está en el WAL; se niega si hay una transacción abierta) → `integrity_check` y `foreign_key_check` → cifrado en `.gonzalvo-temporal/` dentro del destino → forzado a disco → se vuelve a leer y descifrar entera → se renombra a su nombre definitivo. Google Drive nunca ve una copia a medias ni en claro. Se anota en la tabla `backups` (migración 0003, sin modificaciones ni borrados).
- **Nombre:** `gonzalvo-<entorno>-<fecha UTC>.gonzalvo`. Las copias de pruebas y las del taller pueden compartir carpeta sin mezclarse.
- **Carpeta:** la elige el titular con el selector de Windows. Es la carpeta compartida que sincroniza Google Drive para escritorio, sin API ni credenciales de Google (D-013).
- **Cuándo:** al arrancar y cada hora se mira si ya hay copia correcta hoy; si no, se hace (diaria). Además, manual y copia a USB o disco externo (a otra carpeta, no entra en la retención ni en el aviso). **Pendiente:** la copia tras emitir factura o registrar cobro llegará con esos módulos (Fase 5); la copia al cerrar el programa, más adelante si hace falta.
- **Retención:** la última de cada día de los últimos 30 días y la última de cada mes de los últimos 12 meses; la más reciente nunca se borra. Se hará configurable en Configuración (Fase 5).
- **Aviso:** sin copia correcta en 48 horas, franja en todas las pantallas para quien puede arreglarlo (`config.manage`).
- **Restaurar:** se descifra y comprueba aparte; `core` rechaza copias de otro entorno o de una versión más nueva; se guarda una copia local del estado actual (`copias-previas/`, las 5 últimas); se cierra la base, se descarta su WAL, se sustituye el archivo, se reabre y migra, se anota en el registro de la base restaurada y hay que volver a entrar.
- **Antes de migrar** una base con datos, copia local en `copias-previas/` (RNF-08).
- **En otro ordenador:** instalar, crear un administrador, elegir la carpeta de Drive, escribir la clave (solo se acepta si abre la copia más reciente, para evitar erratas) y restaurar.
- **Solo el administrador** (`config.manage`). En la demo la pantalla explica que las copias solo existen en el programa instalado (RF-DEM-05).
- **Dependencias nuevas (Rust):** `chacha20poly1305` 0.10.1 y `sha2` 0.10.9 (RustCrypto, misma base que el `argon2` 0.5.3 ya usado), `keyring` 3.6.3 (solo los almacenes nativos de Windows y macOS) y `tauri-plugin-dialog` 2.8.4 (oficial; se usa solo desde Rust y la ventana no recibe permisos de diálogo).

### D-039 · Calendario VeriFactu verificado (10/11/2026)
2026-11-10 · Vigente · Actualiza D-015
- **Norma vigente:** Real Decreto-ley 15/2025 (BOE de 3/12/2025, convalidado), que modifica la disposición final cuarta del Real Decreto 1007/2023. Para el taller (autónomo, «resto de obligados»), los sistemas de facturación deben estar adaptados **antes del 1 de julio de 2027**. Sociedades: antes del 1 de enero de 2027.
- **Anunciado, sin publicar:** el 5/10/2026 Hacienda comunicó la previsión de ampliar el plazo a octubre de 2028. A fecha de hoy no hay norma en el BOE; la sede de la AEAT solo enlaza la comunicación y la nota informativa. Se planifica con la fecha vigente y se revisa al empezar la Fase 8.
- **Especificaciones técnicas:** Orden HAC/1177/2024 (BOE de 28/10/2024) y la sección «Información técnica» de la sede de la AEAT. Se consultarán en su versión vigente al empezar la Fase 8; no se copian aquí para no fijar una versión que puede cambiar.
- **Consecuencia:** el taller sigue facturando con Stall hasta que Gonzalvo supere la Fase 8 (D-014).

### D-040 · Esqueleto fiscal desactivado (paso 9 de la Fase 4)
2026-11-10 · Vigente · Concreta D-014
- **Qué existe ya**, sin nada que dependa de la especificación técnica:
  - `fiscalPolicy(entorno, modalidad)`: fuera de TALLER se puede emitir, siempre simulado (DEMO) y sin hablar nunca con la AEAT (RF-FIS-10). En TALLER no se emite mientras la modalidad esté desactivada o `FISCAL_MODULE_READY` sea falso (hasta la Fase 8). `assertCanIssue` la aplicará el caso de uso de emitir factura.
  - Puerto `FiscalGateway`, pasarela nula y `guardFiscalGateway`: cualquier pasarela se monta a través de esa barrera, que la sustituye por la nula si no se permite hablar con la AEAT.
  - El Diagnóstico muestra la modalidad y lo que permite.
- **Tablas fiscales** (`fiscal_records`, `fiscal_events`, `fiscal_submissions`) con sus triggers de solo inserción: se crean en la misma migración que `invoices` (Fase 5, Facturación). Crearlas ahora obligaría a reconstruirlas para añadir la clave foránea a `invoices`, que SQLite no permite añadir después.
- **Sin CSP en la web:** en GitHub Pages solo puede ponerse como `<meta>`, que no se aplica al Web Worker donde corre la lógica. La protección real es estructural: la pasarela de la AEAT necesitará el certificado del taller y vivirá solo en Rust; la web no la incluye. El escritorio ya limita la red de la ventana a IPC (`connect-src ipc:`).

### D-041 · Actualizador y versiones del taller (paso 10 de la Fase 4)
2026-11-10 · Vigente · Concreta D-012 y D-034
- **`tauri-plugin-updater` 2.14.1** (oficial), usado solo desde Rust con dos comandos (`update_check`, `update_install`). La ventana sigue sin acceso a la red. Cada actualización se descarga, se comprueba su firma con la clave pública incluida en el programa y se instala con el instalador de Windows en modo pasivo; Gonzalvo se cierra y vuelve a abrirse.
- **Dos canales, fijados al compilar:**
  - **Prueba** (`VITE_ENV=LOCAL`): cada push a una rama compila la versión `<base>-prueba.<n>` y la publica en `prueba-windows` con su `latest.json`. Los instaladores de prueba se actualizan solos con la última compilación.
  - **Taller** (`VITE_ENV=TALLER`): solo desde una etiqueta `vX.Y.Z` que coincida con `tauri.conf.json` y con una sección `## [X.Y.Z]` en `CHANGELOG.md` (sus novedades son las notas de la actualización). Se crea como **borrador**; llega al taller cuando Robert pulsa «Publish release». El programa del taller consulta `releases/latest`, que ignora borradores y prepublicaciones.
- **Quién la ve:** al entrar, quien tiene `config.manage` ve el aviso «Hay una versión nueva» con «Instalar y reiniciar». Sin conexión no se muestra nada. La versión instalada aparece en el Diagnóstico.
- **Datos:** la actualización no toca la base; al abrir la versión nueva, si cambia el esquema, se hace antes la copia local (D-038).
- **Clave de firma:** par minisign generado para el proyecto. La pública va en `tauri.conf.json`; la privada y su contraseña solo existen como secretos del repositorio (`TAURI_SIGNING_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`) y en la copia que guarda Robert fuera del repositorio. Si se perdiera, los programas instalados no aceptarían versiones firmadas con otra clave: habría que reinstalar a mano una vez.
- **Sin secretos** se compila igual, pero sin actualizaciones; una etiqueta `vX.Y.Z` sin secretos falla a propósito.
- Las instalaciones anteriores a este paso no tienen actualizador: hay que instalar a mano una vez la versión nueva.

### D-042 · Falso positivo de Defender y firma de código
2026-11-11 · Vigente · Condiciona la Fase 7
- **Hecho:** Microsoft Defender detectó `Trojan:Win32/Bearfoos.A!ml` en el programa instalado (`%LOCALAPPDATA%\Gonzalvo\gonzalvo.exe`, versión de prueba con actualizador) y lo puso en cuarentena. Los datos, en `%APPDATA%\com.lawrencewaves.gonzalvo`, no se tocaron. VirusTotal no detecta nada: es una detección por aprendizaje automático (`!ml`) de un programa sin firmar, habitual en programas nuevos.
- **Pruebas mientras tanto:** en el ordenador de Robert, restaurar desde el historial de protección y excluir solo la carpeta del programa. Nunca se desactiva Defender ni se excluye nada en el ordenador del taller.
- **Solución:** firmar el instalador y el programa con un certificado **Certum Open Source Code Signing** (49 €) a nombre de Robert, cuando el taller acepte el sistema. Requisito: publicar el código con una licencia de código abierto, que sustituirá a D-011; la licencia concreta se decidirá entonces.
- **Hasta que esté firmado no se instala en el taller.** La firma pasa a ser requisito de la Fase 7. Habrá que comprobar entonces si la firma con SimplySign puede ir en GitHub Actions o se hace a mano en cada versión del taller.
- Descartados: Azure Artifact Signing (no admite personas físicas de la UE), SignPath (exige reputación previa) y Certum Standard (209 €).

### D-043 · Cierre de la Fase 4
2026-11-11 · Vigente
Robert verifica en Windows la actualización automática: de `0.1.0-prueba.13`, instalada a mano, a `0.1.0-prueba.16`, con un clic. Se cumple el criterio de salida: la aplicación funciona en PREVIEW, en DEMO y como instalador de prueba en Windows, con base de datos, usuarios, copias, esqueleto fiscal y actualizador. Pendiente heredado, que no bloquea la Fase 5: firma de código antes de instalar en el taller (D-042).

### D-044 · Configuración, primera entrega: datos del taller
2026-11-11 · Vigente
- **Pantalla Configuración** con pestañas Taller, Usuarios, Facturación y Fiscal. Esta entrega hace la de **Taller** (RF-CFG-01). Las demás llegan en las siguientes.
- **Validación en `core`** (`domain/identity.ts`): NIF de personas, NIE, NIF de entidades y especiales K/L/M con su control; IBAN con el módulo 97 (24 caracteres los españoles); código postal 01–52. Son obligatorios los datos que exige la factura: titular o razón social, NIF, dirección, código postal y población. Teléfono, email e IBAN, si se rellenan, deben ser correctos.
- **Se normaliza al guardar:** NIF en mayúsculas y sin separadores, IBAN agrupado de cuatro en cuatro, email en minúsculas y espacios sobrantes fuera. La **provincia se deduce del código postal**: no se escribe.
- **Logotipo** PNG o JPEG, reducido por la interfaz a 512 px como máximo y guardado en la base como `data:` URL de hasta 300 KB (migración 0004). Viaja con las copias de seguridad. SVG no se admite, porque puede llevar código.
- **Patrón de formularios:** el servicio devuelve `SaveResult` (`ok` con el valor guardado, o errores por campo). Las reglas siguen en `core` y los errores cruzan el Worker de la demo, que solo transmite texto.
- **Concurrencia optimista:** se guarda solo si la `version` no ha cambiado desde que se abrió el formulario; si otra persona guardó antes, se avisa y no se pisa nada.
- **Registro de actividad:** qué campos cambiaron, sin repetir sus valores.
- **Consulta y edición:** cualquier usuario con sesión puede leer los datos del taller (los documentos los necesitan); solo `config.manage` los cambia.
- **Demo:** taller ficticio con NIF `00000000T` (válido de formato, no asignado a nadie) y email `demo@example.com`.
- **Corrección:** el cliente RPC de la demo devolvía un objeto nuevo en cada acceso a un servicio. Las pantallas que lo usan como dependencia (Copias y los avisos de copias y de actualizaciones) repetían peticiones sin parar en la demo. Ahora el objeto de cada servicio y método es siempre el mismo.

### D-045 · Configuración, segunda entrega: usuarios y permisos
2026-11-11 · Vigente
- **Pestaña Usuarios** (RF-USR-03), con `users.manage`: lista con rol, estado (activo, desactivado o bloqueado) y última entrada; crear, editar nombre, rol y estado, y poner una contraseña nueva, que además desbloquea al usuario.
- **Nunca queda el taller sin administrador:** siempre hay al menos uno activo, nadie se desactiva ni se quita el rol de administrador a sí mismo, y el administrador no se pone una contraseña nueva desde aquí (para eso está «Mi cuenta»).
- **Permisos por rol:** el administrador tiene siempre todos y no se edita. Recepción y Mecánico se ajustan solo en los permisos de módulos (`PERMISSION_GROUPS`); Configuración, usuarios, registro de actividad y diagnóstico son solo del administrador. `core` mantiene la coherencia: quien edita también ve, y emitir facturas o devolver cobros exige poder editar. Los cambios se aplican en la siguiente entrada de cada persona.
- **Cierre por inactividad configurable** (RF-USR-05): entre 5 y 480 minutos, 30 por defecto (migración 0005). Viaja en la sesión y se aplica desde la siguiente entrada. Cambiarlo no sube la versión de `settings`, para no chocar con quien edite los datos del taller a la vez.
- **«Mi cuenta»**, junto a «Cerrar sesión», para todos los roles: ver usuario y rol, y cambiar la propia contraseña sabiendo la actual.
- **Registro de actividad:** altas, cambios (qué campos), contraseñas puestas o cambiadas, permisos añadidos y quitados, y cambios del tiempo de inactividad.
- **Demo:** el taller ficticio lleva el IBAN de ejemplo del estándar (`ES91 2100 0418 4502 0005 1332`), con control correcto y que no es una cuenta real.
