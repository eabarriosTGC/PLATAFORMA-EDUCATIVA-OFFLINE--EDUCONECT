# Matriz de funciones por plataforma — T7 (`S11`)

**Qué responde este documento:** para cada uno de los cuatro destinos de ejecución posibles —
PC de escritorio Linux, PC Linux corriendo como servicio `systemd`, PC de colegio (Windows) y
Raspberry Pi (ARM) — qué funciones **funcionan**, cuáles **se degradan** (y con qué código HTTP y
qué mensaje exacto) y cuáles **no existen**.

**Base:** `origin/main` @ `7f93210`, árbol `/tmp/educonect-wt/t7-matriz`. Todo `ruta:línea` citado
aquí se refiere a ese árbol. **Convención de rutas:** los archivos de código se citan con su ruta
completa la primera vez (`edu-conect-rural-server/src/main.rs`) y abreviados después (`src/main.rs`,
`install.sh`, `deploy/…`, `scripts/…`, `tests/…`); todos los abreviados viven bajo
`edu-conect-rural-server/`.

**Origen del pedido (`S11`, verbatim del humano):** «la raspberry es una alternativa, pero lo mas
probable es que sea en un pc normal, tambien debemos pensar que pueda ser utilizada en colegios,
osea en pc de colegios o computadores de profesores».

---

## 0. Cómo leer este documento antes de creerle a una celda

### 0.1 Advertencia que encabeza todo

> **En esta máquina no hay Windows, no hay ARM y no hay Raspberry Pi.** Ninguna celda de la columna
> *Windows* procede de una ejecución en Windows: procede de la ejecución del `.exe` **bajo Wine**
> (`docs/sprint2/win-cross-build.md`) o de lectura de código. Ninguna celda de la columna
> *Raspberry Pi* procede de una ejecución en ARM: todas son lectura de código o no verificadas.
> Las celdas de Linux proceden de contenedores Debian (`docs/sprint2/d01-verificacion.md`,
> `docs/sprint1-informe-p0-dev3.md`), **no de un PC de escritorio con entorno gráfico**.

Una celda marcada «leído» no es una celda medida. El riesgo declarado de esta unidad en
`T07.md` es exactamente ese: «que una celda completada leyendo código parezca medida». Por eso cada
celda lleva su etiqueta.

### 0.2 Etiquetas de evidencia

| Etiqueta | Significado |
|---|---|
| **[M]** | **Medido**: alguien ejecutó el binario/servicio y observó ese código y ese cuerpo. Se cita el documento donde quedó registrado. |
| **[L]** | **Leído**: se deduce de código o de un documento de diseño. No se ejecutó. |
| **[I]** | **Inferido**: consecuencia razonada, no observada (por ejemplo, el piso de Windows 8+). |
| **[N]** | **No verificado**: no hay evidencia disponible de ninguna clase. |

### 0.3 Estados de celda

| Símbolo | Significado |
|---|---|
| **FUNCIONA** | Responde correctamente en ese destino. |
| **SE DEGRADA** | Responde con un error explícito y estable, o funciona a medias. Se transcribe el código y el mensaje. |
| **NO DISPONIBLE** | La capacidad no existe en ese destino (ni compilada, ni lanzable). |

### 0.4 Sobre las columnas

Las cuatro columnas son las que pide `T07.md`. **Docker no es una columna**: es el único lugar donde
hoy casi todo está medido y funcionando, y por eso aparece citado como evidencia. Un contenedor no es
un destino de un colegio.

---

## 1. La matriz

| # | Función | Linux escritorio | Linux servicio (`systemd`) | Windows (PC de colegio) | Raspberry Pi (ARM) |
|---|---|---|---|---|---|
| **0** | **Arranque: secretos (`JWT_SECRET`, `ADMIN_INITIAL_PASSWORD`)** | **SE DEGRADA** — sin `JWT_SECRET` el proceso no arranca: `[ERROR] JWT_SECRET: …` y `exit 1`; sin `ADMIN_INITIAL_PASSWORD` la prevalidación **pasa con un aviso** y muere después en `Error al abrir la base de datos: Validacion("ADMIN_INITIAL_PASSWORD no está definida o está vacía… (mínimo 12 caracteres).")` [M]+[L] | **SE DEGRADA** — la unidad generada por `install.sh` no lleva ninguno de los dos secretos: arranca y muere en bucle (`Restart=on-failure`) [M]+[L] | **SE DEGRADA** — mismo comportamiento [L]; con las dos variables puestas responde `/health` 200 [M] | **SE DEGRADA** — idéntico a Linux [L] |
| **1** | **Wikipedia / ZIM** (`/zim/*`, `/api/wikipedia/*`) | **SE DEGRADA** — perfil por defecto sin feature: `503 {"capacidad":"zim","error":"capacidad zim no incluida en esta compilación"}` [M] | **SE DEGRADA** — idéntico [M] | **SE DEGRADA** — idéntico, medido bajo Wine [M] | **SE DEGRADA** (perfil por defecto, esperado) [L]; con `--features zim` en aarch64: **[N]** |
| **2** | **TTS** (`/api/tts`, `espeak-ng`) | **SE DEGRADA** — dos causas: sin `espeak-ng` → `500 {"error":"Error al ejecutar espeak-ng: …"}` [L]/[I]; con `espeak-ng` pero sin la voz mbrola → `500 {"error":"espeak-ng falló: …"}` [L] | **SE DEGRADA** — idéntico (depende del PATH del servicio) [L] | **SE DEGRADA** — `500 {"error":"Error al ejecutar espeak-ng: program not found"}`, medido bajo Wine [M] | **SE DEGRADA** — esperado idéntico [N] |
| **3** | **Codificación H.264** (`/api/videos/convertir`, `ffmpeg`) | **SE DEGRADA** — la detección puede elegir `h264_v4l2m2m` en un x86 sin dispositivo V4L2 y la conversión falla: `ffmpeg: Could not find a valid device` (exit 234) [M en el host de trabajo] | **SE DEGRADA** — idéntico [L] | **SE DEGRADA** — el arranque registra `🎥 Encoder H.264 seleccionado: libx264` por la rama de fallo (no hay `ffmpeg`) [M]; convertir responde `500 {"error":"ffmpeg falló: …"}` [L] | **SE DEGRADA** — `h264_v4l2m2m` es la ruta prevista y la Pi tiene el dispositivo, pero nunca se ejecutó [N] |
| **4** | **Descarga de video** (`/api/videos/descargar`, `yt-dlp`) | **SE DEGRADA** — sin `yt-dlp`: `500 {"error":"Error ejecutando yt-dlp: …"}`; con `yt-dlp` exige además `ffmpeg` y **salida a Internet** [L] | **SE DEGRADA** — idéntico [L] | **SE DEGRADA** — `yt-dlp` y `ffmpeg` no existen en un Windows limpio; el error es el mismo [L] | **SE DEGRADA** — idéntico, y sin Internet no sirve aunque el binario exista [N] |
| **5** | **Base SQLite** (migraciones, semillas, FTS5, WAL) | **FUNCIONA** — `rusqlite` con `bundled`: SQLite compilado dentro del binario [M] | **FUNCIONA** — idéntico [M] | **FUNCIONA** — binario de un solo archivo (0 importaciones de `sqlite3.dll`), base de 5 062 656 bytes creada en arranque limpio bajo Wine [M] | **FUNCIONA** — misma dependencia `bundled`, independiente de arquitectura [L] |
| **6** | **Activos estáticos y módulos** (`/`, `/static/*`, `/modulos/*`, panel) | Landing `/` **FUNCIONA** (HTML embebido en el binario) [M]; `/static/*` **FUNCIONA** solo si el CWD contiene `static/`; `/modulos/*` **SE DEGRADA → 404** salvo que el CWD contenga `modulos/` [L] | **SE DEGRADA** — `/` **FUNCIONA** (embebido); `/static/*` y `/modulos/*` → **404**: `install.sh` no copia ninguno de los dos árboles y el `CWD` del servicio es `/opt/educonect` [L] | `/` **FUNCIONA** — 200 desde el handler `landing_page`, no desde el bundle [M]; `/static/*`, `/modulos/*`, panel → **404** (nada los despliega) [L] | **SE DEGRADA** — igual que el servicio Linux [L] |
| **7** | **Lanzadores / puesta en marcha** | **FUNCIONA** con reservas — `start.sh` compila si falta el binario y arranca [L] | **SE DEGRADA** — `install.sh` instala una unidad a la que le faltan los secretos, y la unidad versionada `deploy/educonect.service` describe **otro** despliegue (`User=pi`, `/opt/educonect/server/…`) [L] | **NO DISPONIBLE** — no hay lanzador ni paquete Windows versionado en `main` [L] | **SE DEGRADA** — `install.sh` se declara «para Raspberry Pi» y mapea `aarch64`/`armv7l`, pero descarga desde una URL de ejemplo y nunca se ejecutó en una Pi [N] |
| **8** | **Biblioteca PDF** (`/biblioteca/*`, `/api/biblioteca`) | **SE DEGRADA** — el catálogo lista lo que haya en `DATA_DIR/biblioteca`; ningún instalador propio lo llena (solo la imagen Docker descarga 16 PDFs) [L] | **SE DEGRADA** — idéntico [L] | **SE DEGRADA** — directorio vacío en una instalación nueva [L] | **SE DEGRADA** — idéntico [L] |
| **9** | **Hotspot WiFi** (`hostapd` + `dnsmasq`) | **SE DEGRADA** — `scripts/setup-hotspot.sh` exige `ip iptables sysctl hostapd dnsmasq cp pgrep` y nombra los que falten [L] | **SE DEGRADA** — es `ExecStartPre` de la unidad: si falla, el servicio **no arranca** [L] | **NO DISPONIBLE** — no existe equivalente: `hostapd`/`dnsmasq` son de Linux [L] | **SE DEGRADA** — es el caso de diseño (IP `10.0.0.1` en `wlan0`), nunca medido en una Pi [N] |

**Cómo se lee una fila que dice «se degrada»:** casi todas degradan *honestamente* —503 con mensaje
canónico, 500 con la causa— y no derriban el proceso. Los casos donde la degradación es **muda**
(404 sin explicación) son `/static/*`, `/modulos/*` y el panel: la fila 6.

---

## 2. Evidencia por fila

### Fila 0 — Arranque y secretos

| Hecho | Evidencia |
|---|---|
| `JWT_SECRET` es obligatorio, se valida al cargar la configuración y **no** produce pánico: el arranque informa y sale con 1 | `src/config.rs:379-392` (acumula `Hallazgo::error("JWT_SECRET", …)`) y `src/main.rs:286-293` (`config::informar(&hallazgos); std::process::exit(1)`) |
| `ADMIN_INITIAL_PASSWORD` **ausente es aviso, no error**, porque sólo se exige cuando la base necesita crear o rotar el administrador | `src/config.rs:443-452` |
| Con la base necesitando administrador, la ausencia sí es error: `ADMIN_INITIAL_PASSWORD no está definida o está vacía. Se necesita para crear o migrar el administrador inicial (mínimo 12 caracteres).`, y llega como **pánico** porque el `Result` de `Database::open` se consume con `expect` | `src/config.rs:30-36` (mensaje, única fuente de verdad) · `src/db.rs:379-382` · `src/main.rs:317` (`expect("Error al abrir la base de datos")`) |
| Mínimo real: **12 caracteres**; `admin123` está prohibida por lista | `src/config.rs:20` (`LONGITUD_MINIMA_PASSWORD = 12`) y `src/config.rs:37-42` |
| Pánico observado en instalación limpia, con migraciones y semillas **ya aplicadas** antes de morir | `docs/sprint1-informe-p0-dev3.md` §3 (B1, B2; base `a27adec`) [M]. En esa base el caso de `JWT_SECRET` era un pánico de `config.rs:20`; en `main` el mismo caso es `[ERROR] JWT_SECRET: …` + `exit 1`. Mismo comportamiento, **texto distinto** (cambió con D-02) |
| La unidad de `systemd` **no** provisiona ninguno de los dos secretos | `edu-conect-rural-server/install.sh:180-200`: el heredoc define `User`, `ExecStart`, `DB_PATH`, `FRONTEND_PATH`, `LISTEN_ADDR`; ni `JWT_SECRET` ni `ADMIN_INITIAL_PASSWORD` |
| Dos despliegues incompatibles con el mismo nombre | `install.sh:180-200` frente a `edu-conect-rural-server/deploy/educonect.service:8-15` (`User=pi`, `ExecStart=/opt/educonect/server/…`). Comparación completa en `docs/sprint1-informe-p0-dev3.md` §4 (B5) [L] |
| Con las dos variables puestas, el `.exe` llega a `/health` 200 | `docs/sprint2/win-cross-build.md` §6 [M] |

**Consecuencia de matriz:** la fila 0 no distingue plataformas: es la misma condición para las
cuatro. Ninguna instalación limpia arranca sin que un humano ponga los dos secretos, y el mensaje que
ve el operador depende de **cuál** de los dos falte.

### Fila 1 — Wikipedia / ZIM

Cómo se consume `libzim` — es una **dependencia de enlace en compilación**, no un proceso externo:

| Hecho | Evidencia |
|---|---|
| La feature `zim` está apagada por defecto y arrastra `zim-rs`, cuyo `build.rs` hace `pkg_config::probe_library("libzim").unwrap()` | `edu-conect-rural-server/Cargo.toml:7-14` |
| El lector usa el crate directamente (`use zim_rs::archive::Archive`) → enlace dinámico, no `dlopen` | `edu-conect-rural-server/src/zim_proxy.rs:11` |
| Las seis rutas están **siempre registradas**; sin la feature las atiende un handler de degradación | `src/main.rs:369-387` (dos definiciones de `zim_routes` según `cfg`) |
| Mensaje canónico, un único `const` compartido por JSON y HTML | `src/main.rs:1626-1670` (`ZIM_NO_DISPONIBLE = "capacidad zim no incluida en esta compilación"`) |
| Contrato medido (503 JSON / 503 HTML, y 404 que **no** se traga) | `docs/sprint2/d01-verificacion.md` §6 [M] |
| Medido también en el `.exe` bajo Wine | `docs/sprint2/win-cross-build.md` §7 [M] |
| El perfil por defecto no enlaza la cadena ZIM: 5 entradas de `ldd` frente a 15 | `docs/sprint2/d01-verificacion.md` §3 [M] |
| La compuerta de CI lo impide: 0/1/2 con «no verificable ≠ aprobado» | `docs/sprint2/dci2-ldd.md` §3 [M] |
| Límite declarado: `ldd` prueba **enlace**, no `dlopen` ni un `libzim.a` estático | `docs/sprint2/dci2-ldd.md` §6 (F3) |
| Nunca se cargó un `.zim` real: el repositorio no contiene ninguno | `docs/sprint2/d01-verificacion.md` §10, punto 3 |

**Defecto que esta fila descubre y conviene registrar:** la imagen Docker instala `libzim8` en
runtime (`Dockerfile:71`), copia un `.zim` real (`Dockerfile:97`) y **compila el servidor sin la
feature** (`Dockerfile:15`: `cargo build --release`, sin `--features zim`). Resultado: el contenedor
distribuye un archivo `.zim` que su propio binario sólo sabe responder con 503 [L — leído, no
medido].

### Fila 2 — TTS (`espeak-ng`)

Se invoca como **proceso externo**, con argumentos fijos:

| Hecho | Evidencia |
|---|---|
| `Command::new("espeak-ng")` con `-v es-es+mbrola-3 -s <rate> -p 40 -w /dev/stdout` | `src/main.rs:917-928` |
| Sin binario: `"Error al ejecutar espeak-ng: {e}"` → 500 | `src/main.rs:931` y `src/main.rs:961` |
| El binario existe pero falla: `"espeak-ng falló: {stderr}"` → 500 | `src/main.rs:939` |
| Medido bajo Wine: `500 {"error":"Error al ejecutar espeak-ng: program not found"}` | `docs/sprint2/win-cross-build.md` §7 [M] |
| La voz `es-es+mbrola-3` exige datos mbrola que **`Dockerfile:71` no instala** (sólo `espeak-ng`): causa del 500 incluso con espeak presente | `docs/diagnostico-2026-11-25.md` §6, defecto 10 [L] |
| `start.sh` sólo avisa: `⚠️ TTS: espeak-ng no instalado. Opcional: dnf install espeak-ng` | `start.sh:20-25` [L] |

**Matiz que importa para la matriz:** en Linux hay **dos degradaciones distintas** con el mismo 500.
La primera (falta el binario) se arregla instalando `espeak-ng`. La segunda (falta la voz mbrola) **no**
se arregla instalando `espeak-ng`: el argumento `-v es-es+mbrola-3` está fijado en el código y el
proceso sale con error si la voz no existe. Sólo se corrige instalando los datos mbrola **o** cambiando
esa línea. Y `-w /dev/stdout` es una ruta POSIX: en Windows no es un destino válido [I].

### Fila 3 — Codificación H.264 (`ffmpeg`)

| Hecho | Evidencia |
|---|---|
| Al arrancar se ejecuta `ffmpeg -encoders -v quiet` **incondicionalmente** | `src/main.rs:146-162`, llamado en `src/main.rs:329` |
| Si el proceso falla, devuelve la constante `"libx264"` — es la rama de fallo de una detección real, no un texto fijo | `src/main.rs:151-153` |
| La detección es por **presencia de la cadena** `h264_v4l2m2m` en la lista de encoders, no por probar el dispositivo | `src/main.rs:155-162` |
| Convertir: `-c:v <encoder>` con `-preset medium -crf 20`; el error devuelve el stderr de `ffmpeg` | `src/main.rs:1280-1312` |
| Bajo Wine (sin `ffmpeg`) el log dice `🎥 Encoder H.264 seleccionado: libx264` | `docs/sprint2/win-cross-build.md` §6 y §9 [M] |

**Medición nueva de esta unidad (Linux x86_64, host de trabajo, `ffmpeg n9.0.2`):**

```
$ ffmpeg -encoders -v quiet | grep -i h264
 V..... h264_v4l2m2m         V4L2 mem2mem H.264 encoder wrapper (codec h264)
 V....D libx264              libx264 H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10 (codec h264)
 ... (amf, nvenc, qsv, vaapi, vulkan, libx264rgb)

$ ffmpeg -v error -i in.mp4 -c:v h264_v4l2m2m -preset medium -crf 20 -c:a aac -b:a 64k \
         -ac 1 -vf "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease" \
         -movflags +faststart -threads 2 -y out.mp4      # mismos argumentos que src/main.rs:1280-1301
[h264_v4l2m2m @ …] Could not find a valid device
[h264_v4l2m2m @ …] can't configure encoder
Error while opening encoder - maybe incorrect parameters …
H264_V4L2M2M_EXIT=234        out.mp4 = 0 bytes
```

Es decir: en un Linux de escritorio con este build de `ffmpeg`, `detect_h264_encoder()` devuelve
`h264_v4l2m2m` (porque el encoder **está compilado**, aunque no haya hardware), y
`/api/videos/convertir` responde `500 {"error":"ffmpeg: [h264_v4l2m2m …] Could not find a valid device …"}`.
**La degradación es un 500 correcto pero engañoso**: el mensaje no dice «el encoder elegido no sirve
en esta máquina», y el usuario no puede cambiarlo sin editar código.

Alcance de esta medición: es **el host de trabajo**, no un PC de colegio; se midió `ffmpeg`, no el
servidor. La distribución elegida decide el resultado: un build de `ffmpeg` que no anuncie
`h264_v4l2m2m` hace que la detección caiga en `libx264` y la conversión funcione [I].

### Fila 4 — Descarga de video (`yt-dlp`)

| Hecho | Evidencia |
|---|---|
| `Command::new("yt-dlp")` con `--format … --merge-output-format mp4 --embed-thumbnail --print filename` | `src/main.rs:1188-1218` |
| Sin binario: `"Error ejecutando yt-dlp: {e}"` → 500 | `src/main.rs:1204` |
| El binario existe y falla: `"yt-dlp falló: {stderr}"` → 500 | `src/main.rs:1207` |
| `--embed-thumbnail` y `--merge-output-format mp4` requieren `ffmpeg` en el PATH: sin él la descarga **puede** completarse pero el post-proceso falla | [I] por los argumentos de `src/main.rs:1197-1200` |
| El endpoint no tiene ninguna comprobación de conectividad: en un colegio sin Internet, el fallo sale desde `yt-dlp` | `src/main.rs:1165-1218` [L] |
| `scripts/download-videos.sh` exige explícitamente ambos binarios antes de empezar | `edu-conect-rural-server/scripts/download-videos.sh:63` [L] |

### Fila 5 — Base SQLite

| Hecho | Evidencia |
|---|---|
| `rusqlite` con `bundled`: SQLite se compila desde C y se enlaza estáticamente | `edu-conect-rural-server/Cargo.toml:20` |
| El PE no importa `sqlite3.dll` y la versión incrustada es 3.51.3 (la del crate, no la del sistema) | `docs/sprint2/win-cross-build.md` §2.1 y §4 [M] |
| Arranque limpio crea la base, aplica migraciones, semillas, admin inicial y FTS5 | `docs/sprint2/win-cross-build.md` §6 [M] |
| `journal_mode = WAL` fijado una vez, fuera de transacción, con prueba propia | `src/db.rs:84-105` y `src/db.rs:1039-1049` [M] |

Es la única fila donde las cuatro columnas son **FUNCIONA** sin asterisco de mensaje: es la única
dependencia nativa que el proyecto resolvió bien (compilada dentro, sin DLL, sin PATH).

### Fila 6 — Activos estáticos y módulos

| Hecho | Evidencia |
|---|---|
| `/modulos` se sirve con `ServeDir::new("modulos")`: **relativo al CWD** | `src/main.rs:474` |
| `/static` se sirve con `ServeDir::new("static")`: **relativo al CWD** | `src/main.rs:485` |
| El panel cae en `ServeDir::new(&state.frontend_path)`, cuyo default es `../edu-conect-rural-dashboard/out/` | `src/main.rs:490` y `src/config.rs:426-428` |
| `/api/modulos` escanea `"modulos"` y `"modulos/phet"` relativos al CWD; si el directorio no existe, `read_dir` falla y la función **devuelve un vector vacío sin error**: el catálogo queda vacío, no da 500 | `src/main.rs:1902-1907` y `src/main.rs:1930-1935` |
| La landing y las páginas embebidas **no** dependen del disco: 9 `include_str!` en el binario | `src/main.rs` (p. ej. `landing_page` en `src/main.rs:195-196`, `include_str!("../static/index.html")`) |
| En el contenedor `/modulos/*` responde 200 y `/api/modulos` devuelve exactamente 61 módulos | `docs/sprint1-informe-p0-dev3.md` §4 (B3) [M] |
| Fuera del contenedor, `install.sh` no copia `modulos/` ni `static/`; la copia del frontend busca `$INSTALL_DIR/../edu-conect-rural-dashboard/out/`, que no existe en `/opt` | `edu-conect-rural-server/install.sh:261-266` [L] |
| Bajo Wine, `/` responde 200 desde el handler y **no** desde el bundle (no se copió `frontend/out/`) | `docs/sprint2/win-cross-build.md` §7, nota 4 [M] |

### Fila 7 — Lanzadores

| Destino | Qué hay hoy | Evidencia |
|---|---|---|
| Linux escritorio | `start.sh`: compila si falta el binario, avisa si falta `espeak-ng`, arranca | `start.sh:10-28` [L] |
| Linux servicio | `install.sh` genera la unidad; `deploy/educonect.service` es otra unidad distinta | `install.sh:180-208`; `edu-conect-rural-server/deploy/educonect.service:8-15` [L] |
| Linux servicio | La unidad lleva `ExecStartPre=…/setup-hotspot.sh`: si el hotspot falla, el servicio no arranca | `install.sh:190` [L] |
| Linux servicio | El binario se descarga de `BIN_URL`, que vale `https://github.com/tuusuario/…`: si la descarga falla, **avisa y continúa** | `install.sh:22` y `install.sh:70-80` [L] |
| Todos | `install.sh` instala `ffmpeg` y `libzim-dev` pero **no** `espeak-ng` ni `yt-dlp` | `install.sh:54-58` [L] |
| Raspberry Pi | `install.sh` mapea `aarch64`/`arm64` → `…-aarch64` y `armv7l`/`armhf` → `…-armv7`, y aborta en cualquier otra arquitectura | `install.sh:26-32` [L] |
| Raspberry Pi | `cross-compile.sh` apunta a `aarch64-unknown-linux-musl` y exige `aarch64-linux-musl-gcc`; sin él sale ≠ 0 | `edu-conect-rural-server/cross-compile.sh:15-38` [L] |
| Windows | **No existe** lanzador ni paquete en `main`. Los `.bat`/`.ps1` viven sólo en la rama sin fusionar `feature/d03-app-root` | `docs/sprint2/d03-layout-portable.md` §6 (leído con `git show origin/feature/d03-app-root:…`) [L] |
| Windows | El `.exe` medido se produjo con una receta de Docker **fuera del repositorio** (`$HOME/educonect-dev-env/`): no se clona | `docs/sprint2/win-cross-build.md` §10 [M] |

### Fila 8 — Biblioteca PDF

| Hecho | Evidencia |
|---|---|
| `/api/biblioteca` lista «con disponibilidad real de archivos» dentro de `DATA_DIR/biblioteca` | `src/main.rs:549-560`; directorio en `src/main.rs:71` y `src/main.rs:82` |
| Sólo la imagen Docker descarga los 16 PDFs (manifiesto + SHA-256 en build) | `Dockerfile:56-66` y `Dockerfile:99` |
| `install.sh` crea el directorio vacío y su script de descarga baja **sólo ZIM** | `install.sh:66-68`; heredoc `download-content.sh` en `install.sh:214-260` [L] |

### Fila 9 — Hotspot WiFi

| Hecho | Evidencia |
|---|---|
| El script exige `ip iptables sysctl hostapd dnsmasq cp pgrep` y nombra los que falten | `edu-conect-rural-server/scripts/setup-hotspot.sh:52-62` |
| Es idempotente y documenta el efecto: IP estática `10.0.0.1` en `wlan0`, `iptables` 80→8080, `hostapd` + `dnsmasq` | `scripts/setup-hotspot.sh:1-19` |
| `install.sh` lo instala como `ExecStartPre` de la unidad | `install.sh:190` |
| El hotspot no aplica a un colegio que ya tiene red: es una decisión de despliegue, no un supuesto | `docs/propuesta-windpeshi-innova.md` §2.4, punto 4 |

---

## 3. Qué instalar para pasar de «se degrada» a «funciona»

### 3.1 Linux (escritorio y servicio) — paquetes Debian/Ubuntu; entre paréntesis el equivalente Fedora

| Función | Qué instalar | Qué cambia exactamente cuando está presente | Verificado |
|---|---|---|---|
| Arranque | nada instalable: poner `JWT_SECRET` (mínimo **32** caracteres, `src/config.rs:12-14`) y `ADMIN_INITIAL_PASSWORD` (mínimo **12**, `src/config.rs:20`) en el entorno o en un `EnvironmentFile` | el proceso deja de morir y sirve `/health` 200 | [M] el efecto; [L] el mecanismo |
| Wikipedia/ZIM | **no es un paquete de runtime**: hay que **recompilar** con `--features zim` y tener `libzim-dev libxapian-dev libicu-dev` (`libzim-devel libxapian-devel libicu-devel`) **más** un archivo `.zim` en `DEFAULT_ZIM_DIR` o en `DATA_DIR/contenido/zim` | `/api/wikipedia/*` y `/zim/*` pasan de 503 a servir contenido; la clausura de `ldd` pasa de 5 a 15 entradas | [M] compilación y degradación; **[N]** servir un `.zim` real |
| TTS | `espeak-ng` **+** `mbrola` **+** los datos de la voz `es3` (el nombre exacto del paquete de voz no se verificó aquí) | `/api/tts` pasa de 500 a 200 `audio/wav` | [L] |
| H.264 | `ffmpeg` | la detección al arrancar deja de caer en la constante; `POST /api/videos/convertir` deja de dar `ffmpeg falló: No such file or directory` — pero **puede seguir fallando** si el build de `ffmpeg` anuncia `h264_v4l2m2m` y la máquina no tiene el dispositivo (medido, §2 fila 3) | [M] el caso que sigue fallando |
| Descarga de video | `yt-dlp` + `ffmpeg` + **Internet** | `POST /api/videos/descargar` deja de dar `Error ejecutando yt-dlp`; sin red sigue fallando con el error de `yt-dlp` | [L] |
| `/static/*` | nada instalable: los archivos tienen que estar en `./static` respecto del **CWD** (o usar la rama D-03, que lo deriva del ejecutable) | deja de responder 404 | [L] |
| `/modulos/*` | copiar `edu-conect-rural-dashboard/modulos/` a `./modulos` del CWD del servicio, o lanzar con `WorkingDirectory` apuntando al árbol | deja de responder 404; `/api/modulos` deja de devolver catálogo vacío | [L] |
| Panel | generar el export de Next (`out/`) y apuntar `FRONTEND_PATH` a él | deja de responder 404 | [L] |
| Biblioteca PDF | poner los PDFs en `DATA_DIR/biblioteca` | `/api/biblioteca` deja de listar un catálogo vacío | [L] |
| Hotspot | `hostapd dnsmasq iptables` (ya los instala `install.sh`) | `setup-hotspot.sh` deja de abortar nombrando comandos faltantes | [L] |

**Además, en el servicio `systemd`:** añadir `Environment=`/`EnvironmentFile=` con los dos secretos;
sin eso el servicio arranca y muere en bucle (`Restart=on-failure`), que es la peor forma de degradar
porque el operador ve el servicio «reiniciándose» y no el pánico.

### 3.2 Windows (PC de colegio)

No hay instalador. Lo que un administrador puede hacer **hoy** con el artefacto medido:

| Paso | Qué hacer | Qué cambia |
|---|---|---|
| 1 | Copiar el `.exe` (un solo archivo, sin DLL) a una carpeta escribible | arranca; SQLite ya va dentro |
| 2 | Definir `JWT_SECRET` y `ADMIN_INITIAL_PASSWORD` (variables de usuario/sistema) y `DATA_DIR` a una ruta escribible | deja de morir en la validación de la fila 0 |
| 3 | Lanzarlo **desde** la carpeta que contiene `static/`, `modulos/` y `frontend/` (en `main` la raíz es el CWD; D-03 la deriva del ejecutable, y no está fusionada) | `/static/*` y `/modulos/*` dejan de dar 404 |
| 4 | Abrir el puerto en el Firewall de Windows (paso documentado, no medido) | otros equipos del aula pueden conectarse |
| 5 | Opcional — TTS: `espeak-ng.exe` en el PATH **y** datos de voz mbrola, más resolver que `-w /dev/stdout` no es una ruta válida en Windows [I] | pasaría de 500 a audio; **no verificado** |
| 6 | Opcional — video: `ffmpeg.exe` y `yt-dlp.exe` en el PATH, más Internet | descarga y conversión; **no verificado** |
| 7 | ZIM en Windows exigiría compilar el `.exe` con la feature y `libzim` para mingw | **no existe receta**: la imagen de cross-build instaló mingw *sin* ZIM a propósito |

Y un riesgo que no es técnico: el `.exe` va **sin firmar**. SmartScreen, Windows Defender y las
políticas de aplicación de un colegio lo tratarán como desconocido (`docs/sprint2/win-cross-build.md`
§12) [N].

### 3.3 Raspberry Pi (ARM)

| Paso | Qué hacer | Estado |
|---|---|---|
| 1 | Compilar para `aarch64-unknown-linux-musl` con `cross-compile.sh` (exige toolchain musl) | [L]; nunca ejecutado |
| 2 | Ojo: un binario musl estático hace que la compuerta `ldd` de CI responda **2 = NO VERIFICABLE** | `docs/sprint2/dci2-ldd.md` §6 (F4) |
| 3 | ZIM en ARM: requiere `libzim` compilada para aarch64; **no hay evidencia de que exista ese cruce en este proyecto** | [N] |
| 4 | `install.sh` (paquetes `apt`/`apk`/`dnf`) + `systemd`, con los dos secretos añadidos a mano | [L] |
| 5 | TTS/ffmpeg/yt-dlp: los mismos paquetes ARM que en Linux | [N] |
| 6 | Hotspot: es el escenario para el que se escribió `setup-hotspot.sh` | [N] en hardware |

**No se puede afirmar que nada de esto funcione en una Pi.** `install.sh` está escrito *para* la Pi y
`cross-compile.sh` está escrito *para* la Pi; ninguno de los dos se ejecutó en una.

### 3.4 Una tabla que conviene tener a mano: qué se arregla sin recompilar

| Se arregla instalando un paquete o variable | Exige recompilar | No se arregla sin cambiar código |
|---|---|---|
| TTS (`espeak-ng` + voz mbrola), `ffmpeg`, `yt-dlp`, secretos, ubicación de `static/`/`modulos/`/panel, PDFs, hotspot | ZIM (feature `zim` + `libzim-dev`); en Windows y ARM además el cruce de compilación | la voz `es-es+mbrola-3` fijada en `src/main.rs:919` **si** se quiere TTS sin mbrola; la elección de encoder H.264 por presencia de cadena (`main.rs:155-162`); `-w /dev/stdout` en Windows |

---

## 4. Lo que NO está verificado

### 4.1 Por plataforma

| Flanco | Estado | Por qué |
|---|---|---|
| **Windows real (10/11)** | **NO VERIFICADO** | El `.exe` sólo corrió bajo Wine. WinBoat expone RDP interactivo, sin WinRM ni agente: no se puede lanzar desde aquí (`docs/sprint2/win-cross-build.md` §12) |
| Windows 7 / 8 | **NO VERIFICADO** | Sin VM. La importación `api-ms-win-core-synch-l1-2-0.dll` **sugiere** un piso práctico Windows 8+ — es una **inferencia**, no una medición (`win-cross-build.md` §4.1) |
| Firma Authenticode, SmartScreen, Defender, Firewall | **NO VERIFICADO** | El `.exe` va sin firmar y nadie lo abrió en un Windows con políticas |
| Frontend servido en Windows | **NO VERIFICADO** | En el sondeo no se copió el bundle; `/` respondió desde `landing_page` |
| Migrar una base creada en Linux a Windows | **NO VERIFICADO** | El arranque probado fue siempre con base nueva |
| **Cualquier cosa en ARM / Raspberry Pi** | **NO VERIFICADO** | No hay hardware, no hay cross-build ejecutado, no se probó `v4l2m2m`, ni `hostapd`, ni `libzim` para aarch64 |
| **Un PC de escritorio Linux con entorno gráfico** | **NO VERIFICADO** | Toda la evidencia Linux es de contenedores Debian |
| systemd real | **NO VERIFICADO** | La unidad no se arrancó con `systemd` real; `docs/sprint2/d03-layout-portable.md` §8 lo declara |

### 4.2 Por celda: qué se midió y qué se leyó

| Fila | Medido | Leído | Inferido / No verificado |
|---|---|---|---|
| 0 Arranque | no arranca sin los secretos (contenedor, base `a27adec`); 200 con secretos (Wine) | que la unidad no lleva secretos; el `[ERROR]` + `exit 1` de `main` para `JWT_SECRET` y el aviso de `ADMIN_INITIAL_PASSWORD` | el texto exacto del pánico del admin inicial en `main`: **[L]** (reproducido en `a27adec`, citado por su línea actual) |
| 1 ZIM | 503 canónico en Linux y bajo Wine; `ldd` 5 vs 15; compuerta CI | que Docker distribuye un `.zim` que su binario no lee; ARM | servir un `.zim` real: **[N]** |
| 2 TTS | `program not found` bajo Wine | las dos causas del 500 y el argumento `-v es-es+mbrola-3` | texto exacto del error de `io::Error` en Linux; `-w /dev/stdout` en Windows: **[I]** |
| 3 H.264 | log `libx264` bajo Wine (rama de fallo); **`h264_v4l2m2m` elegido y fallando en el host Linux** | el 500 de convertir en Windows | el comportamiento en un build de `ffmpeg` sin `v4l2m2m`: **[I]**; en la Pi: **[N]** |
| 4 yt-dlp | nada | los tres caminos de error de `handler_descargar_video` | la necesidad de `ffmpeg` para `--merge`/`--embed-thumbnail`: **[I]** |
| 5 SQLite | base creada bajo Wine; WAL con su prueba | arquitectura ARM | — |
| 6 Estáticos | `/modulos/*` 200 y 61 módulos en el contenedor; `/` 200 bajo Wine | los 404 fuera de Docker y en Windows | el 404 exacto en una Pi instalada: **[L]**, no medido |
| 7 Lanzadores | que el `.exe` se produce fuera del repo | `install.sh`, unidad, `start.sh`, `cross-compile.sh` | `install.sh` en una Pi: **[N]** |
| 8 Biblioteca | nada | sólo Docker descarga PDFs | — |
| 9 Hotspot | nada | `setup-hotspot.sh` y su `ExecStartPre` | funcionamiento en la Pi: **[N]** |

### 4.3 Sobre la evidencia documental usada

- `docs/sprint2/d03-layout-portable.md` **no está en `main`**: vive en la rama sin fusionar
  `feature/d03-app-root` (3 commits por delante de `origin/main`). Se leyó con
  `git show origin/feature/d03-app-root:docs/sprint2/d03-layout-portable.md`. Por eso este documento
  **no** describe la tabla `DATA_DIR` por plataforma ni los lanzadores `.bat`/`.ps1` como
  comportamiento actual: son trabajo pendiente de fusión. En `main`, `DATA_DIR` sigue siendo
  `"data"` relativo al CWD (`src/config.rs:422`).
- La rama `main` **no tiene** `deploy/windows/`. Quien lea el documento de D-03 y asuma que esos
  lanzadores existen en el producto se equivoca.
- No existe ninguna prueba automatizada del contrato 503: las comprobaciones fueron `curl` manuales
  (`docs/sprint2/d01-verificacion.md` §10, punto 6). Una celda «medida» de esta matriz puede dejar de
  ser cierta sin que CI lo detecte, salvo por la compuerta `ldd`.

### 4.4 Medición propia de esta unidad (declarada para que no se confunda con evidencia del producto)

Se ejecutó `ffmpeg` en el **host de trabajo** (x86_64, `ffmpeg n9.0.2`) para comprobar la fila 3.
No se compiló ni se arrancó el servidor: en esta máquina no hay `cargo`. El directorio de trabajo de
esa medición fue un `mktemp -d /tmp/t7-ffmpeg.XXXXXX`. Todo lo demás en este documento es lectura de
código o cita de evidencia ya registrada.

---

## 5. Qué pierde un colegio, en lenguaje llano

**PC de escritorio Linux (lo más probable según `S11`).** Funciona lo esencial del aula: el servidor
arranca, guarda progreso y evaluaciones en una base que no se corrompe y sirve la página de entrada.
Lo que un docente nota que falta: **la enciclopedia de Wikipedia** (dice «capacidad no incluida», no
está rota), **el audio de las lecciones** (el botón de escuchar devuelve un error; hay que instalar
una voz de sistema que hoy ni siquiera está en la imagen) y, si el equipo se instaló con el instalador
y no desde el contenedor, **el catálogo de módulos y los estilos de la interfaz aparecen vacíos sin
explicar por qué**. La descarga de videos de YouTube y su conversión no cuentan como función de aula:
una escuela sin Internet no las puede usar aunque el equipo tenga los programas.

**PC Linux como servicio (el equipo «de sala de servidores»).** Funciona mientras alguien haya puesto
las dos claves a mano y haya copiado los archivos estáticos a la carpeta correcta; si no, el servicio
se reinicia en bucle sin decir por qué. La ventaja real es que el equipo queda encendido y el
estudiante no ve una terminal. Lo que pierde: exactamente lo mismo que el escritorio, y además la
posibilidad de arrancar solo en una instalación nueva, porque el instalador no provisiona las claves.

**PC de colegio con Windows (el caso probable de `S11`: computadores de profesores).** Es la
plataforma con menos construido: no hay instalador, no hay lanzador y el ejecutable va sin firma, así
que un antivirus o una política del colegio puede bloquearlo antes de que alguien lo pruebe. Si
arranca, lo que el profesor obtiene es la plataforma con la base de datos, los cursos, los quizzes y
el seguimiento de progreso — y pierde **Wikipedia, el audio y la conversión de video**, más los
módulos y el panel si nadie copió esas carpetas. Es decir: pierde todo el material que hace que la
plataforma se sienta como una enciclopedia y no como un cuaderno de notas.

**Raspberry Pi.** Sobre el papel es el destino más completo (red WiFi propia, bajo consumo, hotspot
para el aula) y en la práctica es el único del que **no hay ni una sola medición**. Un colegio que
compre una Pi hoy no compra una plataforma: compra una hipótesis de ingeniería. Mientras no se pruebe
en hardware, lo honesto es no ofrecerla como destino.

---

## 6. Reproducción

Las mediciones citadas se reproducen con:

| Evidencia | Comando / documento |
|---|---|
| Degradación ZIM en Linux | `docs/sprint2/d01-verificacion.md` §6 y §9 (comandos `docker run` + `curl`) |
| Degradación ZIM/TTS en Windows | `docs/sprint2/win-cross-build.md` §6-§8; script durable `edu-conect-rural-server/tests/win-cross-build.sh` |
| Clausura de enlace | `scripts/verificar-ldd-default.sh` (códigos 0/1/2) y `scripts/pruebas-ci-ldd.sh` |
| Arranque sin secretos | `docs/sprint1-informe-p0-dev3.md` §9 |
| Encoder H.264 | §2, fila 3, de este documento (medición de esta unidad) |

No hay comando que reproduzca las celdas de ARM ni las de Windows real: no existen los entornos.
