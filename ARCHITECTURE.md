# ARCHITECTURE

Cómo está construido y desplegado el software. Los motivos de cada elección están en `DECISIONS.md`; el modelo de datos, en `DATABASE.md`.

## 1. Vista general

Una sola aplicación React y una sola lógica de negocio se ejecutan en dos contenedores. Ninguno de los dos usa un servidor.

```
ESCRITORIO (TALLER)                          NAVEGADOR (DEMO / PREVIEW)
┌──────────────────────────┐                ┌──────────────────────────┐
│ UI React                 │                │ UI React (mismo código)  │
│   ↓ interfaz Services    │                │   ↓ interfaz Services    │
│ LocalServices            │                │ Proxy de mensajes        │
│   ↓                      │                ├──── postMessage ─────────┤
│ core: casos de uso       │                │ Web Worker:              │
│   ↓                      │                │  LocalServices           │
│ data: repositorios       │                │  core + data (mismo)     │
│   ↓ puerto SqlExecutor   │                │   ↓ puerto SqlExecutor   │
│ Adaptador Tauri ─IPC─►   │                │ Adaptador SQLite WASM    │
│ Rust: rusqlite           │                │   ↓                      │
│   ↓                      │                │ Almacenamiento del       │
│ SQLite (archivo local)   │                │ navegador (OPFS)         │
└──────────────────────────┘                └──────────────────────────┘
```

- **Escritorio:** la lógica se ejecuta en la aplicación y SQLite va en Rust.
- **Demo:** la lógica y SQLite (compilado a WebAssembly) se ejecutan en un Web Worker del navegador, para no bloquear la interfaz.
- **Los datos de la demo son ficticios y viven solo en el navegador de quien prueba.** Es la excepción aprobada en D-024 a la regla "no usar SQLite desde el navegador".

## 2. Capas y reglas de dependencia

| Capa | Paquete | Contiene | Puede depender de |
|---|---|---|---|
| 1. Interfaz | `apps/ui` | Pantallas, componentes y estado de pantalla | `contracts` |
| 2. Lógica de negocio | `packages/core/domain` | Entidades, reglas, cálculo de importes, transiciones de estado | Nada |
| 3. Casos de uso | `packages/core/services` | Operaciones completas (emitir factura, aceptar presupuesto…) y permisos | `domain`, puertos |
| 4. Repositorios | `packages/data` | Lectura y escritura por entidad, migraciones SQL | Puerto `SqlExecutor` |
| 5. Adaptadores | `packages/adapters/*` | Implementaciones de los puertos para cada entorno | Plataforma (Tauri, navegador) |
| 6. Integraciones | `packages/adapters/fiscal-*`, `mail-*` | AEAT, email | Plataforma |

Reglas que se comprueban automáticamente en CI (lint de dependencias):

- `apps/ui` no importa `@tauri-apps/*`, `core`, `data` ni adaptadores. Solo conoce `contracts`.
- `core` y `data` no importan nada de plataforma.
- Solo `apps/desktop` y `apps/web` montan las piezas (composición).
- El adaptador SQLite WASM solo puede importarse desde `apps/web`. Nunca forma parte de la compilación de escritorio.

## 3. Estructura del repositorio

```
apps/
  ui/          React + Vite. Una única interfaz para todos los entornos
  desktop/     Tauri 2: src-tauri (app Rust y crate db) + composición local
  web/         Composición del navegador: Web Worker + adaptadores web
packages/
  contracts/   Interfaz Services, DTO, esquemas de validación (zod) y formatos de pantalla y PDF
  core/        domain + services + puertos
  data/        Repositorios + migraciones SQL (un único esquema)
  adapters/
    tauri/           Escritorio: SqlExecutor por IPC hacia Rust y cifrado Argon2id
    browser/         Navegador: SqlExecutor con SQLite WASM y cifrado PBKDF2 (solo demo)
    worker-rpc/      Proxy genérico de Services sobre postMessage
    fiscal-null/     No comunica con nadie (LOCAL, PREVIEW, DEMO)
    fiscal-aeat/     Comunicación real (se construye en la fase fiscal)
  pdf/         Plantillas PDF comunes
  seed/        Datos ficticios para DEMO, PREVIEW y LOCAL
```

Gestor de paquetes: pnpm con workspaces.

## 4. Puertos (interfaces que `core` necesita)

| Puerto | Escritorio | Navegador (demo) |
|---|---|---|
| `SqlExecutor` (consulta, ejecución, transacción) | Rust/rusqlite por IPC | SQLite WASM en el Worker |
| `PasswordHasher` (Argon2id) | Rust | Argon2id en WASM o PBKDF2 nativo del navegador (se decide en la Fase 4) |
| `Clock`, `IdGenerator` (UUIDv7) | Comunes | Comunes |
| `FileStore` (adjuntos, PDF) | Carpeta de datos de la aplicación | Almacenamiento del navegador, con límite de tamaño |
| `BackupPort` (cifrado, archivos, clave, selector de carpeta) | Rust (`gonzalvo-backup`) | No existe: `createUnavailableBackupService` |
| `FiscalGateway` | `fiscal-null` hasta la validación; después `fiscal-aeat` | Siempre `fiscal-null` |
| `Mailer` | Gmail del taller desde Rust, con la credencial en el Llavero (D-023) | Simulado: no envía, muestra el email que se habría enviado |
| `Capabilities` | Indica qué funciones existen en este entorno | Ídem |

La interfaz pregunta a `Capabilities` si una función está disponible. No comprueba el entorno por su cuenta.

## 5. Interfaz de servicios

- `contracts` define una interfaz `Services` agrupada por módulo (`customers.create`, `invoices.issue`…), con esquemas zod de entrada y salida.
- **Escritorio:** `LocalServices` llama directamente a los casos de uso de `core`.
- **Navegador:** la interfaz habla con un proxy genérico. Cada llamada se envía al Worker por `postMessage`, se valida con el mismo esquema y se ejecuta en el mismo `LocalServices`.

Al añadir un método nuevo no se escribe código específico para la web.

## 6. Escritorio (Tauri 2)

- Rust expone solo comandos de bajo nivel: SQL, transacciones, hash de contraseñas, copias, ficheros, email y, más adelante, la comunicación fiscal con certificado. Crates: `gonzalvo-db`, `gonzalvo-password` y `gonzalvo-backup`.
- **Una conexión de escritura** SQLite en modo WAL, `synchronous = FULL` y claves foráneas activadas, en el crate `src-tauri/db` (`gonzalvo-db`). Comandos: `db_open`, `sql_all`, `sql_run`, `sql_exec`.
- **Transacciones:** las abre y cierra TypeScript (`BEGIN`/`COMMIT` por `sql_exec`) a través de `createSerialExecutor`, la misma cola que en el navegador. Como solo hay una conexión y la cola serializa, una transacción nunca se mezcla con otra operación.
- **Ubicación de datos:** `~/Library/Application Support/com.lawrencewaves.gonzalvo/` en Mac y `%APPDATA%\com.lawrencewaves.gonzalvo\` en Windows. `local.db` en las compilaciones de prueba (LOCAL) y `taller.db` en las versiones publicadas (TALLER). La base recuerda su entorno y no se abre con el otro (D-031).
- **Instalador:** `.github/workflows/escritorio.yml` compila en ordenadores de GitHub una app universal de Mac (Intel y Apple Silicon, firma ad hoc, D-012) y un instalador `.exe` de Windows sin firma (D-033). Se descarga como artefacto de la ejecución.
- **Arranque:**
  1. Abrir la base.
  2. Si hay migraciones pendientes y la base tiene datos, copia local previa.
  3. Aplicar las migraciones y comprobar el entorno.
  4. Abrir la aplicación y hacer la copia diaria si toca.
- **Sesión:** en memoria. Cierre automático por inactividad.

## 7. Navegador (demo)

- **Persistencia:** SQLite WASM con almacenamiento OPFS. Hay que usar la variante que no necesita cabeceras especiales del servidor (aislamiento entre orígenes), porque GitHub Pages no permite configurarlas. Si OPFS no está disponible, se trabaja en memoria y se avisa de que los datos no se guardarán. **Se verifica con una prueba real al inicio de la Fase 4.**
- **Aislamiento:** DEMO y todos los PREVIEW comparten dominio y, por tanto, almacenamiento del navegador. El archivo de base de datos lleva en el nombre el entorno y la rama (`demo.db`, `preview-<rama>.db`) para que no se mezclen.
- **Primera visita:** se crea la base, se aplican las migraciones y se cargan los datos ficticios.
- **Nueva versión:** se aplican las migraciones pendientes. Si fallan, se ofrece restaurar los datos iniciales.
- **Exportar e importar la demo:** el estado de la base se puede descargar como archivo. Así el cliente puede enviar a Robert lo que ha probado (RF-DEM-06).
- **Indexación:** la demo lleva `noindex` para que no aparezca en buscadores.

## 8. Copias de seguridad (solo escritorio)

```
SQLite ──Backup API──► temporal/copia.db ──integrity_check──► cifrado en <destino>/.gonzalvo-temporal/
        ──a disco y relectura──► renombrado atómico a <destino>/gonzalvo-<entorno>-<fecha>.gonzalvo
                              └► registro en tabla backups ──► retención
```

- **Reparto:** Rust (`gonzalvo-backup` y comandos `backup_*`) cifra, mueve y guarda la clave; `core` (`createBackupService`) decide cuándo copiar, qué conservar, cuándo avisar y si una copia se puede restaurar (D-038).
- **Cifrado:** formato `.gonzalvo` v1, Argon2id + XChaCha20-Poly1305 por bloques. La clave la genera Gonzalvo, se guarda en el Administrador de credenciales de Windows (Llavero en macOS) y se entrega una hoja de recuperación impresa, porque sin clave la copia es inútil.
- **Movimiento atómico** dentro del mismo volumen: Google Drive nunca ve un archivo a medias.
- **Disparadores:** diaria (al arrancar y cada hora se comprueba), manual y copia a USB. Tras operaciones importantes, con los módulos de facturación y cobros (Fase 5).
- **Restauración:**
  1. Descifrar y verificar la copia aparte.
  2. Comprobar entorno y versión (`core`).
  3. Copia local del estado actual (`copias-previas/`).
  4. Cerrar la conexión y descartar el WAL.
  5. Sustituir el archivo.
  6. Reabrir y migrar; volver a entrar.
- **Antes de migrar** una base con datos, copia local en `copias-previas/`.
- **Retención:** según RF-BAK-07, aplicada después de cada copia correcta.

## 9. Subsistema fiscal

Se aísla en su propio módulo de `core` para que activarlo no implique reconstruir la facturación.

```
invoices.issue ──► transacción única:
                    · asigna número (serie, sin huecos)
                    · congela la factura (inmutable)
                    · crea el registro fiscal: huella encadenada a la anterior
                    · encola el envío si la modalidad lo requiere
                 ──► FiscalGateway procesa la cola fuera de la transacción
```

- **Separación:** factura comercial (`invoices`) frente a registro fiscal (`fiscal_records`). Los registros solo admiten inserción; los triggers de la base de datos impiden modificarlos o borrarlos.
- **Modalidades:**
  - Desactivada: estado actual. En TALLER se bloquea la emisión real.
  - VERI\*FACTU.
  - NO VERI\*FACTU.

  Cada una es una estrategia: qué se genera (firma, eventos) y si hay envío.
- **Cola:** estados `pendiente → enviando → aceptado | aceptado con errores | rechazado`, con reintentos con espera creciente. Sin conexión, los registros esperan en la cola. Nada figura como remitido sin respuesta de aceptación.
- **Versionado:** cada registro guarda la versión de la especificación con la que se generó.
- **Pendiente de verificar en la documentación oficial (Fase 8):** algoritmo y campos de la huella, formato y contenido del QR, servicio web y protocolo de la AEAT, certificado electrónico, firma de registros en NO VERI\*FACTU, reglas de subsanación y conservación, y el comportamiento exigido ante incidencias de conexión. **No se implementa nada de esto sin fuente oficial.**
- **Certificado del taller:** lo usa Rust desde el Llavero de macOS. Nunca pasa por TypeScript.

## 10. Entornos

| | LOCAL | PREVIEW | DEMO | TALLER |
|---|---|---|---|---|
| Para qué | Desarrollo | Revisar una rama | Enseñar al cliente versiones estables | Uso real |
| Origen | Equipo del desarrollador | Rama `feature/*` | Rama `main` | Etiqueta `vX.Y.Z` |
| Contenedor | Navegador o Tauri | Navegador (GitHub Pages) | Navegador (GitHub Pages) | Tauri en el Mac |
| Dirección | localhost | `lawrencewaves.github.io/gestion-taller/preview/<rama>/` | `lawrencewaves.github.io/gestion-taller/` | — |
| Base de datos | SQLite (WASM o Rust) | SQLite WASM `preview-<rama>.db` en el navegador | SQLite WASM `demo.db` en el navegador | SQLite local |
| Datos | Ficticios | Ficticios | Ficticios | Reales |
| Fiscal | Null | Null | Null | Null hasta validación; después AEAT |
| Marca visible | "LOCAL" | "PREVIEW · <rama>" | "DEMO" | Ninguna |

El entorno lo fija la compilación, no el usuario. La compilación TALLER no incluye el adaptador WASM ni el botón de restaurar datos.

## 11. Publicación y despliegue

**Ramas:**
- `main` está protegida: solo admite cambios mediante pull request aprobada.
- Cada funcionalidad se desarrolla en `feature/<nombre>`.

**Web (GitHub Pages, publicado desde la rama `gh-pages` mediante GitHub Actions):**
- **Push a `feature/*`:** compila con la ruta base `/gestion-taller/preview/<rama>/` y la publica en esa subcarpeta. El enlace se añade como comentario en la pull request.
- **Merge a `main`:** compila y publica la raíz (DEMO) sin tocar `preview/`.
- **Rama borrada o pull request cerrada:** se elimina su subcarpeta.

**Escritorio:**
- Una etiqueta `vX.Y.Z` en `main` lanza GitHub Actions, que compila el instalador universal de macOS y publica un GitHub Release con el manifiesto del actualizador.
- La aplicación del taller busca actualizaciones al arrancar y pide confirmación antes de instalarlas.

**Secretos:** solo la clave privada del actualizador, guardada en los secretos de GitHub Actions. La demo no tiene secretos.
- Nunca se usa el prefijo `VITE_` para nada sensible: todo lo que lo lleva acaba visible en el navegador.
- Plantilla de variables: `.env.example`, sin valores.

**Configuración (hecha una vez):**
1. GitHub → Settings → Pages → *Build and deployment*: «Deploy from a branch», rama `gh-pages`, carpeta `/ (root)`.
2. GitHub → Settings → Branches: `main` protegida, solo mediante pull request (D-010).
3. No hay secretos para la web. El workflow usa el `GITHUB_TOKEN` del propio repositorio con permiso `contents: write`.

**Cómo funciona:** `.github/workflows/publicar.yml` comprueba (lint, tipos, pruebas) y, si todo pasa, compila y escribe en la rama `gh-pages`: la raíz para DEMO y `preview/<rama>/` para PREVIEW. Las publicaciones van de una en una. `.github/workflows/limpiar-preview.yml` borra la carpeta cuando se elimina la rama. El enlace de cada publicación aparece en el resumen de la ejecución en la pestaña Actions.

## 12. Autenticación

- **Escritorio:** usuarios locales con Argon2id, bloqueo tras intentos fallidos y permisos por rol comprobados en los casos de uso (no solo en la interfaz).
- **Demo:** mismo flujo de inicio de sesión con usuarios de prueba de cada rol, para probar los permisos. **No es una protección real:** la web es pública y los datos son ficticios (D-024).

## 13. Preparación multidispositivo (no se implementa en el MVP)

- UUIDv7 en lugar de autoincrementales: no hay colisiones entre dispositivos.
- `version` en cada fila para control de concurrencia optimista.
- `updated_at` y registro de actividad para trazar los cambios.
- Una futura API central ejecutaría el mismo `LocalServices` con otro `SqlExecutor`, y la interfaz usaría un proxy por HTTP en lugar de por `postMessage`. La interfaz de usuario no cambiaría.
- Nunca se comparte el archivo SQLite por red.
