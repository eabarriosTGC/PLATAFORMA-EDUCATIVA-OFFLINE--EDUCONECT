# D-02 — Mapeo de la configuración y de las precondiciones de arranque

Primer entregable de D-02. **Sin cambios de código.** Base: `4697978`.

La pregunta que este mapeo debe responder: **¿puede `--check` validar la configuración sin validar el flujo de `Database::open`?**

Respuesta corta: **sí, con una extracción**, y con una frontera explícita. Los detalles abajo.

---

## 1. Inventario real de lecturas de entorno

Son **ocho**, no siete. La octava es `DEFAULT_BIBLIOTECA_DIR`, que no estaba en el inventario previo.

| # | Variable | Punto de lectura | Si falta | Si es inválida |
|---|---|---|---|---|
| 1 | `JWT_SECRET` | `config.rs:19` | **panic** | **panic** (vacía / default conocido / <32 chars) |
| 2 | `PUBLIC_BASE_URL` | `config.rs:54` | `None` silencioso | **panic** en `public_base_url_desde` |
| 3 | `DEFAULT_ZIM_DIR` | `config.rs:117` | ruta por defecto | — (gateado por feature `zim`) |
| 4 | `DEFAULT_BIBLIOTECA_DIR` | `config.rs:134` | ruta por defecto | — |
| 5 | `ADMIN_INITIAL_PASSWORD` | `db.rs:68` | `None` → error desde `open_internal` | validada en `db.rs:371-395`, **después** de migrar y sembrar |
| 6 | `DATA_DIR` | `main.rs:277` | `"data"` | no se valida nunca |
| 7 | `FRONTEND_PATH` | `main.rs:283` | `"../edu-conect-rural-dashboard/out/"` | no se valida nunca |
| 8 | `LISTEN_ADDR` | `main.rs:285` | `"0.0.0.0:8080"` | **panic** (`.expect("LISTEN_ADDR inválida")`) |

Cuatro módulos distintos leen el entorno, aunque la cabecera de `config.rs` declara que *«ningún otro módulo debe leer la variable»*.

---

## 2. Hallazgo A — tres de las ocho abortan con `panic!`

`JWT_SECRET`, `PUBLIC_BASE_URL` inválida y `LISTEN_ADDR` inválida **matan el proceso**. No devuelven `Result`.

Consecuencia directa para el contrato de D-02: **un proceso que hace `panic!` no puede informar «todos los errores juntos»**. El primero que falla se lleva puesto el resto. El formato aprobado

```
[ERROR] JWT_SECRET: variable ausente.
[ERROR] ADMIN_INITIAL_PASSWORD: mínimo 12 caracteres.
[WARN]  DATA_DIR: directorio no existe.
[OK]    LISTEN_ADDR: configuración válida.
Resultado: configuración no válida.
```

…es **imposible de producir hoy** sin convertir esas tres validaciones de `panic!` a `Result`, y sin centralizar las ocho lecturas.

Eso no es un detalle de estilo: es el trabajo real de D-02. La firma propuesta:

```rust
pub struct Configuracion {
    pub jwt_secret: String,          // secreto: nunca se imprime
    pub data_dir: PathBuf,
    pub frontend_path: PathBuf,
    pub listen_addr: SocketAddr,
    pub public_base_url: Option<String>,
    pub default_biblioteca_dir: PathBuf,
    #[cfg(feature = "zim")]
    pub default_zim_dir: PathBuf,
    // La contraseña inicial no se guarda en la estructura: se valida y se
    // consume. Se reporta presencia y motivo, nunca el valor.
    pub admin_initial_password: Option<String>,
}

pub enum Gravedad { Error, Aviso, Ok }

pub struct Hallazgo {
    pub variable: &'static str,
    pub gravedad: Gravedad,
    pub motivo: String,
}

/// Lee y valida TODO sin efectos secundarios. No crea directorios, no abre la BD.
pub fn cargar() -> Result<Configuracion, Vec<Hallazgo>>;
```

`pub fn main` decide qué hacer con `Err`: con `--check`, imprimir los hallazgos y salir; sin `--check`, imprimir y salir con error.

---

## 3. Hallazgo B — hoy se crean directorios **antes** de validar nada

`main.rs`, en este orden:

```
277   let data_dir = std::env::var("DATA_DIR")...
278   let paths = RuntimePaths::nuevo(&data_dir);
282   paths.ensure_dirs()          ← crea data/, videos/, biblioteca/, contenido/zim/
299   let jwt_secret = config::jwt_secret_requerido()   ← recién acá se valida JWT_SECRET
300   Database::open(...)
```

Una ejecución **sin `JWT_SECRET`** deja cuatro directorios creados antes de abortar. Ya lo habíamos visto desde el otro lado en D-01a: un arranque fallido deja estado. Acá se ve la mitad que faltaba — el estado lo crea `main()` *antes* de que la validación ocurra.

Esto es exactamente lo que `--check` debe dejar de hacer, y no requiere tocar `Database::open`.

---

## 4. La pregunta central: ¿se puede separar `--check` del flujo de `Database::open`?

`Database::open` (`db.rs:67`) hace cinco cosas en secuencia:

| Paso | Qué hace | ¿Validable sin abrir? |
|---|---|---|
| 1 | Abre la conexión bootstrap (crea el archivo) | **No** — abrir ya crea |
| 2 | Fija PRAGMAs (WAL, foreign_keys, busy_timeout, synchronous) | No |
| 3 | Migraciones + seeds + admin inicial + reindex | **No**, y es el territorio de D-04 |
| 4 | Cierra bootstrap | No |
| 5 | Abre el pool r2d2 de 8 conexiones | No |

Pero `--check` no necesita esos pasos. Necesita las **precondiciones**:

| Precondición | Cómo se comprueba sin abrir | Depende de D-04 |
|---|---|---|
| `DATA_DIR` existe y es escribible | `metadata` + intento de crear un archivo temporal y borrarlo | No |
| `DATA_DIR` no es de solo lectura | `permissions().readonly()` | No |
| `ADMIN_INITIAL_PASSWORD` cumple la política | Validación pura, **hoy enterrada** en `db.rs:371-395` | No |
| `FRONTEND_PATH` existe | `Path::exists` | No |
| `LISTEN_ADDR` parsea | `str::parse::<SocketAddr>()` | No |
| Estado de migraciones, seeds, admin | **Requiere abrir** | **Sí, es D-04** |

**Conclusión: sí se puede separar.** `--check` valida configuración y precondiciones puras; no valida migraciones ni seeds. Y ninguna de esas precondiciones cambia de forma cuando D-04 haga transaccional la inicialización.

### La extracción que D-02 necesita

`initial_password_requerida` (`db.rs:371-395`) es hoy una función privada de `db.rs`, invocada desde `ejecutar_migraciones_auth` **después** de migrar y sembrar. Para validarla antes de abrir, la política —no el flujo— se muda a `config.rs` como validador puro. `db.rs` deja de decidir la política y pasa a consumir un valor ya validado.

Es un cambio de propiedad, no de comportamiento: la política es la misma (mínimo 12 caracteres, rechaza `admin123`), y la prueba existente `debe rechazar el arranque sin ADMIN_INITIAL_PASSWORD` (`db.rs:1173`) debe seguir pasando, apuntando al nuevo punto.

---

## 5. Frontera explícita de `--check`

| Valida | No valida |
|---|---|
| Las ocho variables y sus formatos | Estado de las migraciones |
| Existencia y escritura de `DATA_DIR` | Si las semillas están aplicadas |
| Existencia de `FRONTEND_PATH` | Si el administrador inicial existe |
| Política de `ADMIN_INITIAL_PASSWORD` | Si el reindex de búsqueda corrió |
| Que no crea nada, no abre la BD, no lanza procesos | Nada del flujo transaccional de D-04 |

`--check` responde **«¿este entorno permite arrancar?»**, no **«¿este nodo está sano?»**. Confundir las dos preguntas es lo que convertiría `--check` en una herramienta distinta.

---

## 6. Respuesta a la pregunta de orden: D-02 puede ir primero

La condición que pusiste fue: *«si `--check` puede descomponerse en validar config + validar estado de DB sin tocar el flujo de `Database::open`, D-02 va primero»*.

**Puede**, con la frontera de §5. Por eso:

- **D-02 primero.** Valida precondiciones, que no cambian en D-04. El riesgo de «validar algo que se va a rediseñar» no aplica: lo que D-04 rediseña es el paso 3, y `--check` no lo toca.
- **D-04 después**, con `--check` ya existente y **sin** cubrir el flujo de inicialización. Cuando D-04 quiera validar recuperabilidad, será una extensión de `--check` con su propio contenido.

Contra-argumento honesto, para que lo tengas presente: D-02 y D-04 tocan archivos distintos (`config.rs`, `main.rs` vs. `db.rs`, `migrations/`, `seeds/`), salvo por la extracción de la política de contraseña, que toca `db.rs`. Si preferís que `db.rs` no se toque hasta D-04, la alternativa es que `--check` **no** valide la contraseña inicial y lo declare como límite. Es peor producto, pero aísla los archivos.

---

## 7. Lo que este mapeo no decide

- Si `--check` sale con código 0 cuando hay solo avisos (`WARN`) o también falla. **Recomiendo 0**: un aviso no impide arrancar.
- El formato exacto de salida más allá del aprobado (colores, orden de las líneas). Recomiendo orden fijo: primero `ERROR`, después `WARN`, después `OK`, y las `OK` solo si se pide `--check --verbose`.
- Si `--check` valida `FRONTEND_PATH` como error o aviso. Hoy el default apunta a un directorio que **no existe** (`out/` no está generado), así que como error bloquearía todo arranque en desarrollo. **Recomiendo aviso.**

Los tres son decisiones de producto, no de arquitectura, y las resuelvo en la propuesta de firma, no acá.
