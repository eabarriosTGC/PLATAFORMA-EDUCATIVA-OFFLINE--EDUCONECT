-- Seeds 008: Diccionario con identidad de fila real (D-04).
-- La idempotencia del seed 006 (INSERT OR IGNORE) nunca funcionó: sus índices no
-- son únicos, así que no había contra qué ignorar y cada arranque insertaba el
-- catálogo completo (21.826 filas × N arranques en la base observada).
-- Precedente: seeds/007_biblioteca_unicos.sql.
-- Esta migración es NUEVA (no se toca la histórica 006):
--   1. Deduplica conservando MIN(id) por (palabra, tipo, categoria).
--      `palabra` sola NO es la identidad: `leer` es verbo general, sinónimo y
--      verbo de la lista de verbos, y las tres filas son legítimas.
--   2. Crea el UNIQUE INDEX del que depende el OR IGNORE del seed.
--
-- El orden es obligatorio: SQLite no puede crear un índice único mientras
-- existan duplicados, así que se deduplica PRIMERO y se indexa DESPUÉS.
-- Es borrado de datos autorizado explícitamente (decisión L6 del humano) y es
-- idempotente: en el segundo arranque el DELETE no borra nada y
-- `CREATE UNIQUE INDEX IF NOT EXISTS` no falla sobre el índice existente.
--
-- NO se hace `rebuild` de `diccionario_fts` aquí: `reindex_search` ya reconstruye
-- ese índice inmediatamente después de que esta transacción de semillas confirma
-- (`src/db.rs:100`), sobre el catálogo ya deduplicado. Repetirlo aquí paga un
-- segundo rebuild completo en cada arranque sin cambiar el resultado. No lo
-- vuelvas a agregar: si `reindex_search` desaparece, el arreglo va ahí, una sola vez.

DELETE FROM diccionario
WHERE id NOT IN (
    SELECT MIN(id) FROM diccionario GROUP BY palabra, tipo, categoria
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_diccionario_identidad
    ON diccionario(palabra, tipo, categoria);

