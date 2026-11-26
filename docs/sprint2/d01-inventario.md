# D-01 — Fase 1: inventario previo

**Auditoría read-only. Ningún archivo fue modificado.**

Línea base: `a27adec` · rama `fix/portable-runtime-baseline` · entorno `educonect-dev-env-dev:latest` (`249d08fffca7`) · Rust 1.88.0.

---

## 1. Dependencias

### Manifiesto (`Cargo.toml`)

```
23: zim     = { version = "0.4.0", optional = true }   ← muerta
24: zim-rs  = "0.1.1"                                  ← obligatoria, enlaza libzim
```

### `Cargo.lock`

| Paquete | Versión | Estado |
|---|---|---|
| `zim` | 0.4.0 | Presente en el lock, **ausente del árbol compilado** |
| `zim-rs` | 0.1.1 | En uso |
| `zim-sys` | 0.1.0 | En uso — es quien invoca `pkg-config` |

`cargo tree -i zim-rs` confirma: dependencia **directa y única** de `edu-conect-rural-server`. No hay otro consumidor.

### El crate `zim 0.4.0` no tiene referencias en el código

Tres comprobaciones independientes, ejecutadas sobre `a27adec`:

| Comprobación | Comando | Resultado |
|---|---|---|
| Importaciones del crate | `grep -rn 'use zim::' src/` | **0 archivos** |
| Menciones de `zim` que no sean `zim_rs`/`zim_proxy` | `grep -rn '\bzim\b' src/ \| grep -v 'zim_rs\|zim_proxy'` | 65 coincidencias, **todas** cadenas de ruta (p. ej. `"default-content/zim"` en `config.rs`), atributos `#[cfg(feature = "zim")]` o comentarios |
| Presencia en el árbol compilado | `cargo tree --locked \| grep '\bzim v'` | **no aparece** |

Por eso el mensaje del commit dice «sin referencias en el código ni en el árbol compilado», y no «sin uso»: lo segundo sería una conclusión sobre intención, lo primero es lo que estas tres comprobaciones demuestran.

### Por qué la dependencia es de compilación, no solo de despliegue

`zim-sys/build.rs:28`:

```rust
let libzim = pkg_config::probe_library("libzim").unwrap();
```

`unwrap()`. Sin `libzim` + `pkg-config`, la compilación **aborta**. No degrada, no avisa: falla. Esto significa que hoy el proyecto no puede compilarse en Windows ni en una imagen limpia sin bibliotecas de ZIM.

---

## 2. Referencias por archivo

### `src/main.rs` — 12 puntos de contacto

| Línea | Contenido | Tratamiento propuesto |
|---|---|---|
| 9 | `mod zim_proxy;` | `#[cfg(feature = "zim")]` |
| 34 | `use zim_proxy::{buscar_articulos, listar_zims, obtener_articulo, zim_inyectar_estilos, SharedZim};` | `#[cfg(feature = "zim")]` |
| 41 | `zim: SharedZim,` en `AppState` | `#[cfg(feature = "zim")]` |
| 61, 73, 82 | `contenido_zim: PathBuf` + creación del directorio | **Sin cambio.** No depende de la feature: es una ruta en `DATA_DIR` |
| 300–303 | Bloque de inicialización del lector | `#[cfg(feature = "zim")]` |
| 313 | `zim: zim.clone(),` al construir `AppState` | `#[cfg(feature = "zim")]` |
| 397–404 | 6 rutas | Se registran siempre; el handler cambia según feature (§3) |
| 1575–1764 | Bloque de handlers y páginas de error (**190 líneas**) | `#[cfg(feature = "zim")]` |
| 1674 | `servir_entrada_zim(reader: &zim_proxy::ZimReader, …)` | Dentro del bloque anterior |

Ninguna referencia fuera de `main.rs`.

### `src/zim_proxy.rs` — 706 líneas

Símbolos públicos que dependen de `zim_rs`:

| Línea | Símbolo |
|---|---|
| 18 | `pub struct ZimReader` |
| 30 | `pub struct ZimLibrary` |
| 37 | `pub type SharedZim = Arc<RwLock<ZimLibrary>>` |
| 326 | `pub struct WikiResult` |
| 338 | `pub fn buscar_articulos(...)` |
| 448 | `pub struct WikiArticle` |
| 458 | `pub fn obtener_articulo(...)` |
| 500 | `pub fn listar_zims(...)` |
| 517 | `pub fn zim_inyectar_estilos(html: &str) -> String` |
| 556 | `pub fn zim_inyectar_estilos_api(html: &str) -> String` |

**El archivo no se modifica.** Se excluye del build desde la declaración del módulo (`main.rs:9`).

### `src/config.rs` — requiere decisión (§5)

| Línea | Contenido |
|---|---|
| 113–124 | `default_zim_dir()` y `default_zim_dir_desde()` |
| 245–266 | `mod tests_default_zim_dir` (4 pruebas) |

Estas funciones **solo existen para la inicialización ZIM** (`main.rs:302`). Sin la feature quedan como código muerto, y el proyecto compila con `-D warnings` en CI. Hay que decidir qué se hace (§5, pregunta 1).

### Frontend — 5 consumidores

| Archivo | Línea | Referencia |
|---|---|---|
| `static/js/wikipedia-viewer.js` | 36, 79, 132 | Consume `/api/wikipedia/zims`, `/search`, `/article` |
| `static/dashboard.html` | 151, 317, 327, 462 | Ítem de menú `#wikipedia`, sección `view-wikipedia`, carga el visor |
| `static/js/dashboard.js` | 602 | Invoca `wikipediaViewerInit()` |
| `static/sw.js` | 72 | Excluye `/zim/` del cache del service worker — **sin impacto** |
| `components/sidebar.tsx` (dashboard Next) | 36 | Ítem «Wikipedia Offline» que apunta a `/zim/` |

Sin tocar el frontend, un build sin ZIM deja: un ítem de menú que lleva a una pantalla que devuelve 503, y un visor que recibe errores en las tres llamadas. No se rompe nada, pero la experiencia queda explícitamente degradada.

---

## 3. Contrato de degradación propuesto

Con la feature desactivada, las seis rutas **siguen registradas** y responden de forma explícita. No se eliminan del router: una ruta ausente produce un 404 del `fallback` de Next, que es indistinguible de un error de configuración.

| Ruta | Respuesta propuesta |
|---|---|
| `GET /zim/`, `GET /zim`, `GET /zim/{*path}` | **503** + página HTML con el mensaje y la instrucción de recompilar con la feature |
| `GET /api/wikipedia/search` | **503** + JSON `{"error":"capacidad zim no incluida en esta compilación","capacidad":"zim"}` |
| `GET /api/wikipedia/article` | Ídem |
| `GET /api/wikipedia/zims` | Ídem, con `{"zims":[],"error":"…"}` |

**Por qué 503 y no 404:** la ruta existe y el servidor está operativo; lo que falta es una capacidad de la compilación. 503 describe exactamente esa condición y es distinguible de «el recurso no existe». Un 404 haría que un operador busque una ruta mal escrita en lugar de entender que falta una feature.

**Un solo handler** (`zim_no_disponible`) atiende las seis rutas con el feature apagado: es explícito, consistente y verificable con un `grep`.

---

## 4. Estimación del cambio

| Archivo | Cambio | Riesgo |
|---|---|---|
| `Cargo.toml` | 3 líneas (feature, `optional`, retirar `zim`) | Bajo |
| `src/main.rs` | 12 sitios; 190 líneas quedan detrás de `cfg` | Medio |
| `src/config.rs` | 1 función + 1 módulo de pruebas | **Requiere autorización** (§5) |
| `src/zim_proxy.rs` | **Ninguno** | — |
| `.github/workflows/ci.yml` | `ci.yml:33` instala `libzim-dev`; sin la feature ya no hace falta, y hace falta un segundo perfil | **Fuera del alcance de D-01a** (§5) |
| Frontend (5 puntos) | Ocultar ítem y vista si la capacidad no existe | **Fuera del alcance de D-01a** (§5) |

**Propuesta de partición:**

- **D-01a** — manifiesto + gating + contrato de degradación 503. Cuatro archivos: `Cargo.toml`, `main.rs`, `config.rs` (± ZIM-scoped), `zim_proxy.rs` sin cambios.
- **D-01b** — CI con dos perfiles (`default` en imagen limpia y `--features zim`) y degradación de UI en el frontend.

Se puede cerrar D-01a con criterio propio y sin tocar CI ni frontend. D-01b es un cambio de entregable (CI) y de producto (UI), y merece su propia revisión.

---

## 5. Cuatro puntos que necesito que resuelvas

**1. `config.rs` con alcance ZIM.** `default_zim_dir()` y sus 4 pruebas quedan muertas sin la feature. Para no romper `-D warnings` hay que gatearlas. Es un archivo que dijiste no tocar, pero el cambio es estrictamente ZIM, no de semántica de configuración. **Recomiendo autorizarlo** con `#[cfg(feature = "zim")]` en `config.rs:113-134` y en el módulo de pruebas. Alternativa si preferís no tocarlo: dejar la función viva y que ZIM la use solo cuando exista la feature, aceptando el `dead_code`… que rompe CI. No veo una tercera opción sin `#[allow]`, que ya prohibiste.

**2. Contrato 503 frente a 404.** Recomiendo 503 por lo dicho en §3. Si preferís 404, necesito que quede escrito que un 404 en `/api/wikipedia/zims` significa «capacidad ausente» y no «ruta inexistente», porque el diagnóstico de soporte cambia.

**3. Alcance del frontend.** Mi recomendación: en D-01a **no tocar el frontend**. El usuario ve un 503 explícito y legible en lugar de una pantalla rota. Ocultar el ítem del sidebar requiere build condicional del dashboard Next y es un cambio de producto que conviene decidir con quien defina la experiencia.

**4. Compilación sin bibliotecas de ZIM.** Para probar el criterio 3 hay que construir una **imagen nueva** sin `libzim-dev`, `libxapian-dev` ni `libicu-dev`, sin tocar la de la línea base. Propongo `educonect-dev-env-nodev` como imagen hermana. Requiere descargar y recompilar todas las dependencias (~3 min). ¿Lo autorizás como parte de la verificación?

---

## 6. Lo que este inventario confirma y lo que no

**Confirma:**
- `zim-rs` es dependencia directa única, activa, de 706 líneas y 6 rutas.
- El crate `zim 0.4.0` está en `Cargo.lock` pero **no en el árbol compilado**: es muerto.
- La dependencia bloquea la **compilación**, no solo el despliegue.
- El cambio se concentra en `main.rs` + manifiesto. `zim_proxy.rs` no se toca.
- Hay 5 consumidores en el frontend que hoy no tienen degradación.

**No confirma:**
- Que quitar la feature elimine las 9 bibliotecas del `ldd`. Se sabrá comparando ambos binarios.
- Que el resultado sea portable. Compilar sin ZIM en Debian no es compilar en Windows.
- Que `cargo test` pase con la feature apagada: hay pruebas en `zim_proxy.rs` que no se compilarán, y hay que verificar que ninguna prueba de otro módulo dependa de ZIM.

---

## 7. Inventario de archivos a modificar en D-01a

```
Cargo.toml                     feat: feature `zim`, `zim-rs` opcional, retirar `zim`
src/main.rs                    cfg en 12 sitios + handler de degradación 503
src/config.rs                  cfg en default_zim_dir + pruebas   ← pendiente de autorización
.github/workflows/ci.yml       NO en D-01a
Frontend (5 archivos)          NO en D-01a
src/zim_proxy.rs               sin cambios
migraciones, seeds, SQLite     sin cambios
APP_ROOT / DATA_DIR            sin cambios
```

Ninguna migración, ningún seed, ningún contrato ajeno a ZIM.
