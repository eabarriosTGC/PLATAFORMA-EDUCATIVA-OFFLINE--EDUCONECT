# D-02 — Propuesta de firma

Segundo entregable de D-02. **Sin cambios de código.** Base: `4697978`.

Decisiones de la coordinación asumidas: D-02 primero · política de contraseña incluida · `--check` valida la ruta declarada de `DATA_DIR`, no su existencia · exit 0 con solo avisos · `FRONTEND_PATH` inexistente es aviso · `[OK]` solo con `--verbose`.

---

## 0. Verificación pedida: ¿hay una novena lectura de entorno?

**No.** Ocho exactas en todo el crate (`src/` + `tests/`):

```
config.rs:19   JWT_SECRET
config.rs:54   PUBLIC_BASE_URL
config.rs:120  DEFAULT_ZIM_DIR          (gateado por feature)
config.rs:138  DEFAULT_BIBLIOTECA_DIR
main.rs:280    DATA_DIR
main.rs:286    FRONTEND_PATH
main.rs:288    LISTEN_ADDR
db.rs:68       ADMIN_INITIAL_PASSWORD
```

Descartados explícitamente:

- `h264_encoder` **no** se lee del entorno: lo produce `detect_h264_encoder()` (`main.rs:148`) ejecutando `ffmpeg -encoders`.
- Los `env!(...)` de `main.rs:377,1436` y `auth.rs:273` son `env!("CARGO_PKG_VERSION")`: macro de compilación, no configuración de ejecución.

---

## 1. Tipos

```rust
// config.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Gravedad { Error, Aviso }

/// Un problema o confirmación sobre una variable concreta.
/// Nunca contiene el valor de un secreto.
#[derive(Debug, Clone)]
pub struct Hallazgo {
    pub variable: &'static str,
    pub gravedad: Gravedad,
    pub motivo: String,
}

/// Configuración ya validada. Todos sus campos son usables sin más comprobaciones.
#[derive(Clone)]
pub struct Configuracion {
    pub jwt_secret: String,              // secreto: no implementa Display
    pub data_dir: PathBuf,               // absoluta, resuelta
    pub db_path: PathBuf,
    pub frontend_path: PathBuf,
    pub listen_addr: SocketAddr,
    pub public_base_url: Option<String>,
    pub default_biblioteca_dir: PathBuf,
    #[cfg(feature = "zim")]
    pub default_zim_dir: PathBuf,
    pub admin_initial_password: Option<String>,
}
```

`Configuracion` no deriva `Debug` a propósito: `jwt_secret` y `admin_initial_password` no deben poder imprimirse por accidente con `{:?}`.

---

## 2. Las dos funciones

```rust
/// Lee y valida las ocho variables. Sin efectos secundarios: no crea
/// directorios, no abre la base, no lanza procesos.
///
/// Devuelve TODOS los errores de lectura/validación juntos. Si hay al menos un
/// `Gravedad::Error`, devuelve `Err` con la lista completa; si no, `Ok`.
pub fn cargar() -> Result<Configuracion, Vec<Hallazgo>>;

/// Comprueba el entorno contra una configuración ya leída. Solo lectura:
/// `metadata`, `permissions`, `exists`. No crea, no borra, no abre nada.
pub fn verificar(conf: &Configuracion) -> Vec<Hallazgo>;
```

La separación es deliberada y responde a tu punto: **`cargar` no toca el sistema de archivos** y **`verificar` no lee el entorno**. Se pueden probar por separado, y `--check` es la composición de las dos más el formateo.

### Por qué `Result<_, Vec<_>>` y no acumular en un `&mut Vec`

Un acumulador mutable deja la puerta abierta a olvidarse de llamarlo. Con `Result` el tipo obliga: quien construye `Configuracion` solo puede hacerlo por el camino que devuelve tutti gli errori o el valor completo. No existe un `Configuracion` a medio validar.

---

## 3. Qué valida cada función

### `cargar()` — las ocho variables

| Variable | Regla | Gravedad si falla |
|---|---|---|
| `JWT_SECRET` | presente, no vacía, ≥32 chars, no está en `SECRETOS_CONOCIDOS` | **Error** |
| `PUBLIC_BASE_URL` | ausente → `None`; presente → URL absoluta http/https con host | **Error** |
| `DATA_DIR` | se resuelve a absoluta; sin otra validación aquí | — |
| `FRONTEND_PATH` | se resuelve a absoluta; ausente → default | — |
| `LISTEN_ADDR` | parsea como `SocketAddr` | **Error** |
| `DEFAULT_BIBLIOTECA_DIR` | ausente → default | — |
| `DEFAULT_ZIM_DIR` (con feature) | ausente → default | — |
| `ADMIN_INITIAL_PASSWORD` | presente → política; ausente → `None` | **Error** si presente e inválida; **Aviso** si ausente |

**El caso de `ADMIN_INITIAL_PASSWORD` ausente merece explicación.** Hoy solo se exige cuando la base necesita crear o rotar el administrador. En un arranque normal con administrador existente, no hace falta. `--check` no puede saberlo sin abrir la base, así que **no puede tratarlo como error**. Reporta:

```
[AVISO] ADMIN_INITIAL_PASSWORD: variable ausente. No se podrá crear ni rotar el administrador inicial si hiciera falta.
```

Tratarlo como error rompería todo arranque posterior al primero, que es el 99 % de los casos.

### `verificar()` — precondiciones del entorno

| Comprobación | Regla | Gravedad |
|---|---|---|
| `DATA_DIR` | si existe: es directorio y es escribible. Si no existe: el **ancestro existente más cercano** es directorio y escribible | **Error** si no es escribible · **Aviso** si no existe todavía |
| `DB_PATH` | si el archivo existe: es archivo y escribible | **Error** |
| `FRONTEND_PATH` | existe y es directorio | **Aviso** (ver §6) |
| `LISTEN_ADDR` | el puerto no está ocupado (`TcpListener::bind` + `drop`) | **Aviso** |

El `bind` de prueba es un efecto efímero, no una mutación persistente: abre y cierra un socket. Si preferís que `verificar` no toque la red en absoluto, se omite y queda como límite declarado.

### `DATA_DIR`: cómo se valida sin crear

Tu recomendación, hecha concreta:

1. Resolver a ruta absoluta (relativa → contra el CWD actual) y **reportarla en la salida**, para que el operador vea qué se interpretó.
2. Si `DATA_DIR` existe → `is_dir()` + `readonly()`.
3. Si no existe → subir por los ancestros hasta el primero que exista; comprobar que es directorio y escribible.
4. **Nunca** `create_dir_all`. Eso sigue siendo de `ensure_dirs()`, en el arranque.

Mensajes resultantes:

```
[AVISO] DATA_DIR: /data no existe todavía; se creará al arrancar (su ancestro existente más cercano, "/", es escribible).
[ERROR] DATA_DIR: /opt/educonect/data no es escribible; su ancestro existente más cercano es "/opt/educonect".
```

---

## 4. Extracción de la política de contraseña

```rust
// config.rs — función libre, sin estado, sin E/S
pub fn validar_politica_password(pw: &str) -> Result<(), String>;
```

Reglas, copiadas de `db.rs:371-395` sin cambios: no vacía · ≠ `admin123` · ≥12 caracteres.

En `db.rs`, `initial_password_requerida` deja de contener las reglas y pasa a:

```rust
fn initial_password_requerida(candidata: Option<String>) -> Result<String, DbError> {
    let pwd = candidata.ok_or_else(|| DbError::Validacion("ADMIN_INITIAL_PASSWORD no está definida…".into()))?;
    config::validar_politica_password(&pwd).map_err(DbError::Validacion)?;
    Ok(pwd)
}
```

La prueba `debe rechazar el arranque sin ADMIN_INITIAL_PASSWORD` (`db.rs:1173`) **debe seguir pasando sin cambios en su aserción**.

### La firma de `Database::open`: dos opciones

| | Firma | Lectura de entorno | Coste |
|---|---|---|---|
| **(a)** recomendada | `open(path, jwt_secret, initial_password: Option<String>)` | **Una sola**, en `config.rs` | Cambia una función pública del crate. Un único llamador a actualizar: `tests/integration_test.rs:34` |
| (b) | `open(path, jwt_secret)` sin cambios | **Dos**: `config.rs` para `--check`, `db.rs:68` para abrir | Cero cambios de API, pero contradice el propósito de centralizar |

Recomiendo **(a)**: es la única que cumple «las ocho lecturas en un solo lugar». Es un cambio de contrato del crate —ítem 3— con un llamador conocido y testeado. Si preferís no tocar `db.rs` más de lo necesario, (b) es defendible y `--check` igual queda completo, a costa de leer la misma variable dos veces.

---

## 5. Composición de `--check` y flujo de `main()`

```rust
const SALIDA_ERROR: i32 = 1;

fn informar(hallazgos: &[Hallazgo], verbose: bool) -> bool {  // true si hay Error
    // orden fijo: ERROR primero, luego AVISO, luego OK (solo con verbose)
}

#[tokio::main]
async fn main() {
    let args: Vec<String> = std::env::args().collect();
    let check   = args.iter().any(|a| a == "--check");
    let verbose = args.iter().any(|a| a == "--verbose");

    let conf = match config::cargar() {
        Ok(c) => c,
        Err(hallazgos) => {
            informar(&hallazgos, true);          // en --check y fuera de él, se informa todo
            std::process::exit(SALIDA_ERROR);
        }
    };

    let hallazgos = config::verificar(&conf);
    let hay_error = informar(&hallazgos, verbose || check);

    if check {
        std::process::exit(if hay_error { SALIDA_ERROR } else { 0 });
    }
    if hay_error {
        std::process::exit(SALIDA_ERROR);
    }

    // ── Recién acá empiezan los efectos ──
    conf.crear_directorios()?;                    // antes: main.rs:282, ANTES de validar
    let db = Database::open(&conf.db_path.to_string_lossy(), conf.jwt_secret.clone(), conf.admin_initial_password.clone())?;
    // … resto del arranque sin cambios …
}
```

El cambio de orden es el núcleo del hallazgo B: **`ensure_dirs` se mueve de la línea 282 a después de toda la validación.** Hoy se ejecuta antes de leer `JWT_SECRET`.

`--check` escribe a **stdout**, no al log de `tracing`: es una herramienta de diagnóstico, no telemetría. Y no inicializa el suscriptor de logs.

---

## 6. Decisiones de producto ya tomadas, aplicadas

| Decisión | Implementación |
|---|---|
| Exit 0 con solo avisos | `hay_error` mira únicamente `Gravedad::Error` |
| `FRONTEND_PATH` inexistente → aviso | Siempre aviso en D-02. La distinción «explícito e inexistente = error / default ausente = aviso» queda anotada, **no implementada** |
| `[OK]` solo con `--verbose` | `informar` filtra las confirmaciones si `!verbose`; sin problemas y sin verbose, salida vacía y exit 0 |

---

## 7. Plan de pruebas

| # | Prueba | Qué fija |
|---|---|---|
| 1 | `cargar` con cuatro variables inválidas → `Err` con exactamente 4 hallazgos | El formato «todos juntos», que es el objetivo del unit |
| 2 | `cargar` con `JWT_SECRET` válido → el hallazgo **no** contiene su valor | No filtrar secretos |
| 3 | `cargar` sin `ADMIN_INITIAL_PASSWORD` → `Ok` con un `Aviso` | El 99 % de los arranques sigue funcionando |
| 4 | `cargar` con contraseña de 8 chars → `Error` | Política extraída |
| 5 | `verificar` con `DATA_DIR` inexistente y ancestro escribible → `Aviso`, y **no crea nada** | Hallazgo B |
| 6 | `verificar` con `DATA_DIR` en ruta no escribible → `Error` | Precondición real |
| 7 | `verificar` no modifica el contenido de `DATA_DIR` (hash antes/después) | Read-only de verdad |
| 8 | `--check` con un `Aviso` y sin `--verbose` → exit 0 y salida vacía | Decisión de producto |
| 9 | `--check` con un `Error` → exit 1 | Compuerta |
| 10 | Regresión: `db.rs:1173` sigue pasando | La extracción no cambia el comportamiento |

La 7 es la que evita repetir el error de D-01a: comprobar que algo «no muta» mirando el código no es comprobarlo.

---

## 8. Frontera con D-04, explícita

`--check` **no** valida:

- estado de las migraciones ni su versión aplicada;
- si las semillas están cargadas;
- si el administrador inicial existe;
- si el reindex de búsqueda corrió;
- nada del orden de inicialización transaccional.

`--check` responde **«¿este entorno permite arrancar?»**. «¿Este nodo está sano?» es otra pregunta y otro unit.

---

## 9. Lo que no propongo tocar

`zim_proxy.rs`, migraciones, seeds, el router, los 64 handlers, `AppState`. El diff de D-02 se concentra en `config.rs` (nuevo) + `main.rs` (arranque) + `db.rs` (política extraída) + `tests/integration_test.rs` solo si se elige la opción (a) de firma.
