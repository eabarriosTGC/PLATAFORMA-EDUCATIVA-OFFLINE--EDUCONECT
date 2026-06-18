# 📚 EduConect Rural — Educación Offline para La Guajira

**Plataforma educativa offline** para escuelas rurales sin internet. Corre en una Raspberry Pi / Orange Pi con Alpine Linux, y toda la familia y los estudiantes se conectan vía WiFi al servidor.

> 🌵 **Creado para La Guajira, Colombia — Comunidad Wayuu**
> Contenido contextualizado, bilingüe (español + wayuunaiki), accesible infantil.

---

## 🧠 ¿Qué es EduConect Rural?

EduConect Rural es un servidor educativo portátil que convierte cualquier computadora de bajo costo (Raspberry Pi, Orange Pi, laptop vieja) en un **punto de acceso educativo offline**. Los estudiantes se conectan con sus celulares, tablets o computadoras al WiFi del servidor y acceden a:

- 🎓 **Módulos educativos interactivos** — matemáticas, lenguaje, ciencias, cultura wayuu
- 📖 **Wikipedia offline** — enciclopedia completa sin internet
- 📘 **Wikilibros / Vikidia offline** — libros educativos para niños
- 📺 **Videos educativos** — descargados de YouTube y optimizados para redes lentas
- 📚 **Biblioteca digital** — libros PDF con visor progresivo
- 🧪 **Simulaciones PhET** — ciencia interactiva offline
- 📖 **Diccionario offline** — español + wayuunaiki + sinónimos (21,800+ entradas)
- 🎤 **Texto a Voz (TTS)** — lectura en voz alta con espeak-ng
- 📊 **Seguimiento de progreso** — profesores ven el avance de cada estudiante
- 🔒 **Panel admin** — gestión de contenido con JWT
- 📱 **PWA** — instalable como app en celulares

---

## 🏗️ Arquitectura

```
┌──────────────────────────────────────────────────────────────┐
│                     EduConect Rural                           │
│                                                              │
│  ┌─────────────────────┐    ┌─────────────────────────────┐  │
│  │   Rust/Axum Server  │    │   Next.js Dashboard (opc.)  │  │
│  │   (Puerto 8080)     │◄──►│   /app/ — Dashboard vanilla │  │
│  │                     │    │   /modulos/ — Módulos HTML  │  │
│  │  ┌───────────────┐  │    │   /biblioteca/ — PDFs       │  │
│  │  │  SQLite (WAL) │  │    │   /videos/ — MP4            │  │
│  │  │  + FTS5       │  │    │   /zim/ — Wikipedia offline │  │
│  │  └───────────────┘  │    └─────────────────────────────┘  │
│  │                     │                                     │
│  │  ┌───────────────┐  │    ┌─────────────────────────────┐  │
│  │  │  ZIM Library  │  │    │  Recursos del Sistema       │  │
│  │  │  (zim-rs)     │  │    │  • yt-dlp (descarga vids)   │  │
│  │  └───────────────┘  │    │  • ffmpeg (conversión)      │  │
│  │                     │    │  • espeak-ng (TTS)          │  │
│  │  ┌───────────────┐  │    └─────────────────────────────┘  │
│  │  │  Rate Limiter │  │                                     │
│  │  │  + Auth JWT   │  │    ┌─────────────────────────────┐  │
│  │  └───────────────┘  │    │  Dispositivos Cliente       │  │
│  └─────────────────────┘    │  • Celulares (PWA)          │  │
│                              │  • Tablets                  │  │
│                              │  • Laptops                  │  │
│                              │  • Smart TVs                │  │
│                              └─────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Tecnología | Propósito |
|---|---|---|
| **Servidor** | Rust + Axum + Tokio | Servidor web embebido ultra-eficiente |
| **Base de datos** | SQLite + r2d2 pool + FTS5 | Cursos, progreso, búsqueda full-text |
| **Wikipedia offline** | zim-rs (Rust puro) | Lector ZIM multi-archivo sin dependencias externas |
| **Dashboard** | Vanilla HTML/CSS/JS (sin React) | Interfaz responsive, tema desierto Wayuu |
| **Módulos educativos** | HTML/CSS/JS vanilla | 46+ módulos interactivos offline |
| **Frontend opcional** | Next.js + shadcn/ui | Dashboard alternativo con componentes |

---

## 🚀 Inicio Rápido

### Requisitos

| Componente | Mínimo | Recomendado |
|---|---|---|
| RAM | 512 MB | 1 GB |
| Almacenamiento | 8 GB SD | 32 GB SD |
| SO | Alpine Linux 3.20+ / Fedora / Ubuntu | Alpine Linux 3.21 |
| Rust | 1.80+ | 1.85+ |
| Dependencias | `yt-dlp`, `ffmpeg`, `espeak-ng` | — |

### 1. Instalar dependencias del sistema

```bash
# Alpine Linux
apk add yt-dlp ffmpeg espeak-ng

# Fedora
dnf install -y yt-dlp ffmpeg espeak-ng

# Ubuntu/Debian
apt install -y yt-dlp ffmpeg espeak-ng

# macOS
brew install yt-dlp ffmpeg espeak-ng
```

### 2. Compilar el servidor

```bash
cd edu-conect-rural-server

# Compilación optimizada (~12 MB, con LTO + strip)
cargo build --release

# Para Raspberry Pi con poca RAM:
CARGO_BUILD_JOBS=1 cargo build --release
```

### 3. Crear directorios de datos

```bash
mkdir -p data/videos data/contenido data/contenido/zim data/biblioteca
```

### 4. Compilar el dashboard Next.js (opcional)

```bash
cd ../edu-conect-rural-dashboard
npm install
npm run build
cd ..
```

### 5. Arrancar

```bash
cd edu-conect-rural-server
JWT_SECRET="mi-secreto-seguro-aqui" RUST_LOG=info \
  ./target/release/edu-conect-rural-server
```

> **IMPORTANTE:** Cambiá `JWT_SECRET` por un secreto seguro (generalo con `openssl rand -base64 64`)

Salida esperada:
```
🚀 Servidor EduConect Rural escuchando en http://0.0.0.0:8080
📁 Frontend estático servido desde: ../edu-conect-rural-dashboard/out/
🎥 Encoder H.264 seleccionado: libx264
Base de datos lista: data/educonect.db (pool r2d2, max_size=8)
📚 5 archivos ZIM cargados. Default: wikipedia_es_top
```

---

## 🌐 API Endpoints

### Públicos

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Landing page |
| GET | `/app/` | Dashboard principal |
| GET | `/health` | Health check |
| GET | `/api/cursos` | Listar cursos |
| GET | `/api/cursos/{id}` | Obtener curso |
| GET | `/api/modulos` | Listar módulos educativos |
| GET | `/api/biblioteca` | Catálogo biblioteca digital |
| GET | `/api/buscar?q=...` | Búsqueda full-text |
| POST | `/api/progreso` | Guardar progreso estudiante |
| GET | `/api/progreso/{usuario}` | Progreso de un estudiante |
| GET | `/api/videos` | Listar videos locales |
| POST | `/api/videos/descargar` | Descargar video (yt-dlp) |
| POST | `/api/videos/convertir` | Convertir video a H.264 |
| POST | `/api/videos/generar-thumbnails` | Generar thumbnails lote |
| GET | `/api/multimedia` | Simulaciones PhET disponibles |
| GET | `/api/tts?text=...` | Texto a voz (espeak-ng) |

### Diccionario Offline

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/diccionario/` | Página diccionario offline |
| GET | `/api/diccionario/buscar?q=...` | Buscar palabra |
| GET | `/api/diccionario/sugerir?q=...` | Autocompletado |
| GET | `/api/diccionario/palabra-dia` | Palabra aleatoria |

### Wikipedia Offline (ZIM)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/zim/` | Wikipedia offline |
| GET | `/zim/{path}` | Artículo específico |
| GET | `/api/wikipedia/search?q=...` | Búsqueda en ZIMs |
| GET | `/api/wikipedia/article?path=...` | Artículo completo |
| GET | `/api/wikipedia/zims` | Listar ZIMs disponibles |

### Panel Admin (protegido con JWT)

| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/login` | Autenticación (admin / admin123) |
| GET | `/admin/dashboard` | Dashboard admin |
| GET | `/admin/estadisticas` | Estadísticas del sistema |
| GET | `/admin/contenido/status` | Estado del contenido |
| POST | `/admin/contenido/cursos` | Crear curso |
| PUT | `/admin/contenido/cursos/{id}` | Editar curso |
| DELETE | `/admin/contenido/cursos/{id}` | Eliminar curso |
| POST | `/admin/contenido/videos` | Crear video |
| DELETE | `/admin/contenido/videos/{id}` | Eliminar video |

### Profesor

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/profesor/` | Panel profesor |
| GET | `/api/profesor/estudiantes` | Listar estudiantes |
| GET | `/api/profesor/progreso` | Progreso completo |
| GET | `/api/profesor/progreso/{usuario}` | Progreso por estudiante |
| GET | `/api/profesor/reporte` | Estadísticas docente |
| GET | `/api/profesor/exportar` | Exportar CSV |

---

## 📂 Estructura del Proyecto

```
Rust_rural/
├── edu-conect-rural-server/     ← Servidor Rust (Axum + Tokio)
│   ├── src/
│   │   ├── main.rs              ← Router, handlers, lógica principal
│   │   ├── lib.rs               ← Exposición pública para tests
│   │   ├── db.rs                ← SQLite + FTS5 + r2d2 pool
│   │   ├── models.rs            ← Tipos: Curso, Progreso, Auth, etc.
│   │   ├── auth.rs              ← JWT + middleware de autenticación
│   │   ├── rate_limit.rs        ← Rate limiter en memoria
│   │   ├── zim_proxy.rs         ← Lector ZIM multi-archivo (zim-rs)
│   │   └── content.rs           ← Gestión de archivos subidos
│   ├── static/
│   │   ├── index.html           ← Landing page
│   │   ├── dashboard.html       ← Dashboard vanilla HTML/CSS/JS
│   │   ├── dashboard.css        ← Estilos dashboard
│   │   ├── diccionario.html     ← Página diccionario offline
│   │   ├── videos.html          ← Galería de videos offline
│   │   ├── profesor.html        ← Panel del profesor
│   │   ├── paleta-wayuu.css     ← Tema de colores Wayuu
│   │   ├── js/                  ← 11 módulos JS (dashboard, api, etc.)
│   │   ├── sw.js                ← Service Worker (PWA)
│   │   ├── manifest.json        ← PWA manifest
│   │   └── app-icon.*           ← Iconos de la app
│   ├── migrations/              ← Migraciones SQLite
│   │   ├── 001_init.sql         ← Tablas base (cursos, progreso)
│   │   ├── 002_auth.sql         ← Tabla admin usuarios
│   │   ├── 003_content.sql      ← Tablas contenido (videos, archivos)
│   │   └── 004_search.sql       ← Índices FTS5
│   ├── seeds/                   ← Datos iniciales
│   │   ├── 001_cursos.sql       ← Cursos precargados
│   │   ├── 002_modulos.sql      ← Módulos educativos
│   │   ├── 005_biblioteca_fts.sql ← Biblioteca con FTS5
│   │   └── 006_diccionarios.sql ← 21,800 entradas (español + wayuunaiki)
│   ├── tests/
│   │   └── integration_test.rs  ← Tests concurrentes (r2d2 pool)
│   ├── Cargo.toml               ← Dependencias Rust
│   └── data/                    ← Datos runtime (videos, ZIMs, BD)
├── edu-conect-rural-dashboard/  ← Dashboard Next.js (opcional)
│   ├── app/                     ← Páginas Next.js
│   ├── components/              ← Componentes React + shadcn/ui
│   ├── lib/                     ← API client, types, state
│   ├── modulos/                 ← 46+ módulos educativos HTML
│   │   ├── leng-101..107        ← Lenguaje (7 módulos)
│   │   ├── mate-201..207        ← Matemáticas (7 módulos)
│   │   ├── cien-301..308        ← Ciencias (8 módulos)
│   │   ├── wayu-401..403        ← Cultura Wayuu (3 módulos)
│   │   ├── soc-601..602         ← Sociales (2 módulos)
│   │   └── ...                  ← 16+ módulos de vida práctica
│   │   └── phet/                ← 5 simulaciones PhET offline
│   │   └── puzzle-501/          ← Rompecabezas interactivo
│   │   └── quiz-601/            ← Cuestionario gamificado
│   │   └── mundo-3d-701/        ← Mundo 3D (Three.js)
│   │   └── comun/               ← CSS/JS compartidos, PDF.js
│   ├── public/                  ← Assets estáticos
│   └── styles/                  ← Estilos globales
├── start.sh                     ← Script de arranque
├── DEPLOY.md                    ← Guía de despliegue detallada
├── docs/                        ← Diarios de desarrollo y planes
└── README.md                    ← Este archivo
```

---

## 🎓 Módulos Educativos

46+ módulos interactivos 100% offline, organizados por categoría:

| Categoría | IDs | Temas |
|---|---|---|
| **Lenguaje** | leng-101 a 107 | Lectoescritura, cuentos Wayuu, gramática |
| **Matemáticas** | mate-201 a 207 | Números, geometría, fracciones, estadística |
| **Ciencias** | cien-301 a 308 | Biología, física, química, medio ambiente |
| **Cultura Wayuu** | wayu-401 a 403 | Lengua wayuunaiki, tradiciones, tejidos |
| **Salud/Nutrición** | sal-401, nut-401 | Higiene, alimentación saludable |
| **Finanzas** | fin-401 | Ahorro, presupuesto |
| **Arte/Música** | art-401, mus-401 | Expresión artística, música tradicional |
| **Deporte** | dep-401 | Educación física |
| **Inglés** | ing-401 | Inglés básico |
| **Naturaleza** | geo-401 | Geografía, clima |
| **Especiales** | puzzle-501, quiz-601, mundo-3d-701 | Gamificación, 3D |

Cada módulo es un HTML auto-contenido con CSS y JS embebidos, diseñado con:
- 🎨 **Paleta desierto Wayuu** — cálida, alto contraste, accesible
- 📱 **Responsive** — funciona en celulares, tablets y laptops
- 🎮 **Gamificación** — puzzles, quizzes, rewards
- 🔊 **TTS integrado** — lectura en voz alta con espeak-ng
- 📖 **PDF con visor progresivo** — libros completos sin recargar

---

## 📖 Wikipedia Offline (ZIM)

El servidor incluye un **lector ZIM nativo en Rust puro** (sin kiwix-serve, sin dependencias externas).

### Cómo agregar ZIMs

```bash
# 1. Descargar archivos .zim desde Kiwix
mkdir -p data/contenido/zim
cd data/contenido/zim

# Wikipedia en español (347K artículos, ~27 GB con imágenes)
wget https://download.kiwix.org/zim/wikipedia/wikipedia_es_all_maxi_2025-12.zim

# Vikidia para niños (~12 MB, sin imágenes)
wget https://download.kiwix.org/zim/vikidia/vikidia_es_all_nopic_2025-12.zim

# Wikilibros (~200 MB)
wget https://download.kiwix.org/zim/wikibooks/wikibooks_es_all_nopic_2025-10.zim

# 2. Reiniciar el servidor (detecta ZIMs automáticamente)
```

El servidor soporta **múltiples ZIMs simultáneamente** y los clasifica automáticamente:
- `wikipedia_es_top` — Wikipedia ES (Top), por defecto
- `wikipedia_es_physics` — Física
- `wikipedia_es_climate` — Cambio Climático
- `vikidia_es` — Vikidia (enciclopedia infantil)
- `wikibooks_es` — Wikilibros (libros de texto)

---

## 🎬 Videos Offline

```bash
# Descargar desde YouTube (requiere yt-dlp)
curl -X POST http://localhost:8080/api/videos/descargar \
  -H 'Content-Type: application/json' \
  -d '{"url": "https://youtube.com/watch?v=...", "quality": "720"}'

# Calidades disponibles: "best", "720" (default), "480"

# Convertir video a H.264 optimizado
curl -X POST http://localhost:8080/api/videos/convertir \
  -H 'Content-Type: application/json' \
  -d '{"filename": "mi_video.mp4"}'

# Generar thumbnails para todos los videos
curl -X POST http://localhost:8080/api/videos/generar-thumbnails
```

---

## 📚 Biblioteca Digital

Colocá archivos PDF en `data/biblioteca/` y aparecen automáticamente en la biblioteca. El visor PDF.js progresivo permite leer libros completos sin recargar.

---

## 🔐 Panel de Administración

1. Abrí `http://<ip>:8080/admin/login`
2. Credenciales por defecto: `admin` / `admin123`
3. **Cambiá la contraseña en producción**

El panel permite:
- Ver estadísticas del sistema
- Gestionar cursos (CRUD)
- Gestionar videos
- Subir archivos (hasta 100 MB)

---

## 🎤 Texto a Voz (TTS) Offline

Sin Python, sin APIs externas — usa `espeak-ng` nativo desde Rust:

```
GET /api/tts?text=Hola%20mundo&rate=150
```

Parámetros: `text` (obligatorio), `rate` (80-350, default 150)

---

## 📱 PWA (Progressive Web App)

La plataforma es instalable como app en cualquier celular:
1. Abrí `http://<ip>:8080/` en Chrome/Edge
2. Tocá "Instalar app" o "Agregar a pantalla de inicio"
3. Funciona sin conexión (Service Worker con caché)

---

## 🧪 Tests

```bash
cd edu-conect-rural-server
cargo test --test integration_test -- --nocapture
```

Incluye tests de:
- ✅ 10 lecturas concurrentes sin deadlocks
- ✅ 10 escrituras concurrentes (upsert)
- ✅ 5 lecturas + 3 escrituras concurrentes
- ✅ Autenticación JWT (creación, decodificación, tokens inválidos)
- ✅ bcrypt hash y verificación
- ✅ Rate limiter (límite, claves independientes, concurrencia)

---

## ⚙️ Variables de Entorno

| Variable | Default | Descripción |
|---|---|---|
| `DB_PATH` | `data/educonect.db` | Ruta a la base de datos SQLite |
| `FRONTEND_PATH` | `../edu-conect-rural-dashboard/out/` | Ruta al frontend estático |
| `LISTEN_ADDR` | `0.0.0.0:8080` | Dirección y puerto |
| `JWT_SECRET` | `educonect-rural-dev-secret` | ⚠️ **CAMBIAR EN PRODUCCIÓN** |
| `RUST_LOG` | `info` | Nivel de logs |

---

## 📦 Despliegue como Servicio systemd

```ini
[Unit]
Description=EduConect Rural — Plataforma Educativa Offline
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/educonect/edu-conect-rural-server
ExecStart=/home/pi/educonect/edu-conect-rural-server/target/release/edu-conect-rural-server
Environment=DB_PATH=/home/pi/educonect/data/educonect.db
Environment=FRONTEND_PATH=/home/pi/educonect/edu-conect-rural-dashboard/out
Environment=LISTEN_ADDR=0.0.0.0:8080
Environment=JWT_SECRET=CAMBIA_ESTO_POR_TU_SECRETO_REAL
Environment=RUST_LOG=info
Restart=always
RestartSec=10
MemoryMax=256M

[Install]
WantedBy=multi-user.target
```

---

## 🔧 Agregar Contenido

### Agregar un módulo educativo nuevo

1. Creá una carpeta en `edu-conect-rural-dashboard/modulos/` con un `index.html`
2. Usá los estilos compartidos de `modulos/comun/educonect.css`
3. Agregá la referencia en la base de datos (seed SQL) para que aparezca en el catálogo
4. ¡Listo! Aparece automáticamente en `/modulos/`

### Agregar un libro PDF

1. Copiá el PDF a `data/biblioteca/`
2. Agregá la entrada en la tabla `biblioteca` de SQLite (con título, descripción, categoría)
3. Reconstruí el índice FTS5 o reiniciá el servidor

### Agregar videos

```bash
# Opción 1: copiar archivos MP4 directamente a data/videos/
cp mi_video.mp4 edu-conect-rural-server/data/videos/

# Opción 2: descargar desde YouTube (ver sección de videos)
# Opción 3: convertir con ffmpeg desde otro formato
```

---

## 🗑️ Quitar Contenido

### Quitar módulo educativo
```bash
rm -rf edu-conect-rural-dashboard/modulos/mi-modulo/
# Opcional: eliminar referencia de la BD
```

### Quitar video
```bash
rm edu-conect-rural-server/data/videos/mi_video.mp4
rm edu-conect-rural-server/data/videos/mi_video.mp4.thumb.jpg  # thumbnail
```

### Quitar ZIM (Wikipedia offline)
```bash
rm edu-conect-rural-server/data/contenido/zim/mi_zim.zim
# Se actualiza solo al reiniciar el servidor
```

### Quitar libro de la biblioteca
```bash
rm data/biblioteca/mi_libro.pdf
# Opcional: eliminar entrada de la tabla biblioteca en SQLite
```

---

## 🤝 Cómo Contribuir

1. Forkeá el repo
2. Creá una rama (`git checkout -b feature/nueva-funcionalidad`)
3. Hacé commit de tus cambios
4. Push a la rama (`git push origin feature/nueva-funcionalidad`)
5. Abrí un Pull Request

### Áreas para contribuir
- 📝 **Nuevos módulos educativos** — especialmente en wayuunaiki y ciencias
- 🌐 **Traducciones** — wayuunaiki, inglés
- 🐛 **Reporte de bugs** — abrí un Issue
- 💡 **Ideas** — mejores prácticas pedagógicas offline
- 🔧 **Optimizaciones** — rendimiento en Raspberry Pi, compresión de contenido

---

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **Rust** | Servidor backend (Axum, Tokio) |
| **SQLite** | Base de datos embebida (r2d2 pool, FTS5) |
| **zim-rs** | Lector ZIM Wikipedia offline (Rust puro) |
| **JWT + bcrypt** | Autenticación admin segura |
| **Next.js** | Dashboard opcional con shadcn/ui |
| **Vanilla HTML/CSS/JS** | Dashboard principal, módulos educativos |
| **PDF.js** | Visor de PDF progresivo |
| **Three.js** | Módulo 3D interactivo |
| **PhET** | Simulaciones científicas offline |
| **yt-dlp** | Descarga de videos educativos |
| **ffmpeg** | Conversión y optimización de videos |
| **espeak-ng** | Texto a voz offline (sin Python) |
| **Service Worker** | PWA instalable en celulares |

---

## ⚔️ ¿En qué se diferencia de otras plataformas?

EduConect Rural no es otra copia de Kolibri, IIAB o Kiwix. Es la **única plataforma educativa offline** con estas características:

| Diferencia Clave | EduConect Rural | Alternativas (IIAB, Kolibri, RACHEL, Kiwix) |
|---|---|---|
| **Stack tecnológico** | 🦀 **Rust puro** — 1 binario de ~12 MB, 0 dependencias runtime | 🐍 Python (500 MB+, docenas de archivos, pip, virtualenv) |
| **Contenido wayuunaiki** | ✅ Diccionario bilingüe + módulos culturales Wayuu | ❌ Ninguna lo tiene |
| **Instalación** | `./edu-conect-rural-server` y listo | 8-12 pasos (pip, npm, config, migraciones) |
| **Agregar contenido** | Creás 1 HTML en 1 carpeta — sin internet | Dependen de catálogos externos (Kolibri Studio, Ansible) |
| **Rendimiento** | Corre en **Pi Zero 512 MB** (~15 MB RAM) | Se cuelgan o requieren 2 GB+ |
| **API REST** | 40+ endpoints con JSON, JWT, rate limiting | Solo HTML o APIs limitadas |
| **TTS + Diccionario + PhET** | Todo nativo, sin servicios externos | Cada cosa requiere un servicio aparte |
| **Contexto local** | Hecho para La Guajira, Colombia | Contenido global genérico (inglés primero) |

> 📖 **Comparativa completa:** [`docs/comparativa-alternativas.md`](docs/comparativa-alternativas.md)
> Con tablas detalladas de tecnología, rendimiento, contenido y casos de uso.

---

## 📄 Licencia

**Uso educativo libre.** Creado para comunidades rurales de La Guajira, Colombia.

---

## 🙌 Créditos

- **Universidad de La Guajira** — investigación etnoeducativa
- **Comunidad Wayuu** — saberes ancestrales y lengua wayuunaiki
- **PhET Interactive Simulations** — University of Colorado Boulder
- **Kiwix** — archivos ZIM de Wikipedia offline

---

<div align="center">
  <p>🌵 <strong>EduConect Rural</strong> — Llevando educación a donde no llega internet</p>
  <p>Hecho con ❤️ para La Guajira, Colombia</p>
</div>
