-- Semillas: Cursos contextualizados para La Guajira, Colombia
-- INSERT OR IGNORE para re-ejecución segura.

INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(1,
 'Matemáticas para la Vida Wayuu',
 'Aprende matemáticas aplicadas al comercio artesanal y trueque en rancherías. Suma, resta, multiplicación y división con ejemplos de la vida diaria en La Guajira.',
 'matematicas',
 '/contenido/matematicas-wayuu.pdf');

INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(2,
 'Lectura y Escritura en Wayuunaiki',
 'Fortalecimiento de la lectoescritura en lengua Wayuunaiki y español bilingüe. Ideal para docentes y estudiantes de comunidades indígenas.',
 'lenguaje',
 '/contenido/lectura-wayuunaiki.pdf');

INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(3,
 'Agua y Sostenibilidad en el Desierto',
 'Gestión del agua, captación de lluvia y sistemas de riego sostenibles para comunidades del desierto guajiro. Incluye proyectos prácticos con materiales locales.',
 'ciencias',
 '/contenido/agua-sostenible.pdf');

INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(4,
 'Tecnología Rural: Primeros Pasos',
 'Introducción a computadores, tablets y navegación offline. Aprende a usar herramientas digitales sin conexión a internet en zonas rurales de La Guajira.',
 'tecnologia',
 '/contenido/tecnologia-rural.pdf');

INSERT OR IGNORE INTO cursos (id, titulo, descripcion, categoria, archivo_path) VALUES
(5,
 'Emprendimiento Artesanal Wayuu',
 'Convierte tus tejidos y artesanías en un negocio sostenible. Contabilidad básica, precios justos y estrategias de venta para artesanos wayuu.',
 'emprendimiento',
 '/contenido/artesanias-wayuu.pdf');
