CREATE TABLE IF NOT EXISTS quizzes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 160),
    descripcion TEXT NOT NULL DEFAULT '',
    tema TEXT NOT NULL DEFAULT 'General',
    preguntas TEXT NOT NULL,
    propietario TEXT NOT NULL,
    creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_quizzes_propietario ON quizzes(propietario, actualizado_en DESC);
