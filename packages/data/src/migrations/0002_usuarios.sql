-- 0002 · Usuarios, permisos por rol y registro de actividad (REQUIREMENTS §2, RF-GEN-01).

CREATE TABLE users (
  id               TEXT PRIMARY KEY,
  username         TEXT NOT NULL COLLATE NOCASE UNIQUE CHECK (length(username) BETWEEN 3 AND 40),
  display_name     TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  password_hash    TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('admin', 'recepcion', 'mecanico')),
  active           INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  failed_attempts  INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts >= 0),
  locked_until     TEXT,
  last_login_at    TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1
) STRICT;

CREATE TABLE role_permissions (
  role        TEXT NOT NULL CHECK (role IN ('admin', 'recepcion', 'mecanico')),
  permission  TEXT NOT NULL,
  PRIMARY KEY (role, permission)
) STRICT, WITHOUT ROWID;

-- Registro de actividad: solo inserción (DATABASE §4).
CREATE TABLE activity_log (
  id           TEXT PRIMARY KEY,
  at           TEXT NOT NULL,
  user_id      TEXT REFERENCES users (id),
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  changes      TEXT CHECK (changes IS NULL OR json_valid(changes))
) STRICT;

CREATE INDEX activity_log_at ON activity_log (at);
CREATE INDEX activity_log_entity ON activity_log (entity_type, entity_id);

CREATE TRIGGER activity_log_no_update BEFORE UPDATE ON activity_log
BEGIN
  SELECT RAISE(ABORT, 'El registro de actividad no se puede modificar');
END;

CREATE TRIGGER activity_log_no_delete BEFORE DELETE ON activity_log
BEGIN
  SELECT RAISE(ABORT, 'El registro de actividad no se puede borrar');
END;

-- Un usuario con actividad no se borra: se desactiva.
CREATE TRIGGER users_no_delete BEFORE DELETE ON users
BEGIN
  SELECT RAISE(ABORT, 'Los usuarios no se borran: se desactivan');
END;

-- Permisos iniciales (UX §3). El administrador puede ajustarlos después.
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'agenda.view'), ('admin', 'agenda.edit'),
  ('admin', 'ordenes.view'), ('admin', 'ordenes.edit'),
  ('admin', 'presupuestos.view'), ('admin', 'presupuestos.edit'),
  ('admin', 'facturas.view'), ('admin', 'facturas.edit'), ('admin', 'facturas.emit'),
  ('admin', 'cobros.view'), ('admin', 'cobros.edit'), ('admin', 'cobros.refund'),
  ('admin', 'clientes.view'), ('admin', 'clientes.edit'),
  ('admin', 'vehiculos.view'), ('admin', 'vehiculos.edit'),
  ('admin', 'catalogo.view'), ('admin', 'catalogo.edit'),
  ('admin', 'config.manage'), ('admin', 'users.manage'), ('admin', 'activity.view'),
  ('admin', 'system.diagnostics'),

  ('recepcion', 'agenda.view'), ('recepcion', 'agenda.edit'),
  ('recepcion', 'ordenes.view'), ('recepcion', 'ordenes.edit'),
  ('recepcion', 'presupuestos.view'), ('recepcion', 'presupuestos.edit'),
  ('recepcion', 'facturas.view'), ('recepcion', 'facturas.edit'), ('recepcion', 'facturas.emit'),
  ('recepcion', 'cobros.view'), ('recepcion', 'cobros.edit'),
  ('recepcion', 'clientes.view'), ('recepcion', 'clientes.edit'),
  ('recepcion', 'vehiculos.view'), ('recepcion', 'vehiculos.edit'),
  ('recepcion', 'catalogo.view'),
  ('recepcion', 'system.diagnostics'),

  ('mecanico', 'agenda.view'),
  ('mecanico', 'ordenes.view'), ('mecanico', 'ordenes.edit'),
  ('mecanico', 'presupuestos.view'),
  ('mecanico', 'facturas.view'),
  ('mecanico', 'cobros.view'),
  ('mecanico', 'clientes.view'),
  ('mecanico', 'vehiculos.view'),
  ('mecanico', 'catalogo.view'),
  ('mecanico', 'system.diagnostics');
