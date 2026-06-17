-- Migración inicial: esquema para EduConect Rural
-- Ejecutar al crear la base de datos por primera vez.

CREATE TABLE IF NOT EXISTS cursos (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo       TEXT    NOT NULL,
    descripcion  TEXT    NOT NULL DEFAULT '',
    categoria    TEXT    NOT NULL DEFAULT 'general',
    archivo_path TEXT    NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS progreso (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario     TEXT    NOT NULL,
    curso_id    INTEGER NOT NULL,
    porcentaje  REAL   NOT NULL DEFAULT 0.0 CHECK(porcentaje >= 0 AND porcentaje <= 100),
    ultima_vez  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (curso_id) REFERENCES cursos(id) ON DELETE CASCADE,
    UNIQUE(usuario, curso_id)
);

CREATE INDEX IF NOT EXISTS idx_progreso_usuario ON progreso(usuario);
CREATE INDEX IF NOT EXISTS idx_progreso_curso  ON progreso(curso_id);
