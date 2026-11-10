-- 0001 · Configuración del taller y datos de referencia (DATABASE §3).
-- Las tablas de cada módulo llegan con su propia migración en la Fase 5.

CREATE TABLE app_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
) STRICT;

CREATE TABLE settings (
  id                       INTEGER PRIMARY KEY CHECK (id = 1),
  environment              TEXT CHECK (environment IN ('LOCAL', 'PREVIEW', 'DEMO', 'TALLER')),
  legal_name               TEXT NOT NULL DEFAULT '',
  trade_name               TEXT NOT NULL DEFAULT '',
  tax_id                   TEXT NOT NULL DEFAULT '',
  address_line             TEXT NOT NULL DEFAULT '',
  postal_code              TEXT NOT NULL DEFAULT '',
  city                     TEXT NOT NULL DEFAULT '',
  province                 TEXT NOT NULL DEFAULT '',
  phone                    TEXT NOT NULL DEFAULT '',
  email                    TEXT NOT NULL DEFAULT '',
  iban                     TEXT NOT NULL DEFAULT '',
  fiscal_mode              TEXT NOT NULL DEFAULT 'off' CHECK (fiscal_mode IN ('off', 'verifactu', 'no_verifactu')),
  backup_folder            TEXT,
  backup_keep_daily        INTEGER NOT NULL DEFAULT 30 CHECK (backup_keep_daily BETWEEN 1 AND 366),
  backup_keep_monthly      INTEGER NOT NULL DEFAULT 12 CHECK (backup_keep_monthly BETWEEN 0 AND 120),
  created_at               TEXT NOT NULL,
  updated_at               TEXT NOT NULL,
  version                  INTEGER NOT NULL DEFAULT 1
) STRICT;

INSERT INTO settings (id, created_at, updated_at)
VALUES (1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

CREATE TABLE series (
  id           TEXT PRIMARY KEY,
  doc_type     TEXT NOT NULL CHECK (doc_type IN ('work_order', 'quote', 'invoice', 'rectifying_invoice', 'payment_receipt')),
  prefix       TEXT NOT NULL CHECK (length(prefix) BETWEEN 1 AND 10),
  year         INTEGER NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  last_number  INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  active       INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  version      INTEGER NOT NULL DEFAULT 1,
  UNIQUE (doc_type, prefix, year)
) STRICT;

CREATE TABLE tax_rates (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  rate_bp     INTEGER NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000),
  is_default  INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
) STRICT;

-- Un único tipo por defecto.
CREATE UNIQUE INDEX tax_rates_one_default ON tax_rates (is_default) WHERE is_default = 1;

CREATE TABLE payment_methods (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  active      INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  version     INTEGER NOT NULL DEFAULT 1
) STRICT;

-- Datos de referencia: identificadores fijos, iguales en todas las instalaciones.
INSERT INTO tax_rates (id, name, rate_bp, is_default, sort_order, created_at, updated_at) VALUES
  ('01a1bd63-d980-7000-865a-da76e6dd72c7', 'IVA general 21 %',        2100, 1, 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('01a1bd63-d981-7001-affd-14a14d45974a', 'IVA reducido 10 %',       1000, 0, 2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('01a1bd63-d982-7002-9e19-1ba75796811b', 'IVA superreducido 4 %',    400, 0, 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('01a1bd63-d983-7003-9d3c-6f63b0ad05c9', 'Exento 0 %',                 0, 0, 4, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));

INSERT INTO payment_methods (id, name, sort_order, created_at, updated_at) VALUES
  ('01a1bd63-d984-7004-a218-966c91ad5cc6', 'Efectivo',      1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('01a1bd63-d985-7005-9541-2085abe33114', 'Tarjeta',       2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  ('01a1bd63-d986-7006-b83a-cb29deb44e05', 'Transferencia', 3, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'), strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
