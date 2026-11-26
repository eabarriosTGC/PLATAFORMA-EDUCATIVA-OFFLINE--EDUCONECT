# Entorno de compilación reproducible — Sprint 2

**Pasos 1 a 6 del procedimiento, sin modificar `Cargo.toml`, `main.rs` ni `config.rs`.**

| Dato | Valor |
|---|---|
| Commit | `a27adec` (`a27adec49a9f7d181708d0474e51d2608fa604d2`) |
| Rama | `fix/portable-runtime-baseline` |
| Imagen de ejecución de referencia | `768ca06704d7` |
| Base de compilación | `debian:bookworm-slim` |
| Imagen de desarrollo | `educonect-dev-env-dev:latest` · ID `249d08fffca7` |
| Arquitectura | `amd64` (x86_64), Docker driver `overlayfs`, 18 CPUs, 16 GB |
| Rust / Cargo | `rustc 1.88.0 (6b00bc388 2025-06-23)` · `cargo 1.88.0 (873a06493 2025-05-10)` |
| Version de Rust | Fijada a **1.88.0**, derivada de `Dockerfile:7` (`rust:1.88-slim-bookworm`). No se usa `stable` |
| Clang | 14.0.6 |
| libzim del entorno | 8.1.1 (`pkg-config`) |
| sqlite3 del entorno | 3.40.1 |
| Compilación | **PASS** — `Finished dev profile ... in 35.22s`, exit 0 |
| `cargo metadata --locked` | **PASS** — `METADATA_OK` |
| Dependencias faltantes en `ldd` | **Ninguna** |
| Cambios de código | **Ninguno** — verificado con `git status` al terminar |

> **Vigencia (T9).** La receta de **compilación cruzada para Windows** ya está en el repositorio: `docker/windows/Dockerfile.win` y `docker/windows/compose.yaml` (servicio `win`). Todo lo que este documento registra sobre `dev`, `nodev` y `lockfile` sigue viviendo fuera del repositorio y no cambió en esta unidad; §8.1 documenta la receta versionada y cómo se reproduce desde un clon.

---

## 1. Correcciones al procedimiento original

El procedimiento entregado no habría sido reproducible tal cual. Cuatro correcciones aplicadas:

| # | Problema | Corrección |
|---|---|---|
| 1 | `RUST_VERSION` tratada como valor a acordar | El proyecto ya la fija: `Dockerfile:7` → `rust:1.88-slim-bookworm`. Se usa `1.88.0` |
| 2 | `cd /workspace && cargo build` | **No hay `Cargo.toml` en la raíz del repo.** El manifiesto y `Cargo.lock` viven en `edu-conect-rural-server/`. Todos los comandos entran a ese directorio |
| 3 | Binario esperado `educonetv2-educonect` | El ejecutable es `edu-conect-rural-server`. `educonetv2-educonect` es el nombre del contenedor |
| 4 | Archivo `.env` con `RUST_VERSION` y `EDUCONNECT_REPO` | Bloqueado por política de seguridad del entorno. Las variables se exportan en el shell del trabajo. No existe archivo de entorno y no hay secretos involucrados |

Se agregaron al `Dockerfile` los componentes `rustfmt` y `clippy`, porque el CI del proyecto los exige (`.github/workflows/ci.yml`). Sin ellos, la validación de estilo falla por ausencia de herramienta, no por código.

---

## 2. Entorno

```dockerfile
FROM debian:bookworm-slim
ARG RUST_VERSION                      # 1.88.0
ENV CARGO_TARGET_DIR=/opt/target

apt: build-essential pkg-config cmake clang libclang-dev libssl-dev
     libsqlite3-dev libzim-dev libxapian-dev libicu-dev
     ca-certificates curl git file binutils

rustup: --profile minimal --default-toolchain 1.88.0
        + rustup component add rustfmt clippy
```

Motivo de cada grupo de bibliotecas:

| Biblioteca | Motivo |
|---|---|
| `libzim-dev`, `libxapian-dev`, `libicu-dev` | Reproducir la compilación **actual**, donde ZIM es obligatorio. Es la línea base contra la que se medirá D-01 |
| `libsqlite3-dev` | `rusqlite` usa `features = ["bundled"]` y compila su propio SQLite; la del sistema queda disponible para `r2d2_sqlite` o futuras features |
| `libssl-dev`, `pkg-config` | Descubrimiento de dependencias nativas |
| `clang`, `libclang-dev` | `cxx` genera bindings C++ para `zim-sys` |

Montaje del código en **solo lectura** (`read_only: true`). Resultado: la compilación completa se ejecutó sin que Cargo pudiera escribir en el repositorio. `git status` al terminar no muestra cambios de código. El montaje de solo lectura es seguro para este proyecto.

Volúmenes Docker para `registry`, `git` y `target`: la caché sobrevive entre ejecuciones sin tocar el anfitrión.

---

## 3. Resultados de compilación

```
cargo metadata --locked --format-version 1   → METADATA_OK
cargo build --locked                          → Finished `dev` profile in 35.22s   (exit 0)
```

Sin errores de `pkg-config`, sin errores de enlace, sin advertencias que impidieran compilar. La línea base compila limpia en Debian Bookworm con Rust 1.88.0.

---

## 4. Auditoría del binario

```
/opt/target/debug/edu-conect-rural-server:
ELF 64-bit LSB pie executable, x86-64, dynamically linked,
interpreter /lib64/ld-linux-x86-64.so.2, with debug_info, not stripped
```

Perfil `dev`: con símbolos, sin optimizar. La medición de dependencias es la misma que en `release`; lo que cambia es el tamaño.

### Dependencias dinámicas resueltas

| Biblioteca | Origen | ¿Desaparece si ZIM deja de enlazarse? |
|---|---|---|
| `libc.so.6` | base del sistema | No — siempre necesaria |
| `libm.so.6` | base del sistema | No |
| `libgcc_s.so.1` | runtime de Rust/C++ | No |
| `libstdc++.so.6` | runtime C++ | No (queda por `cxx`/otras deps) |
| **`libzim.so.8`** | **ZIM** | **Sí, seguro** |
| **`libxapian.so.30`** | dependencia de libzim | **Sí, seguro** |
| **`libicui18n.so.72`** | dependencia de libzim | **Sí, seguro** (verificado: `ldd libzim.so.8`) |
| **`libicuuc.so.72`** | dependencia de libzim | **Sí, seguro** |
| **`libicudata.so.72`** | dependencia de libzim | **Sí, seguro** |
| `libuuid.so.1` | dependencia de libzim | Probable — confirmar en la comparación |
| `liblzma.so.5` | dependencia de libzim | Probable — confirmar |
| `libzstd.so.1` | dependencia de libzim | Probable — confirmar |
| `libz.so.1` | dependencia de libzim | Probable — confirmar |

Verificación de atribución: `ldd /lib/x86_64-linux-gnu/libzim.so.8` enumera exactamente `icu*72`, `xapian.30`, `lzma.5`, `uuid.1`, `z.1`, `zstd.1`. **Cinco bibliotecas son atribuibles a ZIM con certeza; cuatro más son sus dependencias directas.** La comparación con y sin feature (D-01) dará el número exacto.

**Balance:** 15 entradas en `ldd`. Entre 5 y 9 son de ZIM. En un binario que debería depender solo de la libc y el runtime de Rust, esa cadena es la diferencia entre un paquete portable y un paquete que solo arranca en Debian bookworm.

---

## 5. Árbol de dependencias de ZIM

```
zim-rs v0.1.1
└── edu-conect-rural-server v0.1.0        ← dependencia directa, única

zim-rs v0.1.1
├── cxx v1.0.194  (proc-macro, build-deps: cc, cxxbridge-flags)
└── zim-sys v0.1.0
    └── cxx v1.0.194
```

Hallazgo decisivo, en `zim-sys/build.rs`:

```rust
let libzim = pkg_config::probe_library("libzim").unwrap();
```

`zim-sys` busca `libzim` con `pkg-config` **en tiempo de compilación** y hace `unwrap()`. Si `libzim` no está presente, la compilación **falla con pánico**, no degrada. Consecuencia directa: hoy es imposible compilar EDUConect en Windows sin instalar libzim, xapian e ICU con `pkg-config`. No es un problema de empaquetado; es una dependencia dura de compilación.

Confirmado además: **el crate `zim v0.4.0` no aparece en el árbol compilado.** Es una dependencia opcional sin feature asociada que nadie activa. Retirarla no cambia el binario.

---

## 6. Qué prueba y qué no prueba esta línea base

**Prueba:**

- La línea base compila de forma reproducible en Debian Bookworm con Rust 1.88.0.
- El enlace resuelve todas sus dependencias en ese entorno.
- El montaje de solo lectura no interfiere con la compilación.
- La cadena nativa de ZIM está presente y es identificable.
- El crate `zim 0.4.0` es muerto.

**No prueba:**

- **Portabilidad.** Un binario que resuelve sus dependencias en Debian no es portable. Es exactamente el error que el procedimiento advierte y que se confirma aquí.
- **Que D-01 elimine las dependencias.** Requiere implementar la feature y comparar `ldd`.
- **Que funcione fuera de Docker.** Sigue pendiente; ahora es posible porque existe un binario compilable en un entorno conocido.
- **Windows.** Sin verificar.

---

## 7. Definition of Done — entorno de desarrollo

| Criterio | Estado |
|---|---|
| Docker Bookworm construye correctamente | **Cumplido** |
| Toolchain Rust fijado y documentado | **Cumplido** — 1.88.0, derivado de `Dockerfile:7` |
| Dependencias nativas documentadas | **Cumplido** — §2 |
| `cargo build --locked` ejecutado | **Cumplido** |
| `cargo test --locked` ejecutado | **Pendiente** — fuera del alcance de «pasos 1 a 6» por instrucción |
| Dependencias dinámicas registradas | **Cumplido** — §4 |
| Artefactos y logs conservados | **Cumplido** — `docs/sprint2/` |
| Ningún archivo del proyecto alterado | **Cumplido** — verificado con `git status` |

La prueba de los tres CWD pertenece a la DoD de D-03, no a esta. Se ejecutará sobre un paquete generado.

---

## 8. Cómo reproducirlo

### 8.1 Compilación cruzada Windows — receta en el repositorio

La receta que produce `edu-conect-rural-server.exe` para `x86_64-pc-windows-gnu` está versionada, con `RUST_VERSION` fijada a **1.88.0** por defecto:

| Archivo | Qué aporta |
|---|---|
| `docker/windows/Dockerfile.win` | `debian:bookworm-slim` + `gcc-mingw-w64-x86-64` + target `x86_64-pc-windows-gnu`. **Sin** `libzim-dev`, `libxapian-dev` ni `libicu-dev` |
| `docker/windows/compose.yaml` | servicio `win`; monta el repositorio en `/workspace` en **solo lectura**; proyecto `educonect-win-cross`, volúmenes `cargo-*-win` propios |

Desde un clon, **sin ningún directorio del HOME**:

```bash
export RUST_VERSION=1.88.0
export EDUCONNECT_REPO=$(git rev-parse --show-toplevel)   # opcional: por omisión `../..`, la raíz del repo

timeout 900 docker compose -f docker/windows/compose.yaml build win
timeout 900 docker compose -f docker/windows/compose.yaml run -T --rm win bash -lc \
  'cd /workspace/edu-conect-rural-server && cargo build --locked --release --target x86_64-pc-windows-gnu'
```

Artefacto: volumen `educonect-win-cross_cargo-target-win`, ruta `/opt/target/x86_64-pc-windows-gnu/release/edu-conect-rural-server.exe`. Los seis controles (receta, compilación, formato PE, importaciones, `cargo tree` y arranque bajo Wine) los ejecuta, también desde el repositorio solo:

```bash
timeout 1500 ./edu-conect-rural-server/tests/win-cross-build.sh
```

Corrida de referencia de esta unidad, sobre una copia limpia del repositorio en `/tmp`: exit 0, **6 PASARON / 0 FALLARON / 0 NO EJECUTADAS**, imagen construida y `cargo build` completo desde target vacío en `2m 04s`, 0 warnings, 0 errores, artefacto de 9 279 488 bytes. Evidencia y advertencias: `docs/sprint2/win-cross-build.md`.

### 8.2 Línea base de desarrollo (receta externa, sin cambios)

Los servicios `dev`, `nodev` y `lockfile` **siguen fuera del repositorio** (receta del operador); esta unidad no los movió ni los copió. Órdenes tal como se registraron:

```bash
export RUST_VERSION=1.88.0
export EDUCONNECT_REPO=/home/x/Documentos/EduconetV2
cd ~/educonect-dev-env

docker compose build --no-cache
docker compose run -T --rm dev bash -lc 'rustc --version; cargo --version'
docker compose run -T --rm dev bash -lc \
  'cd /workspace/edu-conect-rural-server && cargo metadata --locked --format-version 1 >/dev/null && echo METADATA_OK'
docker compose run -T --rm dev bash -lc \
  'cd /workspace/edu-conect-rural-server && cargo build --locked'
docker compose run -T --rm dev bash -lc \
  'file /opt/target/debug/edu-conect-rural-server; ldd /opt/target/debug/edu-conect-rural-server'
```

Logs en `docs/sprint2/`: `build-image.log`, `versions.log`, `build-baseline.log`, `ldd-baseline.log`, `cargo-tree.log`.

---

## 9. Dos imágenes, dos propósitos

| Imagen | Propósito | Qué NO demuestra |
|---|---|---|
| **Desarrollo** (`educonect-dev-env-dev`) | Compilar, probar, auditar enlaces | Que el paquete sea portable |
| **Cross-compilación Windows** (`educonect-win-cross-win`, **versionada en `docker/windows/`**) | Producir el `.exe` para `x86_64-pc-windows-gnu` | Que el `.exe` corra en Windows: la imagen no trae Wine y no ejecuta su propio artefacto |
| **Distribución** (el paquete `APP_ROOT` + `DATA_DIR` de D-03) | Cómo se instala en un colegio | Nada, hasta que se pruebe en Linux y Windows |

No se usará la imagen de desarrollo como evidencia de portabilidad. Son objetivos distintos y confundirlos es el error que este sprint debe evitar.
