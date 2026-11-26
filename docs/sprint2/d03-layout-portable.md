# D-03 — Raíz de aplicación derivada del ejecutable (implementación)

Tercer entregable de D-03: **código, pruebas y lanzadores**. Rama `feature/d03-app-root`.
Alcance ejecutado: **T3** (`S3`, `S4`, `S11`). Esta entrega **no** cubre T4/T5 por separado: sirve
`modulos/`, `static/` y el fallback del dashboard desde raíces explícitas, y deja la ruta de
descarga de archivos de curso (T5) fuera, porque no es una regla de D-03.

Estado: `cargo test` verde en los dos perfiles (§5). Cuatro pruebas RED observadas antes de
implementar, con topes de tiempo (§5.1).

---

## 1. Qué cambia, en una tabla

| Concepto | Antes | Ahora | Dónde |
|---|---|---|---|
| `APP_ROOT` | inexistente: cada recurso se resolvía contra el **CWD** (`ServeDir::new("modulos")`, `ServeDir::new("static")`) | directorio que **contiene el ejecutable**, absoluto y existente; `APP_ROOT` declarada gana, el CWD nunca participa | `config.rs:440`, `config.rs:591` |
| `/modulos/*` (B3) | `404` desde cualquier CWD distinto del de los recursos | `200` desde `/tmp`, `/var/tmp` y `/home` con el mismo binario | `main.rs:487` |
| `/api/modulos` | `scan_modulos_dir("modulos")` relativo al CWD | escaneo bajo `APP_ROOT/modulos` | `main.rs:1917`, `main.rs:1947` |
| `/static/*` | `ServeDir::new("static")` | `ServeDir::new(APP_ROOT/static)` | `main.rs:498` |
| Dashboard | fallback por defecto `../edu-conect-rural-dashboard/out/` (relativo al CWD) | `APP_ROOT/frontend` | `config.rs:691` |
| `DEFAULT_BIBLIOTECA_DIR` / `DEFAULT_ZIM_DIR` | default relativo → CWD | default bajo `APP_ROOT`; declarada se respeta tal cual | `config.rs:620-640` |
| `DATA_DIR` | `"data"` relativo al CWD, sin validar nunca | tabla por plataforma y contexto (§3), **obligatoriamente escribible** | `config.rs:497`, `config.rs:654` |
| Validación de entorno | `--check` la hacía; el arranque **no** | el arranque la corre **antes de cualquier efecto** | `main.rs:303` |

La organización **fuente** no se movió: `modulos/`, `static/` y el export del dashboard siguen donde
estaban en el repositorio. Lo que cambia es la **ejecución** (de dónde se sirven) y el **empaquetado**
(estructura plana de §D-03.A).

---

## 2. Estructura plana, sin heurísticas

Se implementó la decisión de §D-03.A tal cual: **el ejecutable vive en la raíz de `APP_ROOT`**.

```
APP_ROOT/                          # solo lectura (R-01)
├── edu-conect-rural-server        ← el ejecutable
├── modulos/  static/  frontend/  contenido/  config/

DATA_DIR/                          # escribible, respaldable, fuera del paquete
├── educonect.db
├── videos/  biblioteca/  contenido/zim/
```

`resolver_app_root` (`config.rs:440`) aplica dos reglas y nada más:

1. `APP_ROOT` declarada → debe ser **absoluta** (una raíz relativa reintroduce la dependencia del
   CWD) y **existir**; si no, error que nombra la ruta.
2. Sin declarar → `current_exe()` → `canonicalize()` → directorio padre. Sin búsquedas hacia
   arriba, sin listas de candidatos, sin respaldo en el CWD.

Docker cumple la regla sin cambios: el binario está en `/app/server` y los recursos en `/app/static`,
`/app/modulos`, `/app/frontend`, así que `APP_ROOT = /app`.

---

## 3. Tabla de `DATA_DIR`, implementada

| Caso | Valor por defecto | Rama |
|---|---|---|
| `DATA_DIR` declarada | la declarada (relativa se absolutiza contra el CWD declarado) | `config.rs:503-505` |
| Linux, **servicio** | `/var/lib/educonect` | `config.rs:513` |
| Linux, **usuario** | `$XDG_DATA_HOME/educonect`, si no `$HOME/.local/share/educonect` | `config.rs:534-547` |
| Windows, **servicio** | `%ProgramData%\EduConect` | `config.rs:517` |
| Windows, **usuario** | `%LOCALAPPDATA%\EduConect` | `config.rs:524` |
| Docker | `/data` (lo declara la imagen, no el código) | `Dockerfile:101` |
| Otro Unix | XDG con respaldo en el perfil | `config.rs:534` |

**Cómo se distingue servicio de usuario, sin adivinar:**

| Plataforma | Señal | Por qué |
|---|---|---|
| Linux | `INVOCATION_ID` presente | systemd la define en cualquier unidad; una terminal no |
| Windows | `USERNAME == "SYSTEM"` | un servicio de Windows corre como SYSTEM; una sesión de usuario no |

Ambas señales se leen **una sola vez**, en `EntornoPlataforma::leer` (`config.rs:394`), dentro de
`config::cargar`. La resolución posterior es **pura**: recibe el entorno y el CWD por parámetro, así
que la tabla se verifica en Linux para las ramas de Windows sin una máquina Windows (§5.2).

`DATA_DIR` es escribible o no arranca: `verificar` (`config.rs:793`) comprueba existencia del
directorio, permiso de escritura y el archivo existente; `main` la ejecuta **antes** de crear un solo
directorio (`main.rs:303`). `APP_ROOT`, en cambio, **no** exige escritura: exigirla sería el defecto
que D-03 corrige.

---

## 4. Qué pasa con la base de una instalación anterior — decisión y evidencia

**Pregunta:** al dejar de resolver `DATA_DIR` como `./data` relativo al CWD, ¿una instalación
existente arranca en silencio con una base nueva y vacía?

**Respuesta implementada: no. Se falla ruidosamente y se nombra el archivo.** No se migra en
automático y no se ignora.

| Opción | Por qué no |
|---|---|
| Migrar sola el archivo a la nueva raíz | Mueve datos de usuario sin que nadie lo pida; en un rollback el archivo ya no está donde el sistema anterior lo espera |
| Ignorarlo y crear una base nueva | Es pérdida de datos silenciosa: el panel arranca «funcionando» con cero cursos del profesor |
| Fallar nombrando el archivo | El operador decide: reutilizar (`DATA_DIR=<ruta heredada>`) o empezar de cero moviendo el archivo |

Guardia: `base_de_instalacion_anterior` (`config.rs:565`). Solo actúa cuando **`DATA_DIR` no está
declarada** — con la variable declarada la elección es explícita y no se opina. Detecta
`<CWD>/data/educonect.db` como archivo y compara contra la base resuelta; si difieren, produce un
`[ERROR] DATA_DIR` que nombra la base heredada y la raíz nueva (`config.rs:667-686`).

Evidencia observada, no supuesta:

| Comprobación | Resultado |
|---|---|
| Sin `DATA_DIR` y con `./data/educonect.db` presente | el arranque **no** escucha, sale ≠ 0, el mensaje nombra `DATA_DIR` **y** la ruta heredada; no crea `videos/`, `biblioteca/`, `contenido/` ni la raíz por defecto | `tests/arranque_sin_config.rs:513` |
| Con `DATA_DIR` declarada apuntando a la base heredada | el arranque **usa ese archivo** (falla al abrirlo, porque el fixture no es SQLite) y **no** arranca sirviendo: no se creó una base nueva en otra parte | `tests/arranque_sin_config.rs:577` |
| La base heredada después del intento | bytes **idénticos** a los de antes | `tests/arranque_sin_config.rs:602-606` |

Límite declarado: la guardia busca `educonect.db`. Un `-wal` huérfano sin base principal no se
detecta; en ese caso no hay datos que perder.

---

## 5. Pruebas: RED y GREEN, con topes de tiempo

### 5.1 RED observado antes de implementar

Comando exacto (contenedor `nodev`, `--test-threads=1 --nocapture`, `timeout` por fuera y por dentro):

```
timeout 900 docker compose run -T --rm nodev bash -lc \
  'cd /workspace/edu-conect-rural-server && timeout 700 cargo test --locked \
   --test arranque_sin_config -- --test-threads=1 --nocapture'
```

Resultado observado: `2 passed; 4 failed; 0 ignored; finished in 75.21s`, sin bloqueos.

| Prueba | Fallo observado en RED |
|---|---|
| `app_root_no_depende_del_cwd` | `/modulos/mundo-3d-701/ respondió 404 desde el CWD /tmp: la ruta no se resuelve respecto de APP_ROOT` |
| `app_root_inexistente_falla_antes_de_crear_nada` | el proceso no terminó en 30 s (arrancó sirviendo con `APP_ROOT` inexistente); se lo mató y se imprimió su salida |
| `data_dir_no_escribible_falla_antes_de_crear_nada` | ídem: arrancó sirviendo con un `DATA_DIR` en `0555` y escribió la base dentro |
| `base_de_instalacion_anterior_no_se_abandona_en_silencio` | el diagnóstico no nombraba `DATA_DIR`; el proceso moría con `file is not a database` tras haber creado `videos/`, `biblioteca/` y `contenido/zim/` junto a la base heredada |

### 5.2 GREEN

| Comando | Resultado observado |
|---|---|
| `cargo test --locked --test arranque_sin_config -- --test-threads=1 --nocapture` | **7 passed; 0 failed** · 14.13 s → luego 28.04 s con la séptima prueba |
| `cargo test --locked --lib --bins --test arranque_sin_config` (perfil default) | lib **57**, bins **80**, arranque **7** → **144 passed, 0 failed**, exit 0 |
| `cargo test --locked --features zim --lib --bins --test arranque_sin_config` (perfil con-zim) | lib **60**, bins **85**, arranque **7** → **152 passed, 0 failed**, exit 0 |
| `cargo clippy --locked -- -D warnings` (lo que corre CI) | `Finished dev profile`, exit **0** |

Pruebas de integración del binario real (`tests/arranque_sin_config.rs`):

| Prueba | Regla | Spec |
|---|---|---|
| `app_root_no_depende_del_cwd` | mismo binario desde `/tmp`, `/var/tmp`, `/home`: `/modulos/*`, `/static/*`, fallback del dashboard y `/api/modulos` responden igual; la base queda en `DATA_DIR` | `S3`, `S4`, `S11` |
| `app_root_inexistente_falla_antes_de_crear_nada` | `APP_ROOT` debe existir; se nombra la ruta | `S3`, `S4` |
| `data_dir_no_escribible_falla_antes_de_crear_nada` | `DATA_DIR` escribible, fallo antes de cualquier efecto | `S3`, `S11` |
| `base_de_instalacion_anterior_no_se_abandona_en_silencio` | sin pérdida de datos silenciosa | `S3`, `S10` |
| `data_dir_declarada_usa_la_base_existente_y_no_crea_otra` | la salida explícita reutiliza la base existente | `S3`, `S10` |
| `sin_jwt_secret_no_crea_directorios` (D-02, preservada) | validación antes de efectos | `S3` |
| `con_configuracion_valida_crea_los_directorios` (D-02, preservada) | arranque válido crea `DATA_DIR` | `S3` |

Núcleo puro en `src/config.rs` (`mod tests_raices`, 17 pruebas nuevas): `APP_ROOT` por defecto y
declarada (absoluta, existente, sin ejecutable), las seis ramas de la tabla de `DATA_DIR`
(Linux servicio/usuario con y sin XDG, Windows servicio/usuario), «declarada gana» en las seis
combinaciones, independencia del CWD, y las tres ramas de la guardia de base heredada.

### 5.3 `--check` sigue sin mutar nada

```
$ env -u JWT_SECRET ADMIN_INITIAL_PASSWORD=corta DATA_DIR=/tmp/chk/ro \
      APP_ROOT=/tmp/chk/no-existe LISTEN_ADDR=nada edu-conect-rural-server --check
[ERROR] APP_ROOT: /tmp/chk/no-existe no existe o no es un directorio. ...
[ERROR] JWT_SECRET: variable ausente. ...
[ERROR] LISTEN_ADDR: inválida ("nada"): invalid socket address syntax
[ERROR] ADMIN_INITIAL_PASSWORD: ADMIN_INITIAL_PASSWORD demasiado corta (5 chars, mínimo 12). ...

Resultado: configuración no válida.
No se realizaron modificaciones.
CHECK_EXIT=1  ·  DATA_DIR quedó vacío
```

Los cuatro errores salen juntos (D-02) y añade la novena variable, `APP_ROOT`. Límite conocido y
preexistente: si `cargar()` devuelve `Err`, `check` no llega a `verificar`, así que en ese caso no se
informan los hallazgos de entorno (`DATA_DIR`, `FRONTEND_PATH`).

---

## 6. Lanzadores por plataforma (T3)

| Archivo | Qué hace | Layout |
|---|---|---|
| `deploy/educonect.service` | **único** template systemd: usuario `educonect`, `WorkingDirectory=/opt/educonect`, `DATA_DIR=/var/lib/educonect`, secretos en `/etc/educonect/educonect.env`, `ProtectSystem=strict` + `ReadWritePaths` coherentes con R-01 | plano: `ExecStart=/opt/educonect/edu-conect-rural-server` |
| `deploy/windows/educonect.bat` | lanzador sin privilegios; raíz explícita y `DATA_DIR=%LOCALAPPDATA%\EduConect`, secreto en `config\educonect.env` | plano: el `.bat` se copia junto al `.exe` |
| `deploy/windows/instalar-tarea.ps1` | inicio automático al iniciar sesión (tarea programada). **No** se registra un servicio con `sc.exe`: el binario no implementa el protocolo del SCM y fallaría con error 1053; se documentan las dos vías reales (tarea programada o NSSM) | ídem |

`install.sh` deja de tener una unidad embebida que se desincroniza: sustituye rutas sobre el template
(`install.sh:20-25`, `install.sh:237`), mueve el binario a la raíz (`install.sh:93`), declara
`DATA_DIR=/var/lib/educonect` fuera del paquete y crea el usuario `educonect`. Los secretos **no** se
inventan: si el operador los pasa, se escriben en el `EnvironmentFile`; si no, el instalador advierte
y nombra el archivo, porque provisionarlos es T2 y las validaciones no se relajan.

---

## 7. Incidente del intento anterior: causa y remedio

**Síntoma heredado:** el binario de pruebas `arranque_sin_config` quedó 30 minutos a 0 % de CPU con
un hijo vivo, y la tubería `cargo test … | tail` nunca imprimió nada.

**Causa:** `.output()` sobre el servidor. `data_dir_no_escribible_falla_antes_de_crear_nada` lanzaba
el binario con un `DATA_DIR` en `0555` y `Command::output()` esperaba su salida. El contenedor corre
como **root**, así que un directorio `0555` sigue siendo escribible: el servidor arrancaba de verdad,
`output()` no retornaba nunca, y `tail` retenía toda la salida hasta el cierre de la tubería. Un
`output()` sin tope contra un proceso que sirve es un bloqueo permanente, no lento.

**Remedio, en `tests/arranque_sin_config.rs`:**

| Mecanismo | Dónde | Qué garantiza |
|---|---|---|
| `Servidor` con `Drop` que mata y espera | `:39-110` | ninguna aserción que entra en pánico deja un servidor huérfano |
| espera acotada con `try_wait` + tope | `:64-75` | un proceso que no sale falla con evidencia a los 30 s |
| `matar_y_leer` (matar **y después** leer) y `leer` privada | `:96`, `:78` | leer una tubería viva es imposible por construcción |
| `ejecutar_y_terminar` | `:116` | reemplaza `output()`; imprime la salida antes de fallar |
| `connect_timeout` + `set_read_timeout` en `http_get` | `:147` | ninguna lectura de socket puede colgarse |
| `esperar_arranque` con deadline y salida temprana si el hijo murió | `:293` | el arranque no espera el tope completo cuando ya es imposible |

Hallazgo honesto de esta sesión: la **primera** versión de mi propia ayuda leía la salida antes de
matar, y volvió a colgarse en `app_root_no_depende_del_cwd` (lo cortó el `timeout 700`, no el
sistema). Se corrigió haciendo `leer` privada y obligando a pasar por `matar_y_leer`. El invariante
ahora es estructural, no una convención.

---

## 8. Riesgos y pendientes

| Riesgo | Estado |
|---|---|
| `install.sh` no se ejecutó de punta a punta (exige root, systemd y el paquete `deploy/`): solo `bash -n` (sintaxis OK) y revisión de la sustitución del template | declarado |
| Los lanzadores de Windows no se ejecutaron en Windows (no hay máquina): `.bat` y `.ps1` son revisión de código | `S11` |
| La unidad systemd no se arrancó con systemd real en este entorno | declarado |
| `tests/integration_test.rs` falla 3/3 en el contenedor **solo** porque `/workspace` es un montaje de solo lectura y esas pruebas abren `data/*.db` relativo: el mismo binario compilado pasa 3/3 desde un CWD escribible (`/tmp/cwd-integracion`) | ambiental, no regresión |
| `cargo clippy --all-targets` reporta dos avisos **preexistentes** en archivos no tocados: import sin usar en `tests/integration_test.rs:12` y `rate_limit::reset` sin uso (`src/rate_limit.rs:53`). El comando de CI (`cargo clippy -- -D warnings`) sale 0 | preexistente |
| La ruta de descarga de archivos de curso (`/api/cursos/{id}/archivo`) sigue sin existir: es **T5**, no una regla de D-03. El intento anterior la probaba dentro de esta suite; se retiró para no dar por cubierta una capacidad ausente | fuera de alcance |
| `APP_ROOT` declarada relativa ahora es error (antes no existía la variable): un despliegue que la declare con ruta relativa falla con mensaje explícito | intencional |
| Empaquetado: `out/` del dashboard no está generado en el repositorio, así que `APP_ROOT/frontend` estará vacío hasta que el empaquetado copie el export | riesgo ya registrado en §D-03 |

---

## 9. Mapa de la entrega

| Archivo | Cambio |
|---|---|
| `src/config.rs` | `APP_ROOT` (resolución y validación), tabla de `DATA_DIR` por plataforma y contexto, guardia de base heredada, default de `frontend` bajo `APP_ROOT`, `APP_ROOT` en `verificar`, 17 pruebas puras |
| `src/main.rs` | `app_root` en `AppState`; `verificar` antes de cualquier efecto (`:303`); `/modulos`, `/static`, `/api/modulos` y dashboard desde `APP_ROOT` (`:487`, `:498`, `:1917`) |
| `tests/arranque_sin_config.rs` | 7 pruebas del binario real con esperas acotadas, socket con timeout y muerte garantizada |
| `install.sh` | layout plano, `DATA_DIR` fuera del paquete, unidad generada desde el template único, usuario de servicio, `EnvironmentFile` con secretos |
| `deploy/educonect.service`, `deploy/windows/*` | lanzadores de Linux y Windows |
