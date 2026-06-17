-- Migración 004: Índices de búsqueda full-text (FTS5)
-- Requiere SQLite compilado con FTS5 (incluido en rusqlite bundled)

-- Tabla virtual FTS para cursos
CREATE VIRTUAL TABLE IF NOT EXISTS cursos_fts USING fts5(
    titulo,
    descripcion,
    categoria,
    content='cursos',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Tabla virtual FTS para videos
CREATE VIRTUAL TABLE IF NOT EXISTS videos_fts USING fts5(
    titulo,
    canal,
    categoria,
    content='videos',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- Triggers para mantener FTS sincronizado con cursos
CREATE TRIGGER IF NOT EXISTS cursos_ai AFTER INSERT ON cursos BEGIN
    INSERT INTO cursos_fts(rowid, titulo, descripcion, categoria)
    VALUES (new.id, new.titulo, new.descripcion, new.categoria);
END;

CREATE TRIGGER IF NOT EXISTS cursos_ad AFTER DELETE ON cursos BEGIN
    INSERT INTO cursos_fts(cursos_fts, rowid, titulo, descripcion, categoria)
    VALUES ('delete', old.id, old.titulo, old.descripcion, old.categoria);
END;

CREATE TRIGGER IF NOT EXISTS cursos_au AFTER UPDATE ON cursos BEGIN
    INSERT INTO cursos_fts(cursos_fts, rowid, titulo, descripcion, categoria)
    VALUES ('delete', old.id, old.titulo, old.descripcion, old.categoria);
    INSERT INTO cursos_fts(rowid, titulo, descripcion, categoria)
    VALUES (new.id, new.titulo, new.descripcion, new.categoria);
END;

-- Triggers para mantener FTS sincronizado con videos
CREATE TRIGGER IF NOT EXISTS videos_ai AFTER INSERT ON videos BEGIN
    INSERT INTO videos_fts(rowid, titulo, canal, categoria)
    VALUES (new.id, new.titulo, new.canal, new.categoria);
END;

CREATE TRIGGER IF NOT EXISTS videos_ad AFTER DELETE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, titulo, canal, categoria)
    VALUES ('delete', old.id, old.titulo, old.canal, old.categoria);
END;

CREATE TRIGGER IF NOT EXISTS videos_au AFTER UPDATE ON videos BEGIN
    INSERT INTO videos_fts(videos_fts, rowid, titulo, canal, categoria)
    VALUES ('delete', old.id, old.titulo, old.canal, old.categoria);
    INSERT INTO videos_fts(rowid, titulo, canal, categoria)
    VALUES (new.id, new.titulo, new.canal, new.categoria);
END;
