# D-01b — Mapeo de `AppState` y propuesta de firma

Primer entregable de D-01b. **Sin cambios de código.** Línea base: `feature/d01a-zim-opcional` @ `adffa44`.

---

## 1. Bloqueante: `tests/` no puede ver `AppState` ni el router

Esta es la conclusión que condiciona el diseño del work unit.

| Hecho verificado | Evidencia |
|---|---|
| `AppState`, `RuntimePaths` y los 64 handlers viven en `src/main.rs` | `main.rs`: 2.166 líneas, 72 `.route(...)`, 3 `nest_service`, 64 `async fn` |
| `src/lib.rs` expone **solo** `db`, `models`, `network` | `lib.rs` completo, 6 líneas |
| El router se construye dentro de `main()` y termina en `.with_state(state)` | `main.rs:451` |
| No existe ninguna función `app()`, `build_router()` ni equivalente | `grep "fn app\|build_router\|crear_router"` → sin resultados |

Un test de integración en `tests/` enlaza contra la **librería**, no contra el binario. Por eso `tests/http_degradacion.rs` **no puede** importar `AppState` ni `app()`.

No es una hipótesis: el `tests/integration_test.rs` existente lo demuestra. Define su propio `TestState`, su propio `make_app()` y **reimplementa los handlers** (`listar_cursos_de_test`, `progreso_de_test`, `guardar_progreso_de_test`). No monta su propio router por elección: lo hace porque no tiene acceso al real.

Consecuencia: **la ubicación sugerida `tests/http_degradacion.rs` no es viable** sin mover el router a la librería. Y "mover el router" significa mover 2.166 líneas y 64 handlers.

---

## 2. Cómo se construye `AppState` hoy

| Campo | Origen actual | Costo / efecto |
|---|---|---|
| `db: Database` | `Database::open(&paths.db, jwt_secret)` (`main.rs:300`) | **Escribe en disco**: migraciones + semillas + bootstrap del admin. Exige `ADMIN_INITIAL_PASSWORD` en el entorno |
| `frontend_path: String` | `FRONTEND_PATH` o default (`main.rs:283`) | Ninguno. Solo se usa en `fallback_service` |
| `paths: RuntimePaths` | `RuntimePaths::nuevo(DATA_DIR)` + `ensure_dirs()` (`main.rs:283`) | **Crea directorios** en `DATA_DIR` |
| `zim: SharedZim` | `zim_proxy::inicializar(...)` | **Solo con la feature**. El test corre sin ella |
| `h264_encoder: &'static str` | `detect_h264_encoder()` (`main.rs:148`, llamado en `:313`) | **Ejecuta `ffmpeg` como proceso externo** |
| `login_limiter: Arc<RateLimiter>` | `RateLimiter::new(5, 60)` | Barato |
| `public_base_url: Option<String>` | `config::public_base_url()` | Barato |
| `listen_addr: String` | `LISTEN_ADDR` | Barato |

### Dos hallazgos que simplifican el diseño

**`JWT_SECRET` no hace falta para el test.** `Database::open(path, jwt_secret)` **recibe el secreto como parámetro** (`db.rs:67`). La variable de entorno solo la lee `config::jwt_secret_requerido()` dentro de `main()` (`main.rs:299`). Un `AppState::for_test()` puede pasar un secreto literal sin tocar el entorno.

**`ADMIN_INITIAL_PASSWORD` sí hace falta.** `Database::open` llama a `open_internal`, que es **privado** (`db.rs:74`), y valida la contraseña del admin inicial. `open_internal` no es accesible desde un test. Las salidas son: (a) que el test exporte la variable —como ya hace `integration_test.rs`—, o (b) hacer público un constructor alterno, lo que **modifica producción** y descartamos.

**`h264_encoder` es el side effect que hay que evitar.** `detect_h264_encoder()` ejecuta `ffmpeg -encoders` al arrancar. Un `AppState::for_test()` debe fijarlo a `"libx264"` sin invocar el proceso.

**`Database` no se puede construir en memoria.** El pool `r2d2` abre conexiones distintas: `:memory:` daría una base **por conexión**, no una compartida. Y `Database::open` corre migraciones y semillas. Por eso la propuesta es `AppState::for_test()` con **archivo en directorio temporal único**, no `Database::in_memory()`.

---

## 3. Firmas propuestas

### Refactor (commit 1)

```rust
// main.rs — extracción mecánica, sin cambio de lógica
fn app(state: AppState) -> Router {
    Router::new()
        // ... las 72 rutas y 3 nest_service actuales, sin tocar ...
        .merge(zim_routes)              // hoy: main.rs:428
        // ... resto de la cadena ...
        .fallback_service(ServeDir::new(&state.frontend_path)
            .append_index_html_on_directories(true))
        .with_state(state)              // hoy: main.rs:451
}
```

En `main()`:

```rust
    let app = app(state);
```

Tres detalles que hacen que sea «solo mover líneas»:

1. El bloque actual ya usa `state.x` a mitad de cadena y mueve `state` en `with_state` al final. Al recibir `state: AppState` como parámetro, los préstamos y el movimiento final quedan **idénticos**. No hay que reordenar nada.
2. `zim_routes` se calcula hoy dentro de `main()` antes del `Router::new()`. Se mueve **dentro** de `app()`, en la misma posición relativa.
3. `detect_h264_encoder()`, `ensure_dirs()`, `Database::open` y `jwt_secret_requerido()` **se quedan en `main()`**. `app()` no hace I/O ni lanza procesos. Es lo que permite instanciarlo en un test.

Tipo de retorno: `Router` (equivalente a `Router<()>`), porque `with_state` está dentro. Compila sin la feature: el campo `zim` está gateado y `zim_routes` tiene rama `#[cfg(not(feature = "zim"))]` que no usa estado.

### Constructor de test (commit 1, `#[cfg(test)]`)

```rust
impl AppState {
    /// Solo para tests: mismo AppState, sin tocar el entorno salvo
    /// ADMIN_INITIAL_PASSWORD (lo exige el bootstrap de la BD) y sin lanzar ffmpeg.
    #[cfg(test)]
    fn for_test(tag: &str) -> (Self, PathBuf) {
        // directorio único: pid + tag -> aislamiento entre tests en paralelo
        let dir = std::env::temp_dir().join(format!("educonect-test-{}-{}", std::process::id(), tag));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).expect("directorio temporal");

        std::env::set_var("ADMIN_INITIAL_PASSWORD", "test-password-segura-1234");

        let paths = RuntimePaths::nuevo(dir.to_string_lossy().as_ref());
        paths.ensure_dirs().expect("dirs de test");
        let db = Database::open(&paths.db.to_string_lossy(), "t".repeat(40))
            .expect("BD de test");

        let state = AppState {
            db,
            frontend_path: dir.join("frontend").to_string_lossy().into_owned(),
            paths,
            h264_encoder: "libx264",
            login_limiter: std::sync::Arc::new(RateLimiter::new(5, 60)),
            public_base_url: None,
            listen_addr: "127.0.0.1:0".into(),
        };
        (state, dir)
    }
}
```

- `#[cfg(test)]`: **cero impacto en producción**. No cambia el diseño de `Database` ni crea traits.
- Directorio temporal con `pid` + tag: aislamiento entre tests concurrentes y fuera del CWD del repo, lo que de paso evita repetir el defecto de `tests/integration_test.rs`.
- Devuelve el directorio para que el test lo borre al terminar.

---

## 4. El test (commit 2)

```rust
#[cfg(test)]
mod http_degradacion {
    use super::*;
    use tower::ServiceExt; // oneshot

    #[cfg(not(feature = "zim"))]
    #[tokio::test]
    async fn rutas_zim_responden_503_sin_la_feature() { /* ... */ }
}
```

Con `app(state)` y `oneshot`: sin puerto TCP, determinista y contra el router real.

Cobertura acordada: las 5 rutas de contenido → 503 · `/health` → 200 · ruta inexistente → 404 · para las 3 API: `Content-Type: application/json`, JSON válido y campos `error`/`capacidad` con tipo `string` y valores esperados.

---

## 5. Dos consecuencias que necesitan decisión

### 5.1 Dónde vive el test

| Opción | Qué implica | Costo |
|---|---|---|
| **A. Módulo `#[cfg(test)]` en `main.rs`** | El test ve `app()` sin mover nada. Es el único camino sin refactor masivo | El test no vive en `tests/` y **el CI actual no lo ejecutaría** |
| **B. Mover router y handlers a la librería** | `src/server.rs` con `AppState`, `app()` y los 64 handlers; `main.rs` queda como arranque. Habilita `tests/` de verdad | ~2.166 líneas movidas: imposible de revisar en una sentada, contradice el criterio de este proyecto |
| C. `#[path = "../src/main.rs"] mod server;` dentro del test | Compila el binario como módulo del crate de pruebas | Duplica la compilación, anida `fn main()`, y puede **divergir** del binario real — justo lo que queremos evitar. Descartada |

**El CI corre solo `cargo test --test integration_test` (`ci.yml:45`).** Con la opción A, el test existe pero **no se ejecuta en integración continua** hasta agregar `--bins` (o `--all-targets`) a esa línea. Ese cambio es de entregable (CI, ítem 5) y necesita autorización aparte.

### Decisión adoptada

**Opción A, con el cambio de CI incluido en el commit 2** (`cargo test --bins --test integration_test`).

Nota de registro: la primera decisión fue «módulo en `main.rs`, sin tocar CI todavía»; se revirtió porque el objetivo de la unidad es que el contrato quede protegido en integración continua, y un test que solo corre a mano no protege nada. Como el cambio toca el entregable de CI (ítem 5), se declara en el cuerpo del commit y en la descripción del PR, no se introduce de forma silenciosa.

### 5.2 `// TODO(D-03)` en `integration_test.rs`

Confirmado que se deja como está. Su dependencia de `data/` relativo se resuelve en D-03.

---

## 6. Lo que este mapeo no resuelve

- No verifica que `app()` compile: eso es el commit 1, con `cargo build` en ambos perfiles y las pruebas 85/93.
- No decide si el test corre en CI: eso es la decisión de §5.1.
- No cubre el perfil con la feature activa: el test protege la degradación, no el lector ZIM.
