-- 0005 · Cierre de sesión por inactividad configurable (RF-USR-05).

ALTER TABLE settings ADD COLUMN idle_minutes INTEGER NOT NULL DEFAULT 30 CHECK (idle_minutes BETWEEN 5 AND 480);
