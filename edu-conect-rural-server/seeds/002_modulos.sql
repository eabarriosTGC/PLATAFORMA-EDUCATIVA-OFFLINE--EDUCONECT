-- Semillas: Todos los módulos educativos de EduConect Rural
-- INSERT OR IGNORE para re-ejecución segura.
-- Generado: 2026-06-04

-- ============ LENGUAJE (13 módulos) ============
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(100, 'Las Vocales Mágicas', 'Aprende las vocales con animales animados y juegos divertidos', 'lenguaje', 'modulos/modulo-vocales/index.html'),
(101, 'El Regalo de Mili', 'Cuento interactivo sobre emociones y regalos', 'lenguaje', 'modulos/modulo-mili/index.html'),
(102, 'El Lagarto Llorón', 'Poema de García Lorca con sopa de letras mágica', 'lenguaje', 'modulos/modulo-lagarto/index.html'),
(103, 'El Pintor de Pajaritos', 'Colorea los pájaros como en el cuento', 'lenguaje', 'modulos/modulo-pintor/index.html'),
(104, 'Rana Dardo Dorada', '¡Explora este animal colombiano en 3D!', 'lenguaje', 'modulos/modulo-rana/index.html'),
(105, 'La Ostra y el Ratón Pérez', 'Descubre el origen del Ratón Pérez en el fondo del mar', 'lenguaje', 'modulos/modulo-raton-perez/index.html'),
(106, 'El Caracol Rímador', 'Aprende rimas y la letra C con el caracol del jardín', 'lenguaje', 'modulos/modulo-caracol/index.html'),
(107, 'Mirringa Mirronga', 'Teatro interactivo con Rafael Pombo', 'lenguaje', 'modulos/modulo-mirringa/index.html');

-- Lenguaje DBA 1°-5°
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(110, 'LENG-101: Vocales Mágicas (Wayuu)', '1° Grado. Vocales, sonidos y palabras en wayuunaiki con juegos interactivos', 'lenguaje', 'modulos/leng-101/index.html'),
(111, 'LENG-102: Lectoescritura Wayuu', '1°-2° Grado. Sílabas, formación de palabras y mini-cuento wayuu', 'lenguaje', 'modulos/leng-102/index.html'),
(112, 'LENG-103: La Iguana y el Conejo', '2°-3° Grado. Cuento tradicional wayuu con comprensión lectora y narración', 'lenguaje', 'modulos/leng-103/index.html'),
(113, 'LENG-104: Textos que Informan y Poemas', '4° Grado. Texto expositivo del cardón + poesía wayuu con rima', 'lenguaje', 'modulos/leng-104/index.html'),
(114, 'LENG-105: El Pütchipü''üi - Argumentación', '5° Grado. Argumentación con la figura del Palabrero wayuu y debate simulado', 'lenguaje', 'modulos/leng-105/index.html');

-- ============ MATEMÁTICAS (12 módulos) ============
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(200, 'Conteo Wayuu', 'Aprende a contar con mochilas y personajes interactivos', 'matematicas', 'modulos/modulo-conteo-wayuu/index.html'),
(201, 'Cangrejitos Matemáticos', 'Sumas y restas hasta 20 de forma divertida', 'matematicas', 'modulos/modulo-cangrejitos/index.html'),
(202, 'Tejidos y Formas Wayuu', 'Geometría, patrones y cuerpos 3D', 'matematicas', 'modulos/modulo-geometria/index.html'),
(203, 'Sumas con Semillas', 'Arrastra semillas al grupo correcto y aprende a sumar', 'matematicas', 'modulos/modulo-sumas-semillas/index.html'),
(204, 'Formas en mi Entorno', 'Encuentra círculos, triángulos y rectángulos en la ranchería', 'matematicas', 'modulos/modulo-formas-entorno/index.html'),
(205, 'Patrones Wayuu', 'Completa los diseños de chinchorros siguiendo la secuencia', 'matematicas', 'modulos/modulo-patrones-wayuu/index.html'),
(206, 'Pasos y Palmos', 'Aprende a medir sin regla usando tu cuerpo como instrumento', 'matematicas', 'modulos/modulo-medidas/index.html');

-- Matemáticas DBA 1°-5°
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(210, 'MATE-201: Conteo Wayuu 0-99', '1° Grado. Números hasta 99, valor posicional, conteo tradicional wayuu', 'matematicas', 'modulos/mate-201/index.html'),
(211, 'MATE-202: Trueque - Suma y Resta', '2° Grado. Suma, resta, tablas 1-5 con trueque de mochilas y productos', 'matematicas', 'modulos/mate-202/index.html'),
(212, 'MATE-203: Reparto Comunitario', '3° Grado. Multiplicación, división y fracciones en la comunidad wayuu', 'matematicas', 'modulos/mate-203/index.html'),
(213, 'MATE-204: Geometría Wayuu', '4° Grado. Figuras, ángulos y medidas en patrones de tejido wayuu', 'matematicas', 'modulos/mate-204/index.html'),
(214, 'MATE-205: Estadística Wayuu', '5° Grado. Razones, porcentajes, media y gráficos con datos comunitarios', 'matematicas', 'modulos/mate-205/index.html');

-- ============ CIENCIAS NATURALES (6 módulos) ============
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(300, 'El Ciclo del Agua en La Guajira', 'Explora el ciclo del agua en 3D. Arrastra nubes, mira la lluvia, llena el jagüey', 'ciencias', 'modulos/modulo1-agua/index.html'),
(301, 'CIEN-301: Seres Vivos del Desierto', '1° Grado. ¿Qué está vivo? Animales del desierto guajiro', 'ciencias', 'modulos/cien-301/index.html'),
(302, 'CIEN-302: Animales Wayuu', '2° Grado. Clasificación y nombres en wayuunaiki', 'ciencias', 'modulos/cien-302/index.html'),
(303, 'CIEN-303: Plantas Nativas y Cardón', '3° Grado. Partes de la planta, fotosíntesis, plantas medicinales', 'ciencias', 'modulos/cien-303/index.html'),
(304, 'CIEN-304: Cuerpo y Salud Wayuu', '4° Grado. Sistemas del cuerpo + medicina tradicional outshü', 'ciencias', 'modulos/cien-304/index.html'),
(305, 'CIEN-305: Ecosistemas La Guajira', '5° Grado. Desierto, manglar, jagüey, cadena alimenticia, conservación', 'ciencias', 'modulos/cien-305/index.html');

-- ============ ETNOEDUCACIÓN WAYUU (3 módulos) ============
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(400, 'WAYU-401: Wayuunaiki Básico', 'Saludos, números 1-10, familia. Aprendamos la lengua wayuu', 'cultura', 'modulos/wayu-401/index.html'),
(401, 'WAYU-402: Cosmovisión Wayuu', 'Mma, Juyá, el Achón, ciclo de vida, oralidad y sueños', 'cultura', 'modulos/wayu-402/index.html'),
(402, 'WAYU-403: Tejidos y Danza Yonna', 'Mochilas, chinchorros, danza Yonna, juegos tradicionales, música', 'cultura', 'modulos/wayu-403/index.html');

-- ============ ESPECIALES (3 módulos) ============
INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(500, 'PUZZLE-501: La Guajira', 'Arma el mapa en 3 niveles: 9 piezas, 12 piezas y ubicar municipios', 'juegos', 'modulos/puzzle-501/index.html'),
(501, 'QUIZ-601: Quiz Saber 11', '20 preguntas, 5 rondas, temporizador. Lenguaje, Mate, Ciencias, Wayuu', 'juegos', 'modulos/quiz-601/index.html'),
(502, 'MUNDO-3D: La Guajira en 3D', 'Mundo 3D interactivo: cardones, chivos, iguanas, flamencos, ranchería', 'juegos', 'modulos/mundo-3d-701/index.html');
