# EduConect Rural — Sesión 03 Jun 2026

## Resumen de todo lo desarrollado hoy

---

## 🎯 Módulos nuevos (7 módulos implementados)

### 📖 Lenguaje 1° Grado

| # | Módulo | ID | Archivos | Estado |
|---|--------|-----|----------|--------|
| M5 | Rana Dardo Dorada 3D | 104 | modulo-rana/ (4 files) | ✅ Bug corregido |
| M6 | La Ostra y el Ratón Pérez | 105 | modulo-raton-perez/ (4 files) | ✅ |
| M7 | El Caracol Rímador | 106 | modulo-caracol/ (4 files) | ✅ |
| M8 | Mirringa Mirronga (FINAL) | 107 | modulo-mirringa/ (4 files) | ✅ |

### 🧮 Matemáticas 1° Grado (3 guías de Escuela Nueva)

| # | Módulo | ID | Guía | Archivos | Estado |
|---|--------|-----|------|----------|--------|
| M9 | Conteo Wayuu | 200 | 1-2 | modulo-conteo-wayuu/ (3 files) | ✅ |
| M10 | Cangrejitos Matemáticos | 201 | 3-5 | modulo-cangrejitos/ (3 files) | ✅ |
| M11 | Tejidos y Formas Wayuu | 202 | 7 | modulo-geometria/ (3 files) | ✅ |

### 🌿 Ciencias

| Módulo | Archivos | Estado |
|--------|----------|--------|
| Ciclo del Agua 3D | modulo1-agua/ | ✅ (ya existía) |

---

## 🔧 Mejoras de infraestructura

### Sistema de Audio (TTS)
- **Problema**: `speechSynthesis` sonaba robótico sin voces en Linux
- **Solución**: Servidor TTS Python con espeak-ng + voz femenina mbrola-3
  - `tts_server.py` — servidor HTTP en puerto 8081
  - `start.sh` — script para arrancar Rust + TTS juntos
  - `gamificacion.js` actualizado con fallback al servidor TTS
- **Flujo**: Browser → intenta speechSynthesis → si falla → llama a :8081/tts → reproduce WAV

### Archivos comunes nuevos
- `comun/personajes_mat.js` — Alejo y Mariana (personajes Wayuu para matemáticas)
- `comun/gamificacion.js` — mejorado con selector de voces + servidor TTS

---

## 📊 Estado final del proyecto

```
49 archivos · 1.3 MB · 11 módulos activos
100% offline · 0 dependencias externas · 0 líneas Rust modificadas
```

### IDs asignados

| Rango | Área | Módulos |
|-------|------|---------|
| 100-107 | Lenguaje 1° | M1 a M8 |
| 200-202 | Matemáticas 1° | M9 a M11 |

### Estructura del directorio

```
edu-conect-rural-dashboard/out/modulos/
├── index.html              ← Galería unificada (3 secciones)
├── comun/
│   ├── educonect.css       ← Estilos base
│   ├── gamificacion.js     ← Puntos, sonidos, logros, TTS
│   ├── progreso.js         ← API de progreso
│   ├── animales-svg.js     ← SVGs de animales
│   ├── personajes_mat.js   ← Alejo/Mariana Wayuu + mochilas
│   ├── three.min.js        ← Three.js r128 (592 KB)
│   └── animaciones.css     ← Estilos compartidos
├── modulo-vocales/         ← M1 (100)
├── modulo-mili/            ← M2 (101)
├── modulo-lagarto/         ← M3 (102)
├── modulo-pintor/          ← M4 (103)
├── modulo-rana/            ← M5 (104) — 3D, bug corregido
├── modulo-raton-perez/     ← M6 (105)
├── modulo-caracol/         ← M7 (106)
├── modulo-mirringa/        ← M8 (107) — Diploma 1° grado
├── modulo-conteo-wayuu/    ← M9 (200) — Math
├── modulo-cangrejitos/     ← M10 (201) — Math
├── modulo-geometria/       ← M11 (202) — Math
└── modulo1-agua/           ← Ciencias 2°
```

---

## 🐛 Bugs corregidos hoy

1. **Rana 3D no aparecía** (`escena3d.js`): `.position.set()` encadenado — retornaba Vector3 en vez del Mesh. Arreglado en 6 lugares.
2. **Constructor de Figuras no respondía** (`geometria.js`): solo evento `click`, sin soporte táctil. Arreglado con `pointerdown` + `touch-action:none` + radio 28px.

---

## 🚀 Cómo arrancar el proyecto mañana

```bash
# Opción 1: Script unificado (Rust + TTS)
bash /home/trabajo/ai-startup/Rust_rural/start.sh

# Opción 2: Manual
# Terminal 1 — Servidor TTS (puerto 8081)
python3 /home/trabajo/ai-startup/Rust_rural/tts_server.py &

# Terminal 2 — Servidor Rust (puerto 8080)
cd /home/trabajo/ai-startup/Rust_rural/edu-conect-rural-server
FRONTEND_PATH=../edu-conect-rural-dashboard/out/ LISTEN_ADDR=0.0.0.0:8080 cargo run --release
```

Acceso: `http://localhost:8080/modulos/`

---

## 📋 Pendientes para mañana

### Matemáticas (Guías faltantes)
- [ ] **Guía 6**: La tienda de la escuela (problemas con monedas)
- [ ] **Guía 8**: La yuca y la ahuyama (medición: largo, peso, capacidad)

### Posibles mejoras
- [ ] Módulos de Ciencias Naturales 1° (animales, plantas, cuerpo humano)
- [ ] Módulos de Sociales 1° (familia, escuela, comunidad Wayuu)
- [ ] Módulos de 2° grado (Lenguaje y Matemáticas)

### Infraestructura
- [ ] Hacer que `start.sh` detecte automáticamente si el TTS ya está corriendo
- [ ] Agregar más voces de espeak-ng (es-MX, es-CO)
- [ ] Empaquetar para distribución offline (Raspberry Pi)

---

## 🔑 Datos técnicos importantes

- **Ruta del proyecto**: `/home/trabajo/ai-startup/Rust_rural/`
- **Frontend (módulos)**: `edu-conect-rural-dashboard/out/modulos/`
- **Backend Rust**: `edu-conect-rural-server/` (sin modificar desde el inicio)
- **TTS Server**: `tts_server.py` (puerto 8081, voz mbrola-3 femenina)
- **Perfil Hermes**: `default`
- **Convención IDs módulos**: Lenguaje=1xx, Matemáticas=2xx, Ciencias=3xx
- **Sistema de skills**: `~/.hermes/skills/` (tiene educonect-modulos, multi-agente-pipeline, etc.)
