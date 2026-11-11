-- 0004 · Logotipo del taller (RF-CFG-01). Imagen PNG o JPEG pequeña, como data: URL.
-- Va en la base para que viaje con las copias de seguridad y sea igual en escritorio y demo.

ALTER TABLE settings ADD COLUMN logo TEXT CHECK (
  logo IS NULL OR (
    (logo LIKE 'data:image/png;base64,%' OR logo LIKE 'data:image/jpeg;base64,%')
    AND length(logo) <= 420000
  )
);
