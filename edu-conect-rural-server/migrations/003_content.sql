-- Migración 003: Tablas para contenido multimedia
-- Videos educativos, archivos subidos, metadatos

CREATE TABLE IF NOT EXISTS videos (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo     TEXT    NOT NULL,
    canal      TEXT    NOT NULL DEFAULT '',
    duracion   TEXT    NOT NULL DEFAULT '',
    thumbnail  TEXT    NOT NULL DEFAULT '',
    vistas     TEXT    NOT NULL DEFAULT '',
    categoria  TEXT    NOT NULL DEFAULT 'general',
    archivo    TEXT    NOT NULL DEFAULT '',
    activo     INTEGER NOT NULL DEFAULT 1,
    creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS archivos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo           TEXT    NOT NULL,         -- 'pdf', 'video', 'imagen', 'nota'
    referencia_tabla TEXT,                   -- 'cursos', 'videos', NULL
    referencia_id  INTEGER,                  -- id del curso/video asociado
    nombre_original TEXT NOT NULL,
    ruta_archivo   TEXT   NOT NULL,
    tamano         INTEGER NOT NULL DEFAULT 0,
    mime_type      TEXT   NOT NULL DEFAULT '',
    metadata       TEXT   NOT NULL DEFAULT '{}',
    creado_en      TEXT   NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_archivos_tipo     ON archivos(tipo);
CREATE INDEX IF NOT EXISTS idx_archivos_ref      ON archivos(referencia_tabla, referencia_id);
CREATE INDEX IF NOT EXISTS idx_videos_categoria  ON videos(categoria);
