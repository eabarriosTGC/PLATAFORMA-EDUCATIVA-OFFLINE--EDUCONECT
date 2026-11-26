# D-03 — Raíz de aplicación derivada del ejecutable (implementación)

Tercer entregable de D-03: **código, pruebas y lanzadores**. Rama `feature/d03-app-root`.
Alcance ejecutado: **T3** (`S3`, `S4`, `S11`). Esta entrega **no** cubre T4/T5 por separado: sirve
`modulos/`, `static/` y el fallback del dashboard desde raíces explícitas, y deja la ruta de
descarga de archivos de curso (T5) fuera, porque no es una regla de D-03.

Estado: `cargo test` verde en los dos perfiles (§5), `cargo clippy -- -D warnings` y `cargo fmt --check`
limpios. Cuatro pruebas RED observadas antes de implementar, con topes de tiempo (§5.1).

**Ronda de corrección tras verificación independiente (27/11).** Tres hallazgos, los tres atendidos
en commits nuevos sobre `afb27d8` —los dos commits de D-03 no se reescribieron—:

| Hallazgo | Defecto | Arreglo | Evidencia |
|---|---|---|---|
| **B1** | `install.sh` documentaba `curl … | sudo bash` pero buscaba la unidad en `$SCRIPT_DIR/../deploy/`; por tubería `SCRIPT_DIR` es el CWD y el paso 5 moría **después** de crear directorios. Regresión respecto del baseline, que llevaba la unidad embebida | el template vuelve a viajar **dentro** del script (heredoc `unidad_systemd`); `deploy/educonect.service` pasa a ser una copia **generada** de `install.sh --print-unit`, y `tests/instalador.sh` exige que coincidan | §5.4 |
| **B2** | la sustitución cubría `WorkingDirectory`, `ExecStart`, `Environment=DATA_DIR` y `EnvironmentFile`, pero no `ReadWritePaths`: con `DATA_DIR` propio y `ProtectSystem=strict` el servicio no podía escribir sus datos | el template lleva el marcador `@DATA_DIR@` en `Environment=DATA_DIR` **y** en `ReadWritePaths`, y el instalador lo sustituye por la ruta **resuelta a absoluta** (también si el operador pasa una relativa) | §5.4 |
| **A3** | la guardia de base heredada usaba `is_file()`, que colapsa EACCES con «no existe»: un `data/` heredado ilegible hacía arrancar el servidor con una base nueva y vacía, donde el baseline fallaba con ruido | `base_de_instalacion_anterior` devuelve `Result` y separa los cuatro desenlaces: archivo, existe-y-no-es-archivo, `NotFound`, cualquier otro error. Nombra el directorio y dice qué hacer | §4, §5.1, §5.2 |

También se corrigieron las referencias que sobrevivieron al layout plano: `start.sh` exportaba
`DB_PATH` (variable que el servidor no lee) y `scripts/check-hotspot.sh` buscaba el binario en
`$INSTALL_DIR/bin/`.

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

Guardia: `base_de_instalacion_anterior` (`config.rs:571`). Solo actúa cuando **`DATA_DIR` no está
declarada** — con la variable declarada la elección es explícita y no se opina. Sondea
`<CWD>/data/educonect.db` y compara contra la base resuelta; si difieren, produce un
`[ERROR] DATA_DIR` que nombra la base heredada y la raíz nueva (`config.rs:701`).

El sondeo distingue **cuatro** desenlaces, no dos (`config.rs:571-608`):

| Desenlace del sondeo | Qué hace | Por qué |
|---|---|---|
| `Ok(meta)` y `is_file()` | sigue con la comparación de rutas | es la base heredada |
| `Ok(_)` (existe y no es archivo) | **error** que nombra la ruta | un `educonect.db` que es un directorio no se puede reutilizar, y arrancar al lado deja una base vacía |
| `Err(NotFound)` | `Ok(None)`: no hay nada que reutilizar | único caso en que el silencio es correcto |
| `Err(EACCES u otro)` | **error** que nombra el directorio y dice qué hacer | con un `data/` ilegible no se puede saber si hay una base: asumirlo es pérdida de datos silenciosa |

`is_file()` colapsaba los dos últimos en `false`; era el defecto A3 de la verificación independiente.
El mensaje observado como usuario no privilegiado, sobre un `data/` en modo `0000`:

```
[ERROR] DATA_DIR: el directorio heredado /tmp/a3.4dTlA5/data no es legible: Permission denied
(os error 13). Revisar permisos o mover los datos manualmente: si hay una base de una instalación
anterior y este proceso no puede comprobarlo, arrancar con una base nueva y vacía sería una pérdida
de datos silenciosa
EXIT=1 · no se creó la raíz de datos por defecto
```

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
| `cargo test --locked --test arranque_sin_config -- --test-threads=1 --nocapture` | **7 passed; 0 failed** · 14.13 s → luego 28.04 s con la séptima prueba. Tras la ronda de corrección: **9 passed; 0 failed** · 26.65 s |
| `cargo test --locked --lib --bins --test arranque_sin_config` (perfil default) | lib **58**, bins **81**, arranque **9** → **148 passed, 0 failed**, exit 0 |
| `cargo test --locked --features zim --lib --bins --test arranque_sin_config` (perfil con-zim) | lib **61**, bins **86**, arranque **9** → **156 passed, 0 failed**, exit 0 |
| `cargo clippy --locked -- -D warnings` (lo que corre CI) | `Finished dev profile`, exit **0** |
| `cargo fmt --check` | exit **0** (antes de esta ronda fallaba en `config.rs` y en el propio archivo de pruebas: era un fallo **preexistente** de `6c3d70e` que rompía el paso `cargo fmt --check` de CI) |
| `bash tests/instalador.sh` (contenedor `nodev`, root, stubs de `apt`/`wget`/`useradd`/`chown`/`systemctl`) | `OK: instalador — clon y tubería salen 0; DATA_DIR (absoluta y relativa) coherente con ReadWritePaths; template versionado sincronizado`, exit **0** |

Pruebas de integración del binario real (`tests/arranque_sin_config.rs`):

| Prueba | Regla | Spec |
|---|---|---|
| `app_root_no_depende_del_cwd` | mismo binario desde `/tmp`, `/var/tmp`, `/home` **y un CWD señuelo con `modulos/` propio**: `/modulos/*`, `/static/*`, fallback del dashboard y `/api/modulos` responden igual; el señuelo nunca gana; las cuatro travesías (`../`, `%2e%2e`, `%2f`, `....//`) devuelven 404 sin filtrar `/etc/passwd` ni servir el módulo del CWD; la base queda en `DATA_DIR` | `S3`, `S4`, `S11` |
| `app_root_inexistente_falla_antes_de_crear_nada` | `APP_ROOT` debe existir; se nombra la ruta | `S3`, `S4` |
| `data_dir_no_escribible_falla_antes_de_crear_nada` | `DATA_DIR` escribible, fallo antes de cualquier efecto | `S3`, `S11` |
| `base_de_instalacion_anterior_no_se_abandona_en_silencio` | sin pérdida de datos silenciosa | `S3`, `S10` |
| `base_heredada_dir_ilegible_no_arranca_vacia` | `data/` heredado en modo `0000`: sale ≠ 0 nombrando el directorio, sin crear la raíz por defecto | `S3`, `S10` |
| `data_dir_declarada_usa_la_base_existente_y_no_crea_otra` | la salida explícita reutiliza la base existente | `S3`, `S10` |
| `data_dir_declarada_reutiliza_misma_base_sin_crear_otra` | progreso escrito por `POST /api/progreso`, reinicio con el mismo `DATA_DIR`: `GET /api/progreso/ana` sigue devolviendo el registro y no apareció ningún `educonect.db` bajo `HOME` | `S3`, `S7`, `S10` |
| `sin_jwt_secret_no_crea_directorios` (D-02, preservada) | validación antes de efectos | `S3` |
| `con_configuracion_valida_crea_los_directorios` (D-02, preservada) | arranque válido crea `DATA_DIR` | `S3` |

Núcleo puro en `src/config.rs` (`mod tests_raices`, 18 pruebas nuevas): `APP_ROOT` por defecto y
declarada (absoluta, existente, sin ejecutable), las seis ramas de la tabla de `DATA_DIR`
(Linux servicio/usuario con y sin XDG, Windows servicio/usuario), «declarada gana» en las seis
combinaciones, independencia del CWD, y las cuatro ramas de la guardia de base heredada (incluida
`base_heredada_que_no_es_archivo_se_reporta`).

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

### 5.4 RED y GREEN de la ronda de corrección (B1, B2, A3)

Los cuatro comportamientos nuevos se escribieron antes del arreglo. Dos de ellos (el señuelo con
travesía y la reutilización de la base declarada) **pasaban ya** sobre `afb27d8`: son sondas de
regresión que fijan el comportamiento correcto del núcleo, no defectos. Los otros dos dieron RED:

| Prueba | RED observado sobre `afb27d8` | GREEN observado después |
|---|---|---|
| `tests/instalador.sh` — forma por tubería (B1) | `FALLO: la invocación documentada «cat install.sh | bash» salió ≠ 0` · en el log: `❌ No se encontró el template de la unidad: /tmp/educonect-instalador.GKxWsf/cwd/../deploy/educonect.service`, después de crear `config frontend modulos scripts static` | `OK: instalador — clon y tubería salen 0; …`, exit **0** |
| `tests/instalador.sh` — `ReadWritePaths` (B2) | `FALLO: clon: ReadWritePaths es '/var/lib/educonect' y Environment=DATA_DIR es '/tmp/educonect-instalador.GKxWsf/var/educonect-datos': con ProtectSystem=strict el servicio no podría escribir sus datos` | idem anterior |
| `base_heredada_dir_ilegible_no_arranca_vacia` (A3) | con `setpriv --reuid=65534` (no root): `el proceso no terminó en 30s: se lo mató. Un arranque inválido debe salir, no quedarse sirviendo` — el proceso había creado `xdg/educonect/educonect.db`, aplicado migraciones y semillas y estaba escuchando | `1 passed; 0 failed; finished in 0.05s`: sale ≠ 0 en el acto |
| `app_root_no_depende_del_cwd` con señuelo y travesías | `ok` ya en `afb27d8` (el núcleo estaba bien); se conserva como sonda | `ok` |
| `data_dir_declarada_reutiliza_misma_base_sin_crear_otra` | `ok` ya en `afb27d8` (persistencia ya correcta); se conserva como sonda | `ok` |

Nota de método: `base_heredada_dir_ilegible_no_arranca_vacia` incluye un `chmod 0000` y **se declara
omitida si el runner es root**, porque root atraviesa el permiso y el caso no se reproduciría. La
corrida real de RED y GREEN se hizo como `nobody` con `setpriv` dentro del contenedor; el modo root
imprime `OMITIDA: el usuario es root (o equivalente), 0000 no impide el sondeo`.

### 5.5 Instalación real por tubería, de punta a punta (evidencia manual)

`tests/instalador.sh` usa un binario ficticio y stubs. Para comprobar que la instalación por tubería
deja un servicio **arrancable** se hizo además una corrida manual: directorio limpio, binario real
compilado, `DATA_DIR` declarada **relativa** (`../datos-relativos`), stubs solo de
`apt`/`wget`/`useradd`/`chown`/`systemctl`.

```
INSTALAR_POR_TUBERIA_EXIT=0
--- unidad renderizada ---
User=educonect
WorkingDirectory=/tmp/e2e3.jmWtos/opt/educonect
ExecStart=/tmp/e2e3.jmWtos/opt/educonect/edu-conect-rural-server
Environment=DATA_DIR=/tmp/e2e3.jmWtos/datos-relativos      ← absoluta, resuelta desde el CWD
Environment=LISTEN_ADDR=0.0.0.0:8080
EnvironmentFile=/tmp/e2e3.jmWtos/etc/educonect.env         ← chmod 600
ReadWritePaths=/tmp/e2e3.jmWtos/datos-relativos            ← igual a Environment=DATA_DIR
--- unidad instalada en SYSTEMD_DIR --- identica
--- --check con el EnvironmentFile generado, desde otro CWD ---
CHECK_EXIT=0  ·  No se realizaron modificaciones.
--- archivos bajo DATA_DIR --- biblioteca contenido videos
--- nada creado en el CWD limpio --- 0
```

Efecto secundario de esta corrida, corregido: `install.sh` hacía `cp` a `SYSTEMD_DIR` sin crear el
directorio, así que un `SYSTEMD_DIR` propio (o la primera instalación en un sistema sin
`/etc/systemd/system`) fallaba con `cp: cannot create regular file`. Ahora lo crea.

---

## 6. Lanzadores por plataforma (T3)

| Archivo | Qué hace | Layout |
|---|---|---|
| `edu-conect-rural-server/install.sh` | **fuente única** del template systemd: lo lleva **dentro** (heredoc `unidad_systemd`), así que funciona igual por clonación y por tubería. Sustituye `@APP_ROOT@`, `@BINARIO@`, `@DATA_DIR@` y `@ENV_FILE@` por rutas absolutas (`renderizar_unidad`, `install.sh:130`) y falla si queda algún marcador | plano: `ExecStart=@APP_ROOT@/edu-conect-rural-server` |
| `deploy/educonect.service` | **copia generada** del template: `bash edu-conect-rural-server/install.sh --print-unit > deploy/educonect.service`. `tests/instalador.sh` la compara byte a byte con la salida del instalador, así no se desincroniza | ídem |
| `edu-conect-rural-server/deploy/` | **compatibilidad**: `install.sh` delega en el instalador único (`exec ../install.sh "$@"`) y `educonect.service` es la misma copia generada. La unidad vieja (`User=pi`, `ExecStart=/opt/educonect/server/…`, `DB_PATH`, `FRONTEND_PATH=/opt/educonect/dashboard/out`) **ya no existe** | ídem |
| `deploy/windows/educonect.bat` | lanzador sin privilegios; raíz explícita y `DATA_DIR=%LOCALAPPDATA%\EduConect`; secretos en `%DATA_DIR%\educonect.env` (respaldo: `%APP_ROOT%\config\educonect.env`) y aviso si falta | plano: el `.bat` se copia junto al `.exe` |
| `deploy/windows/instalar-tarea.ps1` | inicio automático al iniciar sesión (tarea programada). **No** se registra un servicio con `sc.exe`: el binario no implementa el protocolo del SCM y fallaría con error 1053; se documentan las dos vías reales (tarea programada o NSSM) | ídem |

`install.sh` mueve el binario a la raíz (`install.sh:209`), declara `DATA_DIR=/var/lib/educonect` fuera
del paquete, absolutiza `INSTALL_DIR` y `DATA_DIR` antes de renderizar la unidad (`install.sh:182`,
`install.sh:190`) y crea el usuario `educonect`. `SYSTEMD_DIR` (def. `/etc/systemd/system`) permite
elegir el destino de la unidad. Los secretos **no** se inventan: si el operador los pasa, se escriben
en el `EnvironmentFile`; si no, el instalador advierte y nombra el archivo, porque provisionarlos es
T2 y las validaciones no se relajan (12 caracteres de contraseña, 32 de `JWT_SECRET`).

### 6.1 Endurecimiento de los lanzadores de Windows (revisión de código, sin máquina Windows)

| Defecto | Arreglo en `instalar-tarea.ps1` |
|---|---|
| Reejecutar fallaba con la tarea ya registrada (sin `-Force` ni baja previa) bajo `$ErrorActionPreference="Stop"` | `Register-ScheduledTask … -Force`, con `try/catch` que informa y sale 1 |
| `-AtLogOn` sin `-User` significa «cualquier usuario» y registrarlo exige elevación, contra el «sin administrador» del encabezado | `New-ScheduledTaskTrigger -AtLogOn -User $Identidad` y `New-ScheduledTaskPrincipal -LogonType Interactive -RunLevel Limited`, con `$Identidad = WindowsIdentity::GetCurrent().Name` |
| `-Quitar` ocultaba fallos (`SilentlyContinue`) y dejaba la variable de usuario `DATA_DIR` apuntando a un directorio que nadie usa | comprueba la tarea antes, informa el error real y sale 1; elimina `DATA_DIR` de usuario **solo** si vale exactamente el `$DataDir` de este script |
| Los secretos se buscaban en `%APP_ROOT%\config\educonect.env`, legible por `Users` en un paquete compartido, y nadie los generaba | se generan con `RandomNumberGenerator` en `$DataDir\educonect.env` (64 y 24 caracteres base64) y se restringe el ACL con `icacls /inheritance:r` a usuario actual + `SYSTEM` + Administradores (por SID, `*S-1-5-32-544`). Si existe el archivo viejo en el paquete, se avisa |

**Lo que sigue sin poder verificarse aquí:** el script no se ejecutó en Windows. Quedan sin prueba real
`Register-ScheduledTask`/`-Force` sobre una tarea existente, el comportamiento de
`New-ScheduledTaskTrigger -AtLogOn -User` sin elevación, la sintaxis exacta de `icacls` en un Windows
traducido, la lectura de `%DATA_DIR%\educonect.env` por `for /f` en `cmd.exe` y el disparo real al
iniciar sesión. Todo eso es revisión de código, declarado como riesgo (`S11`).

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
| `install.sh` **sí** se ejecuta de punta a punta desde la ronda de corrección: `tests/instalador.sh` lo corre completo (root, `apt`/`wget`/`useradd`/`chown`/`systemctl` como stubs, `INSTALL_DIR`/`DATA_DIR`/`ENV_FILE`/`SYSTEMD_DIR` en un temporal) en las formas clon y tubería, y con `DATA_DIR` absoluta y relativa. Lo que **no** se prueba es el efecto real de `apt`, `useradd` ni el arranque por systemd | probado con stubs; systemd real no |
| Los lanzadores de Windows no se ejecutaron en Windows (no hay máquina): `.bat` y `.ps1` son revisión de código (§6.1 enumera qué queda sin verificar) | `S11` |
| La unidad systemd no se arrancó con systemd real en este entorno | declarado |
| `tests/integration_test.rs` falla 3/3 en el contenedor **solo** porque `/workspace` es un montaje de solo lectura y esas pruebas abren `data/*.db` relativo: el mismo binario compilado pasa 3/3 desde un CWD escribible (`/tmp/cwd-integracion`) | ambiental, no regresión |
| `cargo clippy --all-targets` reporta dos avisos **preexistentes** en archivos no tocados: import sin usar en `tests/integration_test.rs:12` y `rate_limit::reset` sin uso (`src/rate_limit.rs:53`). El comando de CI (`cargo clippy -- -D warnings`) sale 0 | preexistente |
| `cargo fmt --check` fallaba ya en `6c3d70e` (regiones de `src/config.rs` y del archivo de pruebas); se formateó en esta ronda, así que el paso de formato de CI queda verde. Es un cambio **solo de formato** en los dos archivos que la entrega ya tocaba | resuelto |
| `base_heredada_dir_ilegible_no_arranca_vacia` **se omite** cuando el runner es root (root atraviesa el `0000`). La corrida real de RED y GREEN se hizo como `nobody`; en el contenedor habitual imprime `OMITIDA` y no falla | limitación de la prueba, declarada |
| Un `data/` heredado ilegible ahora **impide arrancar** aunque no haya ninguna base dentro: el sondeo no puede distinguir «no hay» de «no puedo ver», y se elige fallar antes que arrancar vacío | intencional (A3) |
| La ruta de descarga de archivos de curso (`/api/cursos/{id}/archivo`) sigue sin existir: es **T5**, no una regla de D-03. El intento anterior la probaba dentro de esta suite; se retiró para no dar por cubierta una capacidad ausente | fuera de alcance |
| `APP_ROOT` declarada relativa ahora es error (antes no existía la variable): un despliegue que la declare con ruta relativa falla con mensaje explícito | intencional |
| Empaquetado: `out/` del dashboard no está generado en el repositorio, así que `APP_ROOT/frontend` estará vacío hasta que el empaquetado copie el export | riesgo ya registrado en §D-03 |
| Quedan **dos** copias versionadas del template (`deploy/educonect.service` y `edu-conect-rural-server/deploy/educonect.service`). La prueba exige que ambas sean iguales a `install.sh --print-unit`, así que no pueden desincronizarse, pero lo ideal es quedarse con una sola cuando la política de entrega lo permita | deuda declarada |

---

## 9. Mapa de la entrega

| Archivo | Cambio |
|---|---|
| `src/config.rs` | `APP_ROOT` (resolución y validación), tabla de `DATA_DIR` por plataforma y contexto, guardia de base heredada con `Result` (A3), default de `frontend` bajo `APP_ROOT`, `APP_ROOT` en `verificar`, 18 pruebas puras |
| `src/main.rs` | `app_root` en `AppState`; `verificar` antes de cualquier efecto (`:303`); `/modulos`, `/static`, `/api/modulos` y dashboard desde `APP_ROOT` (`:487`, `:498`, `:1917`) |
| `tests/arranque_sin_config.rs` | 9 pruebas del binario real con esperas acotadas, socket con timeout y muerte garantizada; señuelo de CWD y travesías en `app_root_no_depende_del_cwd`; reinicio con el mismo `DATA_DIR`; `data/` heredado ilegible |
| `tests/instalador.sh` | nueva sonda del instalador: clon y tubería, `ReadWritePaths` == `Environment=DATA_DIR` (absoluta y relativa), `ExecStart` ejecutable, `EnvironmentFile` 0600, sin marcadores, y template versionado sincronizado |
| `install.sh` | template embebido (`--print-unit`), layout plano, `DATA_DIR` fuera del paquete y absolutizada, `SYSTEMD_DIR`, usuario de servicio, `EnvironmentFile` con secretos |
| `start.sh` | `DATA_DIR` en lugar de `DB_PATH`; frontend por defecto bajo `APP_ROOT`; sin `cd` implícito a un layout que ya no existe |
| `scripts/check-hotspot.sh` | el binario se busca en la raíz de `APP_ROOT`, no en `bin/` |
| `deploy/educonect.service` | copia generada del template (`--print-unit`) |
| `edu-conect-rural-server/deploy/` | `install.sh` delega en el instalador único; la unidad vieja se sustituye por la copia generada |
| `deploy/windows/*` | endurecimiento revisado abajo (§6.1): `-Force`, disparador por usuario, `-Quitar` honesto, secretos generados y con ACL restringido en `DATA_DIR` |
