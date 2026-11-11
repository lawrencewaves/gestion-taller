-- 0006 · Primer número de cada serie (RF-CFG-02). Permite empezar la numeración donde haga falta
-- y saber si una serie ya se ha usado: mientras last_number = first_number - 1 no se ha emitido nada.

ALTER TABLE series ADD COLUMN first_number INTEGER NOT NULL DEFAULT 1 CHECK (first_number >= 1);
