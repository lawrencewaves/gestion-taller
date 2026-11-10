-- 0003 · Historial de copias de seguridad (DATABASE §3, RF-BAK-06).
-- La carpeta y la retención ya están en `settings` desde 0001. La clave de copias
-- no se guarda en la base: vive en el Administrador de credenciales del sistema (D-038).

CREATE TABLE backups (
  id           TEXT PRIMARY KEY,
  created_at   TEXT NOT NULL,
  kind         TEXT NOT NULL CHECK (kind IN ('auto', 'manual', 'export')),
  destination  TEXT NOT NULL,
  file_name    TEXT,
  size_bytes   INTEGER CHECK (size_bytes IS NULL OR size_bytes >= 0),
  sha256       TEXT CHECK (sha256 IS NULL OR length(sha256) = 64),
  -- Se vuelve a leer y descifrar entera antes de darla por buena (RF-BAK-04).
  verified     INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  error        TEXT,
  -- O hay archivo o hay error, nunca las dos cosas ni ninguna.
  CHECK ((file_name IS NULL) = (error IS NOT NULL))
) STRICT;

CREATE INDEX backups_created ON backups (created_at);

CREATE TRIGGER backups_no_update BEFORE UPDATE ON backups
BEGIN
  SELECT RAISE(ABORT, 'El historial de copias no se puede modificar');
END;

CREATE TRIGGER backups_no_delete BEFORE DELETE ON backups
BEGIN
  SELECT RAISE(ABORT, 'El historial de copias no se puede borrar');
END;
