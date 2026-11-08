# REQUIREMENTS

Qué debe hacer el software. Cada requisito tiene un identificador para referenciarlo en pruebas y commits.
Prefijos: `RF` funcional, `RNF` no funcional. Un requisito solo cambia si una decisión de `DECISIONS.md` lo respalda.

## 1. Transversales

| ID | Requisito |
|---|---|
| RF-GEN-01 | Toda operación de alta, edición, cambio de estado o borrado queda en el registro de actividad (usuario, fecha, entidad, cambio). |
| RF-GEN-02 | Búsqueda rápida global por matrícula, cliente, teléfono, NIF y número de documento. |
| RF-GEN-03 | Los datos maestros (clientes, vehículos, catálogo) se archivan en lugar de borrarse si tienen documentos asociados. |
| RF-GEN-04 | Exportación CSV de listados: clientes, vehículos, facturas y cobros. |
| RF-GEN-05 | Envío de cualquier PDF por email al cliente desde la cuenta de Gmail del taller, conectada en Configuración (D-023). Si no está conectada, la opción se muestra desactivada con un enlace a Configuración. |

## 2. Usuarios y permisos

| ID | Requisito |
|---|---|
| RF-USR-01 | Cuenta individual con usuario y contraseña segura. |
| RF-USR-02 | Roles iniciales: Administrador, Recepción y Mecánico. |
| RF-USR-03 | El administrador crea, desactiva y edita usuarios y ajusta los permisos de cada rol. |
| RF-USR-04 | Bloqueo temporal tras varios intentos fallidos de acceso. |
| RF-USR-05 | Cierre de sesión por inactividad configurable. |

## 3. Inicio

| ID | Requisito |
|---|---|
| RF-INI-01 | Contadores de órdenes pendientes, vehículos en reparación, trabajos terminados, presupuestos pendientes y facturas pendientes de cobro. |
| RF-INI-02 | Próximas citas y actividad reciente. |
| RF-INI-03 | Cada contador abre el listado filtrado correspondiente. Sin gráficos decorativos. |

## 4. Clientes

| ID | Requisito |
|---|---|
| RF-CLI-01 | Alta y edición: nombre o razón social, NIF, teléfono, email y dirección. |
| RF-CLI-02 | Validación de formato del NIF/NIE/CIF (aviso, no bloqueo, salvo al facturar). |
| RF-CLI-03 | Historial: vehículos, órdenes, presupuestos, facturas y cobros. |
| RF-CLI-04 | "Cliente ocasional" para presupuestos rápidos sin dar de alta al cliente. |

## 5. Vehículos

| ID | Requisito |
|---|---|
| RF-VEH-01 | Matrícula, marca, modelo, bastidor y kilometraje. |
| RF-VEH-02 | Un cliente puede tener varios vehículos. Un vehículo puede cambiar de titular conservando su historial. |
| RF-VEH-03 | Historial de reparaciones y de kilometraje. |
| RF-VEH-04 | Adjuntos (ficha técnica, fotos, PDF) asociados al vehículo. |
| RF-VEH-05 | La matrícula se normaliza (mayúsculas, sin espacios ni guiones) para buscar y evitar duplicados. |

## 6. Órdenes de trabajo

| ID | Requisito |
|---|---|
| RF-OT-01 | Número automático por serie. |
| RF-OT-02 | Cliente, vehículo, fecha de entrada, kilometraje, motivo, averías, observaciones, trabajos solicitados, mecánico responsable y materiales. |
| RF-OT-03 | Estados: Pendiente, En reparación, Esperando recambios, Terminado, Entregado y Cancelado, con historial de cambios. |
| RF-OT-04 | Recepción del vehículo: checklist de entrada, nivel de combustible, daños visibles y fotos. |
| RF-OT-05 | Independiente del presupuesto y la factura, pero enlazada con ambos. |
| RF-OT-06 | Adjuntos propios de la orden. |

## 7. Presupuestos

| ID | Requisito |
|---|---|
| RF-PRE-01 | Líneas de mano de obra y recambios con cantidad, precio, descuento e impuesto. Totales calculados. |
| RF-PRE-02 | Estados: Pendiente, Aceptado, Rechazado, Caducado y Sustituido. |
| RF-PRE-03 | La aceptación o el rechazo registran fecha, hora, trabajador y método: documento impreso firmado (escaneado y adjunto) o conformidad por teléfono, email o en persona, con una nota obligatoria. Sin firma en pantalla en el MVP (D-021). |
| RF-PRE-04 | Modificar un presupuesto aceptado crea una nueva versión que requiere nueva autorización. La anterior queda como Sustituido. |
| RF-PRE-05 | Caducidad automática según la fecha de validez. |
| RF-PRE-06 | Un presupuesto aceptado puede convertirse en orden de trabajo o enlazarse con una existente. |

## 8. Facturación

| ID | Requisito |
|---|---|
| RF-FAC-01 | Series de numeración correlativas y sin huecos. El número se asigna al emitir, no al crear el borrador. |
| RF-FAC-02 | Datos fiscales del emisor y del destinatario guardados como copia en la factura. |
| RF-FAC-03 | Base imponible, desglose de IVA por tipo y total. |
| RF-FAC-04 | Una factura emitida no se modifica ni se elimina. Las correcciones se hacen mediante factura rectificativa. |
| RF-FAC-05 | Creación desde orden de trabajo o presupuesto, o factura libre. |
| RF-FAC-06 | En TALLER, la emisión real queda bloqueada hasta la validación fiscal (D-014). |
| RF-FAC-07 | En DEMO, todas las facturas llevan la marca DEMO visible en pantalla y en el PDF. |
| RF-FAC-08 | Solo facturas completas (ordinarias y rectificativas). No se emiten facturas simplificadas ni tickets (D-022). |

## 9. Cobros

| ID | Requisito |
|---|---|
| RF-COB-01 | Pagos completos y parciales asociados a una factura. |
| RF-COB-02 | Métodos: efectivo, tarjeta, transferencia y otros configurables. |
| RF-COB-03 | Estado de cobro calculado: Pendiente, Parcialmente pagada o Pagada. |
| RF-COB-04 | Las devoluciones se registran como movimientos negativos enlazados al original. Nunca se borra un cobro. |
| RF-COB-05 | Justificante de pago en PDF. |

## 10. Catálogo

| ID | Requisito |
|---|---|
| RF-CAT-01 | Tipos: recambio, mano de obra y servicio. |
| RF-CAT-02 | Referencia, descripción, precio de coste opcional, precio de venta e impuesto. |
| RF-CAT-03 | Búsqueda rápida desde las líneas de presupuestos, órdenes y facturas. |
| RF-CAT-04 | Sin control de stock en el MVP. |

## 11. Agenda

| ID | Requisito |
|---|---|
| RF-AGE-01 | Crear, modificar y cancelar citas con cliente, vehículo, fecha y hora, duración, motivo y observaciones. |
| RF-AGE-02 | Vistas de día, semana y mes. |
| RF-AGE-03 | Estados: Pendiente, Confirmada, Atendida y Cancelada. |
| RF-AGE-04 | Una cita se convierte en orden de trabajo con un clic, precargando sus datos. |

## 12. Configuración

| ID | Requisito |
|---|---|
| RF-CFG-01 | Datos del taller: razón social, nombre comercial, NIF, dirección fiscal, teléfono, email, logotipo y datos bancarios. |
| RF-CFG-02 | Series de numeración por tipo de documento. |
| RF-CFG-03 | Tipos de impuesto y métodos de pago. |
| RF-CFG-04 | Configuración fiscal: modalidad y estado del módulo VeriFactu (solo administrador). |
| RF-CFG-05 | Configuración de copias: carpeta de destino, frecuencia y retención. |
| RF-CFG-06 | Conectar y desconectar la cuenta de Gmail del taller, con envío de prueba (solo administrador). |

## 13. Documentos PDF

| ID | Requisito |
|---|---|
| RF-PDF-01 | Identidad visual común para presupuesto, orden de trabajo, factura, rectificativa, justificante de pago y ficha/historial de vehículo. |
| RF-PDF-02 | Guardar, consultar, imprimir y enviar por email. |
| RF-PDF-03 | Mismo resultado en escritorio y en la demo. |

## 14. Copias de seguridad (solo escritorio)

| ID | Requisito |
|---|---|
| RF-BAK-01 | Copia automática diaria y copia tras operaciones importantes (emitir factura, registrar cobro), agrupadas para no repetirse. |
| RF-BAK-02 | Copia manual y exportación a USB o disco externo. |
| RF-BAK-03 | Copia consistente aunque la aplicación se cierre inesperadamente (Backup API y movimiento atómico). |
| RF-BAK-04 | Comprobación de integridad de cada copia. |
| RF-BAK-05 | Copias cifradas con contraseña. |
| RF-BAK-06 | Historial de copias y restauración desde cualquiera, con copia previa automática del estado actual. |
| RF-BAK-07 | Política de retención: diarias del último mes y mensuales del último año (configurable). |
| RF-BAK-08 | Aviso visible si no hay una copia correcta en las últimas 48 horas. |

## 15. Fiscal (VeriFactu)

Lo técnico (formatos, algoritmo de huella, QR, servicios de la AEAT) se toma **solo** de la documentación oficial vigente y se verifica en la Fase 4. Ningún dato de esta tabla presupone un formato concreto.

| ID | Requisito |
|---|---|
| RF-FIS-01 | Cada emisión o anulación de factura genera un registro de facturación separado del documento comercial. |
| RF-FIS-02 | Los registros se encadenan mediante huella y no se pueden modificar ni borrar. |
| RF-FIS-03 | Registro de eventos cuando la modalidad lo exija. |
| RF-FIS-04 | QR en la factura conforme a la especificación vigente. |
| RF-FIS-05 | Cola de envío con estados, reintentos y errores. Un registro solo figura como remitido cuando la AEAT lo acepta. |
| RF-FIS-06 | Entorno de pruebas de la AEAT separado del real. |
| RF-FIS-07 | Versión de la especificación guardada en cada registro. |
| RF-FIS-08 | Auditoría de toda operación fiscal. |
| RF-FIS-09 | Soporte de las modalidades VERI\*FACTU y NO VERI\*FACTU. |
| RF-FIS-10 | DEMO, PREVIEW y LOCAL nunca comunican con la AEAT. |

## 16. Demo web

| ID | Requisito |
|---|---|
| RF-DEM-01 | Inicio de sesión con usuarios de prueba de cada rol para probar los permisos. No es una protección real: la demo es pública y solo contiene datos ficticios (D-024). |
| RF-DEM-02 | Datos ficticios: clientes, vehículos, órdenes, presupuestos y facturas DEMO. |
| RF-DEM-03 | Crear, editar y eliminar datos de prueba. |
| RF-DEM-04 | Botón para restaurar los datos iniciales. Los datos se guardan solo en el navegador de quien prueba. |
| RF-DEM-05 | Las funciones exclusivas de escritorio (copias, USB, impresión directa) aparecen desactivadas con una explicación. |
| RF-DEM-06 | Exportar el estado de la demo a un archivo e importarlo, para que el cliente pueda enviar lo que ha probado. |
| RF-DEM-07 | Marca visible del entorno (DEMO o PREVIEW con el nombre de la rama) en todas las pantallas. |

## 17. No funcionales

| ID | Requisito |
|---|---|
| RNF-01 | Funciona completamente sin Internet, salvo actualizaciones y envío fiscal. |
| RNF-02 | Las operaciones habituales responden en menos de 200 ms con 10 años de datos. |
| RNF-03 | Contraseñas con Argon2id. Ningún secreto en el código ni en el repositorio. |
| RNF-04 | Interfaz clara: fondo claro, menú lateral fijo, tablas limpias y formularios cortos. |
| RNF-05 | Diseño utilizable en tablet (ancho mínimo 1024 px). |
| RNF-06 | Interfaz en español. Textos centralizados para poder traducir en el futuro. |
| RNF-07 | Ningún componente de interfaz depende de Tauri. |
| RNF-08 | Migraciones de base de datos automáticas, con copia previa. |
| RNF-09 | Cada módulo tiene pruebas automáticas de sus reglas de negocio. |

## 18. Fuera del MVP

Firma en pantalla, facturas simplificadas, stock y almacén, proveedores y compras, inventarios, tiempos y fichajes de operarios, albaranes, anticipos, vehículos de sustitución, WhatsApp, portal de clientes, multiempresa, multitaller y sincronización multidispositivo. La arquitectura debe permitir añadirlos.

## 19. Requisitos pendientes de definir

Ninguno por ahora.
