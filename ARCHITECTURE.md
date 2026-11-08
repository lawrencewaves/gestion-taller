# ARCHITECTURE

Cómo está construido y desplegado el software. Los motivos de cada elección están en `DECISIONS.md`; el modelo de datos, en `DATABASE.md`.

## 1. Vista general

Una sola aplicación React se ejecuta en dos contenedores:

```
ESCRITORIO (TALLER)                          WEB (DEMO / PREVIEW)
┌──────────────────────────┐                ┌──────────────────────────┐
│ UI React                 │                │ UI React (mismo código)  │
│   ↓ interfaz Services    │                │   ↓ interfaz Services    │
│ LocalServices            │                │ RemoteServices (RPC)     │
│   ↓                      │                └────────────┬─────────────┘
│ core: casos de uso       │                             │ HTTPS
│   ↓                      │                ┌────────────▼─────────────┐
│ data: repositorios       │                │ API (función serverless) │
│   ↓ puerto SqlExecutor   │                │ LocalServices            │
│ Adaptador Tauri          │                │ core + data (mismo)      │
│   ↓ IPC                  │                │   ↓ puerto SqlExecutor   │
│ Rust: rusqlite           │                │ Adaptador libSQL         │
│   ↓                      │                │   ↓                      │
│ SQLite local             │                │ libSQL (base DEMO)       │
└──────────────────────────┘                └──────────────────────────┘
```

En escritorio la lógica se ejecuta en la propia aplicación. En la web se ejecuta en la API, nunca en el navegador, de modo que el navegador no toca la base de datos (regla: no usar SQLite desde el navegador).

## 2. Capas y reglas de dependencia

| Capa | Paquete | Contiene | Puede depender de |
|---|---|---|---|
| 1. Interfaz | `apps/ui` | Pantallas, componentes y estado de pantalla | `contracts` |
| 2. Lógica de negocio | `packages/core/domain` | Entidades, reglas, cálculo de importes, transiciones de estado | Nada |
| 3. Casos de uso | `packages/core/services` | Operaciones completas (emitir factura, aceptar presupuesto…) y permisos | `domain`, puertos |
| 4. Repositorios | `packages/data` | Lectura y escritura por entidad, migraciones SQL | Puerto `SqlExecutor` |
| 5. Adaptadores | `packages/adapters/*` | Implementaciones de los puertos para cada entorno | Plataforma (Tauri, libSQL, Node) |
| 6. Integraciones | `packages/adapters/fiscal-*`, `mail-*` | AEAT, email | Plataforma |

Reglas que se comprueban automáticamente en CI (lint de dependencias):

- `apps/ui` no importa `@tauri-apps/*`, `core`, `data` ni adaptadores. Solo conoce `contracts`.
- `core` y `data` no importan nada de plataforma.
- Solo `apps/desktop` y `apps/api` montan las piezas (composición).

## 3. Estructura del repositorio

```
apps/
  ui/          React + Vite. Una única interfaz para todos los entornos
  desktop/     Tauri 2: src-tauri (Rust) + composición local
  api/         API de la demo: RPC + autenticación + composición con libSQL
packages/
  contracts/   Interfaz Services, DTO y esquemas de validación (zod)
  core/        domain + services + puertos
  data/        Repositorios + migraciones SQL (un solo dialecto)
  adapters/
    sql-tauri/       SqlExecutor por IPC hacia Rust
    sql-libsql/      SqlExecutor para libSQL
    rpc-client/      Implementación remota genérica de Services
    fiscal-null/     No comunica con nadie (LOCAL, PREVIEW, DEMO)
    fiscal-aeat/     Comunicación real (se construye en la fase fiscal)
  pdf/         Plantillas PDF comunes
  seed/        Datos ficticios para DEMO, PREVIEW y LOCAL
```

Gestor de paquetes: pnpm con workspaces.

## 4. Puertos (interfaces que `core` necesita)

| Puerto | Escritorio | Web (API) |
|---|---|---|
| `SqlExecutor` (consulta, ejecución, transacción) | Rust/rusqlite por IPC | Cliente libSQL |
| `PasswordHasher` (Argon2id) | Rust | Node |
| `Clock`, `IdGenerator` (UUIDv7) | Comunes | Comunes |
| `FileStore` (adjuntos, PDF) | Carpeta de datos de la aplicación | Almacenamiento de la demo (límite de tamaño) |
| `BackupService` | Rust | No disponible |
| `FiscalGateway` | `fiscal-null` hasta la validación; después `fiscal-aeat` | Siempre `fiscal-null` |
| `Mailer` | Gmail del taller desde Rust, con la credencial en el Llavero (D-023) | Simulado: no envía, muestra el email que se habría enviado |
| `Capabilities` | Indica qué funciones existen en este entorno | Ídem |

La interfaz pregunta a `Capabilities` si una función está disponible. No comprueba el entorno por su cuenta.

## 5. Interfaz de servicios y RPC

- `contracts` define una interfaz `Services` agrupada por módulo (`customers.create`, `invoices.issue`…), con esquemas zod de entrada y salida.
- **Escritorio:** `LocalServices` llama directamente a los casos de uso de `core`.
- **Web:** `RemoteServices` es un proxy genérico. Cada llamada se convierte en `POST /api/rpc/<módulo>.<método>`. La API valida con el mismo esquema y ejecuta el mismo `LocalServices`.

Al añadir un método nuevo no se escribe código específico para la web.

## 6. Escritorio (Tauri 2)

- Rust expone solo comandos de bajo nivel: SQL, transacciones, hash de contraseñas, copias, ficheros y, más adelante, la comunicación fiscal con certificado.
- **Una conexión de escritura** SQLite en modo WAL, con claves foráneas activadas. Las transacciones interactivas se abren y cierran por identificador desde TypeScript.
- **Ubicación de datos:** carpeta de datos de la aplicación del usuario de macOS.
- **Arranque:**
  1. Comprobar integridad.
  2. Hacer una copia si hay migraciones pendientes.
  3. Aplicar las migraciones.
  4. Abrir la aplicación.
- **Sesión:** en memoria. Cierre automático por inactividad.

## 7. Copias de seguridad

```
SQLite ──Backup API──► temporal ──integrity_check──► cifrado ──► temporal cifrado
        ──movimiento atómico──► carpeta de Google Drive sincronizada
                               └► registro en tabla backups
```

- **Cifrado:** clave derivada de la contraseña de copias (Argon2id) y cifrado autenticado. La contraseña se guarda en el Llavero de macOS. Se entrega al titular una hoja impresa de recuperación, porque sin contraseña la copia es inútil.
- **Movimiento atómico** dentro del mismo volumen: Google Drive nunca ve un archivo a medias.
- **Disparadores:** diaria, tras operaciones importantes (agrupadas en una ventana de minutos), manual y al cerrar la aplicación si hay cambios.
- **Restauración:**
  1. Descifrar y verificar la copia.
  2. Copiar el estado actual.
  3. Cerrar la conexión.
  4. Sustituir el archivo.
  5. Reabrir y migrar.
- **Retención:** según RF-BAK-07, aplicada después de cada copia correcta.

## 8. Subsistema fiscal

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
- **Pendiente de verificar en la documentación oficial (Fase 4):** algoritmo y campos de la huella, formato y contenido del QR, servicio web y protocolo de la AEAT, certificado electrónico, firma de registros en NO VERI\*FACTU, reglas de subsanación y conservación, y el comportamiento exigido ante incidencias de conexión. **No se implementa nada de esto sin fuente oficial.**
- **Certificado del taller:** lo usa Rust desde el Llavero de macOS. Nunca pasa por TypeScript.

## 9. Entornos

| | LOCAL | PREVIEW | DEMO | TALLER |
|---|---|---|---|---|
| Para qué | Desarrollo | Revisar una rama | Enseñar al cliente versiones estables | Uso real |
| Origen | Equipo del desarrollador | Rama `feature/*` | Rama `main` | Etiqueta `vX.Y.Z` |
| Contenedor | Navegador o Tauri | Web | Web | Tauri en el Mac |
| Base de datos | SQLite o libSQL local | libSQL PREVIEW, reiniciada en cada despliegue | libSQL DEMO, reinicio diario y botón | SQLite local |
| Datos | Ficticios | Ficticios | Ficticios | Reales |
| Fiscal | Null | Null | Null | Null hasta validación; después AEAT |
| Marca visible | "LOCAL" | "PREVIEW" | "DEMO" | Ninguna |

Ninguna base de datos se comparte entre entornos. El entorno lo fija la compilación o el despliegue, no el usuario.

## 10. Publicación y despliegue

**Ramas:**
- `main` está protegida: solo admite cambios mediante pull request aprobada.
- Cada funcionalidad se desarrolla en `feature/<nombre>`.

**Web:**
- Cada push a `feature/*` genera un enlace PREVIEW único y compartible.
- Cada merge a `main` despliega DEMO.
- Alojamiento: Vercel o una alternativa gratuita que permita uso comercial (pendiente; ver `CURRENT_STATE.md`).

**Escritorio:**
- Una etiqueta `vX.Y.Z` en `main` lanza GitHub Actions, que compila el instalador universal de macOS y publica un GitHub Release con el manifiesto del actualizador.
- La aplicación del taller busca actualizaciones al arrancar y pide confirmación antes de instalarlas.

**Secretos:** se guardan solo en GitHub Actions y en el panel del alojamiento. Son la clave privada del actualizador, los tokens de libSQL y el secreto de sesión de la demo.
- Nunca usan el prefijo `VITE_`: todo lo que lo lleva acaba visible en el navegador.
- Plantilla de variables: `.env.example`, sin valores.

**Configuración paso a paso:** se documentará aquí al montarla en la Fase 4.

## 11. Autenticación

- **Escritorio:** usuarios locales con Argon2id, bloqueo tras intentos fallidos y permisos por rol comprobados en los casos de uso (no solo en la interfaz).
- **Demo:** mismo modelo de usuarios en la base DEMO. Cookie de sesión `httpOnly` y `secure`.
- **PREVIEW:** además, la protección del propio alojamiento.

## 12. Preparación multidispositivo (no se implementa en el MVP)

- UUIDv7 en lugar de autoincrementales: no hay colisiones entre dispositivos.
- `version` en cada fila para control de concurrencia optimista.
- `updated_at` y registro de actividad para trazar los cambios.
- La futura API central sería `apps/api` con otro `SqlExecutor`. La interfaz ya habla con `Services`, así que no cambiaría.
- Nunca se comparte el archivo SQLite por red.
