-- Seeds 005: Biblioteca digital con búsqueda full-text (FTS5)
-- Crea tabla biblioteca + FTS5 + triggers + inserta catálogo completo.
-- Fuente: data/biblioteca/catalogo.json
-- Generado: 2025-06-05

-- ── Tabla base ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biblioteca (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titulo TEXT NOT NULL,
    descripcion TEXT NOT NULL DEFAULT '',
    archivo_path TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT '',
    idioma TEXT NOT NULL DEFAULT 'Español',
    edad TEXT NOT NULL DEFAULT '',
    fuente TEXT NOT NULL DEFAULT ''
);

-- ── Índice FTS5 ───────────────────────────────────────────────────────
CREATE VIRTUAL TABLE IF NOT EXISTS biblioteca_fts USING fts5(
    titulo,
    descripcion,
    content='biblioteca',
    content_rowid='id',
    tokenize='porter unicode61'
);

-- ── Triggers de sincronización ────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS biblioteca_ai AFTER INSERT ON biblioteca BEGIN
    INSERT INTO biblioteca_fts(rowid, titulo, descripcion)
    VALUES (new.id, new.titulo, new.descripcion);
END;

CREATE TRIGGER IF NOT EXISTS biblioteca_ad AFTER DELETE ON biblioteca BEGIN
    INSERT INTO biblioteca_fts(biblioteca_fts, rowid, titulo, descripcion)
    VALUES ('delete', old.id, old.titulo, old.descripcion);
END;

CREATE TRIGGER IF NOT EXISTS biblioteca_au AFTER UPDATE ON biblioteca BEGIN
    INSERT INTO biblioteca_fts(biblioteca_fts, rowid, titulo, descripcion)
    VALUES ('delete', old.id, old.titulo, old.descripcion);
    INSERT INTO biblioteca_fts(rowid, titulo, descripcion)
    VALUES (new.id, new.titulo, new.descripcion);
END;

-- ── Catálogo: Wayuu ───────────────────────────────────────────────────
INSERT OR IGNORE INTO biblioteca (titulo, descripcion, archivo_path, categoria, idioma, edad, fuente) VALUES
('Putunkaa Serruma: Duérmete, pajarito blanco', 'Arrullos en wayúu, piapoco, arhuaco, kamëntsá y uitoto', 'data/biblioteca/wayuu/putunkaa-serruma.pdf', 'wayuu', 'Multilingüe', '0-5', 'Maguaré / ICBF'),
('Narraciones indígenas del desierto', 'Cuentos tradicionales del pueblo wayuu (Aküjuushi sulu''u suummainpa''a)', 'data/biblioteca/wayuu/narraciones-indigenas-desierto.pdf', 'wayuu', 'Wayuunaiki/Español', '6-12', 'Editorial Norma'),
('La voz de los hermanos mayores', 'Sabiduría de los pueblos indígenas de Colombia', 'data/biblioteca/wayuu/la-voz-de-los-hermanos-mayores.pdf', 'wayuu', 'Español', '8-14', 'Leer es mi cuento #67');

-- ── Catálogo: Cuentos ─────────────────────────────────────────────────
INSERT OR IGNORE INTO biblioteca (titulo, descripcion, archivo_path, categoria, idioma, edad, fuente) VALUES
('La muñeca negra', 'Cuento sobre identidad y diversidad afrocolombiana', 'data/biblioteca/cuentos/la-muneca-negra.pdf', 'cuentos', 'Español', '4-10', 'Leer es mi cuento #65'),
('De viva voz', 'Relatos y poemas para leer en voz alta', 'data/biblioteca/cuentos/01-de-viva-voz.pdf', 'cuentos', 'Español', '6-14', 'Colombia Aprende'),
('Con Pombo y platillos', 'Antología de Rafael Pombo, el poeta de los niños', 'data/biblioteca/cuentos/02-con-pombo-y-platillos.pdf', 'cuentos', 'Español', '3-10', 'Colombia Aprende'),
('Puro cuento', 'Selección de cuentos clásicos infantiles', 'data/biblioteca/cuentos/03-puro-cuento.pdf', 'cuentos', 'Español', '4-12', 'Colombia Aprende'),
('Barbas, pelos y cenizas', 'Cuentos de hadas y transformaciones', 'data/biblioteca/cuentos/04-barbas-pelos-cenizas.pdf', 'cuentos', 'Español', '6-12', 'Colombia Aprende'),
('Canta palabra', 'Canciones, rondas y juegos de palabras', 'data/biblioteca/cuentos/05-canta-palabra.pdf', 'cuentos', 'Español', '3-8', 'Colombia Aprende'),
('Bosque adentro', 'Cuentos de la naturaleza y los animales del bosque', 'data/biblioteca/cuentos/06-bosque-adentro.pdf', 'cuentos', 'Español', '5-12', 'Colombia Aprende'),
('De animales y de niños', 'Historias de amistad entre niños y animales', 'data/biblioteca/cuentos/07-de-animales-y-de-ninos.pdf', 'cuentos', 'Español', '4-10', 'Colombia Aprende'),
('En la diestra de Dios Padre', 'Cuento clásico de Tomás Carrasquilla', 'data/biblioteca/cuentos/08-en-la-diestra-de-dios-padre.pdf', 'cuentos', 'Español', '10-16', 'Colombia Aprende'),
('Ábrete grano pequeño', 'Adivinanzas y juegos de ingenio popular', 'data/biblioteca/cuentos/09-abrete-grano-pequeno.pdf', 'cuentos', 'Español', '5-12', 'Colombia Aprende'),
('El rey de los topos y su hija', 'Cuento fantástico de reinos subterráneos', 'data/biblioteca/cuentos/10-el-rey-de-los-topos.pdf', 'cuentos', 'Español', '6-12', 'Colombia Aprende'),
('Los pigmeos', 'Aventuras en busca de pueblos legendarios', 'data/biblioteca/cuentos/11-los-pigmeos.pdf', 'cuentos', 'Español', '8-14', 'Colombia Aprende'),
('El pequeño escribiente florentino', 'Historia de esfuerzo y superación en la Italia medieval', 'data/biblioteca/cuentos/12-el-pequeno-escribiente.pdf', 'cuentos', 'Español', '8-14', 'Colombia Aprende'),
('Don Quijote de la Mancha', 'Aventuras del ingenioso hidalgo (versión infantil)', 'data/biblioteca/cuentos/13-don-quijote.pdf', 'cuentos', 'Español', '8-16', 'Colombia Aprende'),
('Los arrullos de Jáamo', 'Arrullos multilingües indígenas para dormir', 'data/biblioteca/cuentos/arrullos-jaamo.pdf', 'cuentos', 'Multilingüe', '0-5', 'Maguaré / ICBF'),
('Tiki, tiki, tai', 'Rondas y juegos tradicionales colombianos', 'data/biblioteca/cuentos/tiki-tiki-tai.pdf', 'cuentos', 'Español', '3-8', 'Maguaré / ICBF'),
('Una morena en la ronda', 'Tradiciones y ritmos afrocolombianos', 'data/biblioteca/cuentos/una-morena-en-la-ronda.pdf', 'cuentos', 'Español', '3-10', 'Maguaré / ICBF'),
('Tortuguita, vení bailá', 'Antología musical infantil colombiana', 'data/biblioteca/cuentos/tortuguita-veni-baila.pdf', 'cuentos', 'Español', '3-8', 'Maguaré / ICBF');
