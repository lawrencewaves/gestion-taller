# DATABASE

Modelo de datos, convenciones y migraciones. El DDL definitivo vive en `packages/data/migrations/` (Fase 4). Este documento describe el modelo y se actualiza con cada migración.

## 1. Motor y dialecto

- **SQLite** en los dos contenedores: rusqlite en escritorio y SQLite WASM en la demo (D-024). Mismo motor, mismo esquema y mismas migraciones.
- **Prohibido** usar funciones de una versión de SQLite más nueva que la menor de las dos compilaciones. Esa versión mínima queda fijada en la Fase 4.
- Pragmas de escritorio: `journal_mode=WAL`, `foreign_keys=ON`, `busy_timeout`.

## 2. Convenciones

| Elemento | Convención |
|---|---|
| Tablas y columnas | `snake_case`, tablas en plural |
| Clave primaria | `id TEXT`, UUIDv7 |
| Dinero | `INTEGER` en céntimos (`*_cents`). Nunca decimales en coma flotante |
| Porcentajes | `INTEGER` en centésimas (21 % = `2100`) |
| Fechas y horas | `TEXT` ISO 8601 en UTC. Las fechas sin hora, como `YYYY-MM-DD` |
| Booleanos | `INTEGER` 0/1 |
| Auditoría por fila | `created_at`, `updated_at`, `created_by`, `version` (concurrencia optimista) |
| Archivado | `archived_at` solo en datos maestros. No se borran filas con documentos asociados |
| Copias en documentos | Las facturas y presupuestos guardan una copia de los datos del cliente y del emisor (`*_snapshot`, JSON) |
| Marca de entorno | `settings.environment` (`LOCAL`, `PREVIEW`, `DEMO`, `TALLER`) escrito al crear la base. Las facturas se marcan como DEMO a partir de él |

## 3. Modelo por dominio

### Configuración y seguridad
| Tabla | Contenido clave |
|---|---|
| `settings` | Fila única: datos del taller, entorno, modalidad fiscal y su estado, configuración de copias |
| `series` | Serie por tipo de documento: prefijo, año, último número |
| `tax_rates` | Nombre y porcentaje, activo |
| `payment_methods` | Nombre, activo, orden |
| `users` | Nombre, usuario, `password_hash`, rol, activo, intentos fallidos, bloqueado hasta |
| `role_permissions` | Rol y permiso (lista cerrada de permisos definida en `core`) |
| `activity_log` | Usuario, fecha, acción, tipo y id de entidad, cambios (JSON). Solo inserción |

### Clientes, vehículos y catálogo
| Tabla | Contenido clave |
|---|---|
| `customers` | Tipo (particular o empresa), nombre o razón social, NIF, teléfono, email, dirección, `is_walk_in` (cliente ocasional) |
| `vehicles` | `plate` y `plate_normalized` (única entre los no archivados), marca, modelo, bastidor, kilometraje, `customer_id` actual |
| `vehicle_owners` | Historial de titulares: vehículo, cliente, desde y hasta |
| `catalog_items` | Tipo (recambio, mano de obra, servicio), referencia, descripción, coste opcional, precio, impuesto |
| `attachments` | Entidad, nombre, tipo MIME, tamaño, hash, ruta en `FileStore` |

### Taller
| Tabla | Contenido clave |
|---|---|
| `appointments` | Cliente, vehículo, inicio, duración, motivo, observaciones, estado, orden de trabajo generada |
| `work_orders` | Número, serie, cliente, vehículo, entrada, kilometraje, motivo, averías, observaciones, mecánico, estado, cita y presupuesto de origen |
| `work_order_lines` | Trabajos y materiales: tipo, artículo de catálogo opcional, descripción, cantidad, precio, impuesto |
| `work_order_status_history` | Estado anterior, nuevo, usuario y fecha |
| `vehicle_inspections` | Recepción: orden, checklist (JSON), combustible, daños, observaciones |

### Presupuestos
| Tabla | Contenido clave |
|---|---|
| `quotes` | Número, `root_quote_id` y `revision` (versionado), cliente, vehículo, orden, validez, estado, totales |
| `quote_lines` | Como las líneas de orden, más descuento |
| `quote_decisions` | Presupuesto, decisión (aceptado o rechazado), fecha, usuario, método, firma (adjunto) |

### Facturación y cobros
| Tabla | Contenido clave |
|---|---|
| `invoices` | Estado (`draft` o `issued`), tipo (ordinaria o rectificativa), serie y número (solo al emitir), fecha de emisión, `rectifies_invoice_id`, copias de emisor y cliente, totales, estado de cobro, `is_demo` |
| `invoice_lines` | Descripción, cantidad, precio, descuento, impuesto, base |
| `invoice_tax_lines` | Desglose por tipo impositivo: base, cuota |
| `payments` | Factura, método, importe (negativo en devoluciones), fecha, usuario, `reverses_payment_id` |

### Fiscal
| Tabla | Contenido clave |
|---|---|
| `fiscal_records` | Factura, tipo de registro (alta o anulación), huella anterior, huella, contenido (JSON), versión de especificación, modalidad, fecha. **Solo inserción** |
| `fiscal_events` | Registro de eventos, si la modalidad lo exige. **Solo inserción** |
| `fiscal_submissions` | Registro, estado, intentos, siguiente intento, último error, respuesta de la AEAT |

Los campos exactos de `fiscal_records` y `fiscal_events` se fijan solo con la especificación oficial vigente (ARCHITECTURE §9).

### Operación
| Tabla | Contenido clave |
|---|---|
| `backups` | Fecha, tipo, destino, tamaño, suma de verificación, verificada, error |
| `schema_migrations` | Versión, nombre, suma de verificación, fecha de aplicación |

## 4. Integridad garantizada por la base de datos

No depende solo del código:

- **Triggers que impiden `UPDATE` y `DELETE`** en `fiscal_records`, `fiscal_events` y `activity_log`, y en `invoices` e `invoice_lines` cuando la factura está emitida.
- **Índice único** en `(series_id, number)` de facturas emitidas.
- **Claves foráneas** en todas las relaciones.
- **`CHECK`** sobre estados y tipos válidos.

## 5. Migraciones

- **Formato:** archivos SQL numerados (`0001_inicial.sql`, …). Son el único lugar donde cambia el esquema.
- **Solo hacia delante:** una migración publicada no se edita; se corrige con otra nueva.
- **Control:** cada migración se registra en `schema_migrations` con su suma de verificación. Si una migración aplicada no coincide, la aplicación se detiene.
- **Escritorio:** se aplican al arrancar, después de una copia automática.
- **Demo:** se aplican en el navegador al abrir una versión nueva. Si fallan, se ofrece restaurar los datos iniciales.
- **Pruebas:** cada migración se prueba sobre una copia de la base anterior con datos ficticios.

## 6. Datos ficticios (`packages/seed`)

- **Mismos datos en LOCAL, PREVIEW y DEMO:** unos 20 clientes, 30 vehículos, órdenes en todos los estados, presupuestos con versiones y facturas DEMO con cobros parciales.
- **Nombres, NIF, matrículas y teléfonos inventados,** con formato válido pero que no correspondan a personas reales conocidas.
- **El botón "Restaurar datos iniciales"** vacía las tablas de negocio y vuelve a cargar los datos ficticios. Solo existe si `settings.environment` no es `TALLER`.
