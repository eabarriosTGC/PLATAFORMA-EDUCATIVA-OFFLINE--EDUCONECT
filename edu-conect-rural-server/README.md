# EduConect Rural — Servidor Backend

Plataforma educativa offline para La Guajira, Colombia.
Corre en Raspberry Pi / Orange Pi como punto de acceso WiFi.
Sirve frontend estático + API REST + SQLite + autenticación JWT + gestor de contenido.

## Stack

| Componente | Tecnología |
|---|---|
| Lenguaje | Rust (edition 2021) |
| HTTP Framework | Axum 0.8 |
| Base de datos | SQLite (rusqlite bundled) |
| Autenticación | JWT (jsonwebtoken) + bcrypt |
| Frontend | Next.js 16 static export |
| Archivos estáticos | tower-http (ServeDir) |

## Rutas API

### Públicas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/` | Redirige a `/index.html` |
| `GET` | `/api/cursos` | Lista todos los cursos |
| `GET` | `/api/cursos/{id}` | Detalle de un curso |
| `POST` | `/api/progreso` | Guarda progreso de estudiante |
| `GET` | `/api/progreso/{usuario}` | Progreso de un estudiante |
| `/*` | (estáticos) | Frontend compilado |

### Admin (protegidas con JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/admin/login` | Login (pública) |
| `GET` | `/admin/dashboard` | Panel administrativo |
| `GET` | `/admin/estadisticas` | Estadísticas del sistema |

### Gestor de Contenido (protegidas con JWT)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/contenido/status` | Estadísticas de contenido |
| `POST` | `/admin/contenido/cursos` | Crear curso |
| `PUT` | `/admin/contenido/cursos/{id}` | Editar curso |
| `DELETE` | `/admin/contenido/cursos/{id}` | Eliminar curso |
| `POST` | `/admin/contenido/videos` | Crear video |
| `DELETE` | `/admin/contenido/videos/{id}` | Eliminar video |
| `GET` | `/admin/contenido/archivos` | Listar archivos |

## Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `DB_PATH` | `data/educonect.db` | Ruta SQLite |
| `FRONTEND_PATH` | `../edu-conect-rural-dashboard/out/` | Frontend estático |
| `LISTEN_ADDR` | `0.0.0.0:8080` | Dirección y puerto |
| `JWT_SECRET` | *(default desarrollo)* | Secreto JWT |
| `RUST_LOG` | `info` | Nivel de logging |

## Tests

```bash
cargo test
# 13 tests: 6 auth + 7 DB
```

## Compilación ARM

```bash
docker run --rm -v $(pwd):/home/rust/src -w /home/rust/src \
  messense/rust-musl-cross:aarch64-musl cargo build --release
```

## Licencia

MIT
