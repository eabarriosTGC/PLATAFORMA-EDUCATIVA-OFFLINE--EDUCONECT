# Plan de Implementación: Módulos Educativos Lenguaje y Matemáticas 1°-5°

> **Para Hermes:** Usar pipeline multi-agente con skills writing-plans, subagent-driven-development, verification-before-completion, test-driven-development, planning-with-files, concept-diagrams.

**Goal:** Crear módulos educativos interactivos HTML/CSS/JS 100% offline para Lenguaje y Matemáticas de 1° a 5° grado, alineados con los DBA (Derechos Básicos de Aprendizaje) del MEN Colombia, contextualizados a la cultura Wayuu de La Guajira.

**Architecture:** Módulos HTML/CSS/JS standalone en `edu-conect-rural-dashboard/out/modulos/`. Cada módulo es una carpeta con `index.html` + assets. Siguen el formato de los módulos existentes (gamificacion.js, educonect.css, progreso.js). Los módulos se sirven vía el servidor Rust Axum en `/modulos/<id>`.

**Tech Stack:** HTML5, CSS3 (responsive, dark/light mode), JavaScript vanilla, gamificacion.js, progreso.js, educonect.css.

**Formato de IDs:** Lenguaje = 10X (101-105 para 1°-5°), Matemáticas = 20X (201-205 para 1°-5°). Cada grado tiene ~4-5 submódulos (ej: Leng-101a, Leng-101b, etc.)

---

## Datos de Referencia

### DBA Lenguaje — Contenidos por Grado

| Grado | DBA Clave | Temas |
|-------|-----------|-------|
| **1°** | Produce textos orales, reconoce letras-sonidos, comprende textos cortos | Vocales, consonantes, sílabas, palabras, oraciones simples, descripción oral |
| **2°** | Lee y escribe textos cortos, identifica estructura narrativa | Narración, descripción, párrafo, signos de puntuación, familia de palabras |
| **3°** | Comprende textos informativos y literarios, produce textos con estructura | Cuento, fábula, texto informativo, adjetivos, verbos, sustantivos, sinónimos/antónimos |
| **4°** | Analiza textos literarios y no literarios, produce textos coherentes | Texto expositivo, noticia, poema, sujeto/predicado, conectores, ortografía |
| **5°** | Interpreta y produce diversos tipos de texto con sentido crítico | Texto argumentativo, reseña, cuento largo, reglas ortográficas, figuras literarias |

### DBA Matemáticas — Contenidos por Grado

| Grado | DBA Clave | Temas |
|-------|-----------|-------|
| **1°** | Cuenta, ordena, suma y resta con números hasta 99 | Números 0-99, valor posicional, suma/resta básica, figuras geométricas, medición simple |
| **2°** | Opera con números hasta 999, multiplica, reconoce fracciones básicas | Números hasta 999, multiplicación (tablas 1-5), fracciones 1/2, 1/3, 1/4, perímetro |
| **3°** | Opera con números hasta 9,999, división, fracciones, decimales básicos | Números hasta 9,999, multiplicación (tablas 6-9), división, fracciones, decimales, área |
| **4°** | Opera fracciones, decimales, unidades de medida, ángulos | Fracciones equivalentes, decimales, medidas de longitud/masa/capacidad, ángulos, probabilidad |
| **5°** | Razones, porcentajes, volumen, estadística básica | Razones y proporciones, porcentajes, volumen, media/mediana/moda, gráficos estadísticos |

### Contextualización Wayuu

Cada módulo debe incluir referencias culturales wayuu:
- **Conteo wayuu** (sistema numérico tradicional)
- **Tejidos** (patrones geométricos de mochilas y chinchorros)
- **Trueque** (intercambio, medidas tradicionales)
- **Animales del desierto** (chivo, iguana, burro, flamenco)
- **Plantas nativas** (cardón, trupillo, dividivi)
- **Wayuunaiki** (palabras básicas integradas)
- **Juegos tradicionales** (Yonna, soula, carrito de cardón)

---

## Tareas

### FASE 1: Lenguaje 1° — 5 módulos

#### Task 1: Crear estructura de módulos de Lenguaje
**Files:**
- Create: `edu-conect-rural-dashboard/out/modulos/leng-101/index.html` — Vocales y conciencia fonológica (1°)
- Create: `edu-conect-rural-dashboard/out/modulos/leng-102/index.html` — Lectoescritura inicial (1°-2°)
- Create: `edu-conect-rural-dashboard/out/modulos/leng-103/index.html` — Comprensión lectora y narración (2°-3°)
- Create: `edu-conect-rural-dashboard/out/modulos/leng-104/index.html` — Textos expositivos y poesía (4°)
- Create: `edu-conect-rural-dashboard/out/modulos/leng-105/index.html` — Argumentación y producción textual (5°)

**Cada módulo debe tener:**
- Título, objetivo de aprendizaje, contenido interactivo
- Ejercicios prácticos con feedback inmediato
- Audio TTS integrado (espeak-ng mbrola)
- Barra de progreso (gamificacion.js)
- Diseño responsive, dark/light mode
- Contextualización Wayuu (vocabulario en wayuunaiki, imágenes culturales)
- Pantalla de logro al completar

### FASE 2: Matemáticas 1° — 5 módulos

#### Task 2: Crear módulos de Matemáticas
**Files:**
- Create: `edu-conect-rural-dashboard/out/modulos/mate-201/index.html` — Conteo y números hasta 99 (1°)
- Create: `edu-conect-rural-dashboard/out/modulos/mate-202/index.html` — Suma, resta y multiplicación básica (2°)
- Create: `edu-conect-rural-dashboard/out/modulos/mate-203/index.html` — División, fracciones y decimales (3°)
- Create: `edu-conect-rural-dashboard/out/modulos/mate-204/index.html` — Geometría y medidas (4°)
- Create: `edu-conect-rural-dashboard/out/modulos/mate-205/index.html` — Razones, porcentajes y estadística (5°)

**Cada módulo debe tener:**
- Explicación visual con animaciones CSS
- Ejercicios interactivos (drag & drop, selección múltiple, completar)
- Problemas contextualizados al trueque, tejidos y pastoreo wayuu
- Barra de progreso
- Diseño responsive
- Audio TTS

### FASE 3: Integración y verificación

#### Task 3: Verificar integración con el dashboard
- Actualizar `out/modulos/index.html` (catálogo de módulos)
- Verificar que los módulos se renderizan correctamente
- Probar navegación entre módulos
- Verificar gamificacion.js funciona

---

## Estructura de cada módulo (plantilla)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Título del Módulo] - EduConect Rural</title>
  <link rel="stylesheet" href="../comun/educonect.css">
  <link rel="stylesheet" href="../comun/gamificacion.css">
  <style>
    /* Estilos específicos del módulo */
  </style>
</head>
<body>
  <div id="hud">...</div>
  <main>
    <section id="intro">
      <h1>[Título]</h1>
      <p class="objetivo">🎯 Aprenderé a [objetivo]</p>
      <button onclick="empezar()">Comenzar 🌟</button>
    </section>
    <section id="contenido" class="hidden">
      <!-- Contenido interactivo -->
    </section>
    <section id="logro" class="hidden">
      <div class="logro-card">🌟 ¡Logro obtenido!</div>
    </section>
  </main>
  <script src="../comun/gamificacion.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/party-js@latest/bundle/party.min.js"></script>
  <script>
    // Lógica del módulo
  </script>
</body>
</html>
```

---

## Criterios de Aceptación

- [ ] Cada módulo tiene contenido interactivo y educativo
- [ ] Contextualización Wayuu visible en cada módulo (mínimo 2 referencias culturales)
- [ ] Diseño responsive funciona en tablets (uso principal en escuelas rurales)
- [ ] TTS funcional (espeak-ng mbrola femenina)
- [ ] Barra de progreso y gamificación activa
- [ ] Sin dependencias externas (100% offline)
- [ ] Dark/light mode automático
- [ ] Pantalla de logro al completar
- [ ] Integración con el catálogo de módulos
