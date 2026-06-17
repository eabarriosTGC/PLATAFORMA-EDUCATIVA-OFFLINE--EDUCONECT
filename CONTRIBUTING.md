# 🤝 Contribuir a EduConect Rural

¡Gracias por querer contribuir! Este proyecto busca llevar educación offline a comunidades rurales, y cada aporte suma.

---

## 🚀 Primeros pasos

### 1. Fork y clone

```bash
git clone https://github.com/TU_USUARIO/PLATAFORMA-EDUCATIVA-OFFLINE--EDUCONECT.git
cd PLATAFORMA-EDUCATIVA-OFFLINE--EDUCONECT
```

### 2. Probar con Docker (recomendado)

```bash
docker compose up -d
# http://localhost:8080
```

### 3. Sin Docker

```bash
# Dependencias del sistema
sudo apt install -y yt-dlp ffmpeg espeak-ng

# Servidor Rust
cd edu-conect-rural-server
cargo build --release
./target/release/edu-conect-rural-server
```

---

## 📝 Áreas para contribuir

### Módulos educativos
Cada módulo es un `index.html` auto-contenido en `edu-conect-rural-dashboard/modulos/<id>/`.

```bash
# Ejemplo: crear módulo de geografía
mkdir -p edu-conect-rural-dashboard/modulos/geo-402/
# Crear index.html con el contenido
```

Usá los estilos compartidos: `modulos/comun/educonect.css`

### Código Rust
- **Backend**: `edu-conect-rural-server/src/` (Axum handlers, SQLite, ZIM)
- **Tests**: `edu-conect-rural-server/tests/`

```bash
cd edu-conect-rural-server
cargo test
cargo clippy
cargo fmt --check
```

### Frontend
- **Dashboard vanilla**: `edu-conect-rural-server/static/` (HTML/CSS/JS)
- **Dashboard Next.js**: `edu-conect-rural-dashboard/`

### Documentación
- README, CONTRIBUTING, guías de despliegue
- Traducciones al wayuunaiki

---

## 📋 Guía de estilo

### Commits
Usar commits semánticos:

```
feat: agregar módulo de astronomía wayuu
fix: thumbnail no se generaba para videos .webm
docs: actualizar endpoints API en README
docker: optimizar capas del Dockerfile
```

### Rust
- `cargo fmt` antes de commitear
- `cargo clippy` sin warnings
- Tests concurrentes con r2d2 pool

### HTML/CSS
- Paleta Wayuu (ver `paleta-wayuu.css`)
- Responsive (funciona en celulares)
- Alto contraste (accesibilidad infantil)

---

## 🐛 Reportar bugs

1. Usá [GitHub Issues](https://github.com/eabarriosTGC/PLATAFORMA-EDUCATIVA-OFFLINE--EDUCONECT/issues)
2. Incluí:
   - Qué esperabas que pasara
   - Qué pasó realmente
   - Cómo reproducirlo
   - Logs del servidor (`RUST_LOG=debug`)
   - Navegador/dispositivo usado

---

## 🧪 Tests

```bash
# Tests de integración (pool r2d2 concurrente)
cd edu-conect-rural-server
cargo test --test integration_test -- --nocapture

# Tests unitarios
cargo test

# Build Docker
docker build -t educonect-rural .
docker run -p 8080:8080 educonect-rural
```

---

## 📦 Pull Request

1. Creá una rama: `git checkout -b feature/mi-aporte`
2. Hacé commit de tus cambios
3. Push: `git push origin feature/mi-aporte`
4. Abrí un Pull Request contra `main`

**Checklist para PR:**
- [ ] El código compila sin warnings
- [ ] `cargo test` pasa
- [ ] `cargo fmt` aplicado
- [ ] `cargo clippy` sin errores
- [ ] Docker build funciona
- [ ] La documentación está actualizada

---

## 💬 ¿Dudas?

Abrí un [Discussion](https://github.com/eabarriosTGC/PLATAFORMA-EDUCATIVA-OFFLINE--EDUCONECT/discussions) o un Issue.

---

<div align="center">
  <p>🌵 <strong>EduConect Rural</strong> — Educación offline para La Guajira</p>
</div>
