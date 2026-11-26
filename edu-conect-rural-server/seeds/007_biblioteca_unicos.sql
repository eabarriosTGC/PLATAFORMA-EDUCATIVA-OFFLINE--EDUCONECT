-- Seeds 007: Biblioteca sin duplicados + UNIQUE real.
-- La idempotencia del seed 005 (INSERT OR IGNORE) solo funciona si existe una
-- restricción UNIQUE: sin ella, cada arranque insertaba el catálogo completo
-- (21 filas × N arranques = 1050 registros en la DB observada).
-- Esta migración es NUEVA (no se toca la histórica 005):
--   1. Deduplica conservando MIN(id) por archivo_path.
--   2. Crea el UNIQUE INDEX del que depende el OR IGNORE del seed.
--   3. Reconstruye el índice FTS tras la deduplicación.

DELETE FROM biblioteca
WHERE id NOT IN (
    SELECT MIN(id) FROM biblioteca GROUP BY archivo_path
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_biblioteca_archivo_path
    ON biblioteca(archivo_path);

INSERT INTO biblioteca_fts(biblioteca_fts) VALUES('rebuild');
