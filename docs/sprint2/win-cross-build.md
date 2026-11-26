# D-WIN — Compilación cruzada y arranque Windows

**T8: arranque reproducible en al menos dos entornos (Linux y Windows), con evidencia registrada.**
Base `398c27c` · rama `chore/win-cross-build` · Rust 1.88.0 · mingw-w64 GCC 12-win32 · Wine 11.22.

La unidad Linux ya está registrada (`d01-verificacion.md`, `d02-final.log`). Este documento cubre el segundo entorno. Todo lo que sigue se ejecutó en el árbol `/tmp/educonect-wt/win-build` con las órdenes que aparecen aquí; los números son de esta corrida, no de una anterior.

**Advertencia que encabeza todo el documento:** el `.exe` **nunca se ejecutó en Windows**. Se ejecutó bajo Wine sobre Linux. Windows es la plataforma *destino* de la compilación, no el entorno donde se midió el arranque. §12 enumera lo que queda sin verificar.

---

## 0. Resumen de los seis controles

| # | Control | Estado | Evidencia |
|---|---|---|---|
| 1 | Receta (`Dockerfile.win`) con mingw, sin `libzim` y sin rutas del HOME | **PASÓ** | §1 |
| 2 | `cargo build --locked --release --target x86_64-pc-windows-gnu` sale 0 | **PASÓ** | §2: `Finished` en 1m 46s, 0 warnings, 0 errores |
| 3 | `file` reconoce `PE32+ executable … x86-64` | **PASÓ** | §3 |
| 4 | `objdump -p`: 0 `sqlite3.dll`, 0 `libgcc_s_seh-1.dll`, 0 `libwinpthread-1.dll` | **PASÓ** | §4 |
| 5 | `cargo tree --target …` sin crate `zim` | **PASÓ** | §5: 554 líneas, 0 coincidencias |
| 6 | El `.exe` arranca bajo Wine y `/health` responde 200 | **PASÓ** | §6, §7 |

Los seis los ejecuta `edu-conect-rural-server/tests/win-cross-build.sh` (§8). No son comprobaciones manuales de una sola vez: quedan como prueba repetible.

**Actualización T9 (receta versionada).** `docker/windows/Dockerfile.win` y `docker/windows/compose.yaml` están ya **en el repositorio**; la prueba toma esa receta por omisión y la corrida de referencia desde un clon limpio en `/tmp` volvió a dar **6 PASARON / 0 FALLARON / 0 NO EJECUTADAS**, exit 0, con compilación completa desde target vacío en `2m 04s`. El control 1 incorpora ahora la autocontención: la receta no puede mencionar rutas del HOME. §1, §2, §8, §10 y §13 quedan corregidos en consecuencia; el resto del documento es la evidencia original, intacta.

---

## 1. Entorno de compilación

**Desde T9 la receta vive dentro del repositorio** (rama `chore/win-recipe`, base `c41dd42`):

| Archivo en el repositorio | Contenido |
|---|---|
| `docker/windows/Dockerfile.win` | copia **byte a byte** del que estaba en `$HOME/educonect-dev-env/` (sha256 `55245bd878ad53c175cbc46d6ee3ad8e1f2c50d3223880cbb1ae6714131cda55`) |
| `docker/windows/compose.yaml` | solo el servicio `win`, adaptado para no depender de ninguna ruta del HOME |

Hasta T9 la receta estaba en `$HOME/educonect-dev-env/`, fuera de control de versiones: un clon del repositorio no la tenía y `git log --all -- Dockerfile.win` devolvía 0 commits. Este documento registraba ese hallazgo (§10) y recomendaba incorporarla; T9 lo ejecutó. Los números de §2 a §7 son de la corrida original con aquella copia externa, cuyo `Dockerfile.win` era idéntico al ahora versionado; §2 añade la corrida de referencia hecha ya con la receta del repositorio, desde una copia limpia en `/tmp`.

Qué aporta cada archivo:

| Archivo | Qué aporta |
|---|---|
| `Dockerfile.win` | `debian:bookworm-slim` + toolchain Rust 1.88.0 + `gcc-mingw-w64-x86-64` + target `x86_64-pc-windows-gnu` |
| `compose.yaml` | servicio `win`, montaje del repo en `/workspace` **en solo lectura**, volumen propio `cargo-target-win` |

La única diferencia con el compose externo es la que quitaba el acoplamiento al HOME: `source: ${EDUCONNECT_REPO:-../..}` (relativo al propio archivo, o sea la raíz del repo), `RUST_VERSION` con default `1.88.0` en vez de exigirse por entorno, y un nombre de proyecto fijo (`educonect-win-cross`) para que los volúmenes de caché se llamen igual en cualquier clon. Los servicios `dev`, `nodev` y `lockfile` **no** se copiaron: pertenecen al entorno de desarrollo del operador, no a esta unidad.

Variables del Dockerfile que hacen el trabajo:

```
ENV CARGO_TARGET_DIR=/opt/target
    CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER=x86_64-w64-mingw32-gcc
```

Y la decisión que define la unidad: la imagen **no instala** `libzim-dev`, `libxapian-dev` ni `libicu-dev`. Si el perfil default volviera a necesitar ZIM, este build fallaría en vez de producir un binario silenciosamente dependiente.

Control 1 — instrucciones del Dockerfile, comentarios excluidos:

```
[1] Dockerfile.win usa mingw y no instala libzim (solo instrucciones) PASO
        instrucciones: mingw=3 (se exige >0) · libzim=0 (se exige 0)
        menciones de libzim en todo el archivo (comentarios incluidos): 1
```

La única mención de `libzim` es un comentario explicativo («Sin `libzim-dev`, sin `libxapian-dev`, sin `libicu-dev`…»). La prueba cuenta instrucciones, no prosa: si alguien agrega `libzim-dev` a `apt-get install`, falla igual.

Verificado dentro de la imagen:

```
x86_64-w64-mingw32-gcc (GCC) 12-win32
rustc 1.88.0 (6b00bc388 2025-06-23)
cargo 1.88.0 (873a06493 2025-05-10)
GNU objdump (GNU Binutils for Debian) 2.40
```

---

## 2. Compilación cruzada

Órdenes exactas de la corrida original (T8, con la receta todavía **fuera** del repositorio):

```bash
cd ~/educonect-dev-env
export RUST_VERSION=1.88.0 EDUCONNECT_REPO=/tmp/educonect-wt/win-build
timeout 900 docker compose build win
timeout 900 docker compose run -T --rm win bash -lc \
  'rm -rf /opt/target/x86_64-pc-windows-gnu &&
   cd /workspace/edu-conect-rural-server &&
   cargo build --locked --release --target x86_64-pc-windows-gnu'
```

`rm -rf` se ejecuta a propósito: sin él Cargo responde `Finished in 0.15s` y la corrida no prueba nada. Lo que sigue es un build completo desde cero.

### 2.1 Corrida de referencia con la receta del repositorio (T9)

Misma compilación, pero **desde un clon limpio y solo con archivos del repositorio**. Copia en `/tmp/t9-green` del árbol de la rama `chore/win-recipe`, ejecutada desde ahí:

```bash
timeout 2400 ./edu-conect-rural-server/tests/win-cross-build.sh
```

La prueba construye la imagen con `docker/windows/compose.yaml` y compila el crate en un target vacío (volumen nuevo), sin `rm -rf` ni `FRESH=1`. Medición:

| Medición | Valor |
|---|---|
| `docker compose build win` | exit 0 · imagen `educonect-win-cross-win:latest`, ID **`122380db7aa4`** — el mismo ID que la imagen externa de §2: el `Dockerfile.win` es idéntico, así que solo cambió el nombre del proyecto, no las capas |
| Compilación del crate | exit 0 · `Finished 'release' profile [optimized] target(s) in 2m 04s` |
| Tiempo de pared de la prueba completa (imagen + build + Wine) | **149 s** |
| `warning` / `error` | **0 / 0** |
| Artefacto | 9 279 488 bytes · sha256 `d79acb02f675e6e525c68b8f2c6d624c05f6bea600f425d99fc945e36038c490` (difiere del de §3 por `TimeDateStamp`, como explica §3.1; el **tamaño** coincide) |
| Resultado | exit 0 · **6 PASARON / 0 FALLARON / 0 NO EJECUTADAS** |

El tamaño del artefacto coincide exactamente con el de la corrida externa (9 279 488 bytes): misma receta, mismo perfil, mismo toolchain. Que el sha256 difiera era lo esperado (§3.1).

Medición de la corrida original (receta externa, T8):

| Medición | Valor |
|---|---|
| `docker compose build win` | exit 0 · imagen `educonect-dev-env-win:latest` (`122380db7aa4`) |
| Compilación del crate | exit 0 · `Finished 'release' profile [optimized] target(s) in 1m 46s` (prueba) y `1m 49s` en una corrida manual aparte |
| Tiempo de pared del paso | **110 s** (medido con `date +%s` alrededor del `docker compose run` de la corrida manual) |
| `warning` | **0** |
| `error` | **0** |
| `--locked` | respetado: el lock no se modificó (repo montado en solo lectura) |

Salida real, últimas líneas:

```
   Compiling tower-http v0.6.11
   Compiling hyper-util v0.1.20
   Compiling axum v0.8.9
   Compiling rusqlite v0.39.0
   Compiling r2d2_sqlite v0.34.0
   Compiling edu-conect-rural-server v0.1.0 (/workspace/edu-conect-rural-server)
    Finished `release` profile [optimized] target(s) in 1m 46s
CARGO_EXIT=0
```

### 2.2 El riesgo registrado no se materializó

El riesgo anotado al abrir la unidad era: **`rusqlite` con `bundled` compila SQLite desde C bajo mingw**. Se materializó el escenario contrario.

- `rusqlite 0.39` con `features = ["bundled"]` compiló su amalgama de SQLite **con `x86_64-w64-mingw32-gcc`** y enlazó estáticamente. No hubo `pkg-config` de SQLite ni falta de cabeceras.
- La prueba de que quedó **dentro** del binario y no como dependencia externa está en §4: el PE no importa `sqlite3.dll`, y la cadena de versión `3.51.3` (la del crate, no la del sistema) está en el binario. El `libsqlite3-dev` de la imagen es **3.40.1** — no es la que quedó adentro.

Este resultado es el que convierte «un `.exe` que compila» en «un `.exe` desplegable en un solo archivo».

---

## 3. El artefacto

```
artefacto: 9279488 bytes
sha256:    e3a62c42a7ff53c2c0f0adf2973446080556809184c5b11728878257aef997f0
```

```
$ file -b edu-conect-rural-server.exe
PE32+ executable for MS Windows 5.02 (console), x86-64 (stripped to external PDB), 10 sections
```

`symbols stripped` y `debugging information removed` aparecen también en la cabecera COFF que imprime `objdump -p`:

```
Characteristics 0x22e
	executable
	line numbers stripped
	symbols stripped
	large address aware
	debugging information removed
Magic			020b	(PE32+)
```

### 3.1 El sha256 identifica una compilación, no un estado del código

Dos compilaciones del mismo árbol produjeron:

| Compilación | sha256 | Tamaño |
|---|---|---|
| A | `56d7cdb0f9bed98ee9cb866e5dc8fd0dab56c08bfe4547ac4671f51bb0522f5e` | 9 279 488 |
| B | `e3a62c42a7ff53c2c0f0adf2973446080556809184c5b11728878257aef997f0` | 9 279 488 |

`cmp -l` entre ambas: **4 bytes distintos**, en dos campos:

| Campo | Offset en el archivo | Motivo |
|---|---|---|
| `TimeDateStamp` de la cabecera COFF | `0x88` | el enlazador incrusta la hora de enlace |
| `CheckSum` del header opcional PE | `0xD8` | se recalcula al cambiar el anterior |

El tamaño es estable byte a byte; **el hash no**. Consecuencia práctica, y es una advertencia de uso: el sha256 de este documento sirve para identificar *esta* corrida y comparar un artefacto entregado contra sí mismo, **no** para afirmar reproducibilidad bit a bit entre compilaciones. Para eso habría que enlazar con `-Wl,--no-insert-timestamp` (y comparar), decisión que no se toma aquí.

---

## 4. Autocontención: qué importa el ejecutable

```
$ objdump -p edu-conect-rural-server.exe | grep "DLL Name"
	DLL Name: kernel32.dll
	DLL Name: bcryptprimitives.dll
	DLL Name: kernel32.dll
	DLL Name: api-ms-win-core-synch-l1-2-0.dll
	DLL Name: kernel32.dll
	DLL Name: ntdll.dll
	DLL Name: ws2_32.dll
	DLL Name: ADVAPI32.dll
	DLL Name: bcrypt.dll
	DLL Name: KERNEL32.dll
	DLL Name: msvcrt.dll
```

Nueve DLL únicas (las repeticiones de `kernel32.dll` son un descriptor de importación por cada referencia). Todas son de Windows:

| DLL | De quién es |
|---|---|
| `KERNEL32`, `ntdll`, `msvcrt`, `ADVAPI32` | núcleo del sistema |
| `ws2_32` | Winsock — el servidor escucha TCP |
| `bcrypt`, `bcryptprimitives` | CNG — el hash de contraseñas |
| `api-ms-win-core-synch-l1-2-0` | API set introducido en Windows 8 |

### 4.1 Las tres ausencias que importan

| Import | Coincidencias | Qué habría significado |
|---|---|---|
| `sqlite3.dll` | **0** | repartir `sqlite3.dll` junto al `.exe`, o exigir uno en el PATH |
| `libgcc_s_seh-1.dll` | **0** | repartir el runtime de GCC (manejo de excepciones) |
| `libwinpthread-1.dll` | **0** | repartir el runtime de pthreads de mingw |

**El despliegue es un solo archivo.** Ni DLL de SQLite, ni runtime de GCC, ni pthreads: se copia el `.exe` y arranca. Es exactamente la propiedad que T8/S11 necesita para un PC de colegio.

Riesgo residual, ya conocido y no de esta unidad: `api-ms-win-core-synch-l1-2-0.dll` **sugiere** un piso práctico de Windows 8. Es una inferencia por la API set importada, **no** una medición — no hay Windows 7/8 disponible. Queda en §12.

---

## 5. Grafo de dependencias del target

```bash
timeout 900 docker compose run -T --rm win bash -lc \
  'cd /workspace/edu-conect-rural-server && cargo tree --locked --target x86_64-pc-windows-gnu'
```

| Medición | Valor |
|---|---|
| Líneas de árbol | 554 |
| Coincidencias de `zim v…` | **0** |
| `libsqlite3-sys` | presente (`0.37.0`, `bundled`) |
| TLS en el target | `native-tls 0.2.18` → **`schannel 0.1.29`**, no `openssl-sys` |

El último renglón explica por qué la cross-compilación no necesita OpenSSL: para Windows, `native-tls` usa Schannel del sistema. `openssl-sys 0.9.116` está en el lock porque el **host Linux** lo usa; en el target Windows no se compila. Volveremos sobre esto en §10.

---

## 6. Arranque bajo Wine

Prefijo **aislado** en `/tmp` (`mktemp -d`), `WINEPREFIX` propio, nunca el `HOME`:

```bash
SCRATCH=$(mktemp -d /tmp/dwin-probe.XXXXXX)
export WINEPREFIX="$SCRATCH/wineprefix" WINEDEBUG=-all
export JWT_SECRET=... ADMIN_INITIAL_PASSWORD=... DATA_DIR="$SCRATCH/run/data"
export LISTEN_ADDR=127.0.0.1:18907 RUST_LOG=info
timeout 180 wineboot --init
( cd "$SCRATCH/run" && timeout 180 wine ./edu-conect-rural-server.exe )
curl -s http://127.0.0.1:18907/health
```

Secuencia de arranque observada, literal:

```
INFO edu_conect_rural_server: 📁 Directorio de datos: Z:/tmp/dwin-wine.CC3KIC/run/data
INFO edu_conect_rural_server::db: Migraciones ejecutadas
INFO edu_conect_rural_server::db: Semillas cargadas (cursos + módulos + biblioteca + diccionarios + dedupe biblioteca)
INFO edu_conect_rural_server::db: 🔑 Admin inicial creado desde ADMIN_INITIAL_PASSWORD
INFO edu_conect_rural_server::db: Migraciones de contenido ejecutadas
INFO edu_conect_rural_server::db: Índices FTS5 creados
INFO edu_conect_rural_server::db: Migración de cuestionarios ejecutada
INFO edu_conect_rural_server::db: Índices FTS5 reconstruidos (cursos, videos, biblioteca, diccionario)
INFO edu_conect_rural_server::db: Base de datos lista: Z:/tmp/dwin-wine.CC3KIC/run/data\educonect.db (pool r2d2, max_size=8)
INFO edu_conect_rural_server: 🎥 Encoder H.264 seleccionado: libx264
INFO edu_conect_rural_server: 🚀 Servidor EduConect Rural escuchando en http://127.0.0.1:18080
INFO edu_conect_rural_server: 📁 Frontend estático servido desde: Z:\tmp\dwin-wine.CC3KIC\run\../edu-conect-rural-dashboard/out/
```

| Medición | Valor |
|---|---|
| `wineboot --init` | exit 0 |
| Tiempo hasta `/health` OK | 14–17 s (incluye crear el prefijo vacío) |
| `GET /health` | **200** · `{"status":"ok","version":"0.1.0"}` |
| Base creada en `DATA_DIR` | **5 062 656 bytes** (`educonect.db`) |
| Migraciones, semillas, admin inicial, FTS5 | ejecutados en este arranque, sin ningún paso previo |
| Puerto tras `kill` + `wineserver -k` | **liberado** |

Ese arranque es el que le importa a T8: una instalación **limpia** (prefijo Wine vacío, `DATA_DIR` inexistente) llega sola a un servidor que responde salud, en menos de 20 s. No hubo un solo paso manual entre el `.exe` y `/health`.

---

## 7. Matriz de degradación en Windows

Perfil **default**: sin feature `zim`, y en el prefijo Wine no hay `espeak-ng` ni `ffmpeg` — igual que en un Windows recién instalado. Medido con el servidor en ejecución:

| Petición | Código | Cuerpo observado |
|---|---|---|
| `GET /` | **200** | HTML de la landing servida por el propio binario |
| `GET /health` | **200** | `{"status":"ok","version":"0.1.0"}` |
| `GET /api/wikipedia/search?q=colombia` | **503** | `{"capacidad":"zim","error":"capacidad zim no incluida en esta compilación"}` |
| `GET /api/wikipedia/zims` | **503** | idem |
| `GET /zim/` | **503** | HTML «Wikipedia Offline no disponible» |
| `GET /api/tts?text=hola` | **500** | `{"error":"Error al ejecutar espeak-ng: program not found"}` |

Lectura de la matriz, que es lo que T7 pedía declarar por plataforma:

1. **Lo que no depende de binarios nativos funciona**: landing, salud, base, migraciones, semillas, FTS5.
2. **ZIM no está compilado y se declara**: 503 con mensaje canónico, no 404 ni caída.
3. **TTS falla honestamente**: falta `espeak-ng.exe`; el error dice cuál es el programa que no encontró, no «error interno».
4. El `200` en `/` viene del handler `landing_page` (`main.rs:397`), **no** de `FRONTEND_PATH`: en el sondeo no se copió el bundle del dashboard. No confundir «landing responde» con «el frontend está servido».

---

## 8. La prueba durable

`edu-conect-rural-server/tests/win-cross-build.sh` (ejecutable). Un solo comando reproduce los seis controles de §0:

```bash
timeout 1500 ./edu-conect-rural-server/tests/win-cross-build.sh
```

Códigos de salida — **ninguno confunde «no corrió» con «pasó»**:

| Exit | Significado |
|---|---|
| **0** | las seis comprobaciones se ejecutaron y pasaron |
| **1** | al menos una falló |
| **3** | ninguna falló, pero alguna **no pudo ejecutarse** (incompleto, no es un aprobado) |
| **77** | **omitida**: no hay `docker compose`. No se ejecutó nada |

Variables: `EDUCONNECT_REPO` (repositorio a montar; la prueba lo fija a su propia raíz), `EDUCONNECT_COMPOSE_FILE`, `EDUCONNECT_DOCKERFILE_WIN`, `RUST_VERSION`, `WIN_PROBE_PORT`, `SKIP_WINE=1`, `FRESH=1` (borra el target antes de compilar), `T_DOCKER`.

**Desde T9 la receta sale del repositorio**: `docker/windows/compose.yaml` (servicio `win`) y `docker/windows/Dockerfile.win`. `EDUCONNECT_DEV_ENV` **sigue existiendo como override de compatibilidad**: si se define, la receta se busca en ese directorio como antes (los otros dos overrides siguen funcionando igual). Sin esa variable, el script no lee nada del HOME, y el control 1 lo exige: falla si el Dockerfile o el compose mencionan `/home/…`, `~`, `$HOME` o `educonect-dev-env`. Verificado en esta unidad: con `EDUCONNECT_DEV_ENV` apuntando a la receta externa, la prueba sigue dando **6/6**, exit 0.

Salida real de la corrida original con `FRESH=1` (receta **externa**, previa a T9):

```
win-cross-build — EDUConect Rural D-WIN
repo:      /tmp/educonect-wt/win-build
entorno:   /home/x/educonect-dev-env
compose:   /home/x/educonect-dev-env/compose.yaml
rust:      1.88.0 · target x86_64-pc-windows-gnu
docker:    Docker Compose version 5.7.1

== 1. Dockerfile.win — mingw presente, ZIM ausente
[1] Dockerfile.win usa mingw y no instala libzim (solo instrucciones) PASO
        instrucciones: mingw=3 (se exige >0) · libzim=0 (se exige 0)
        menciones de libzim en todo el archivo (comentarios incluidos): 1

== 2. Compilación cruzada --locked --release --target x86_64-pc-windows-gnu
  construyendo imagen win (RUST_VERSION=1.88.0)…
  imagen construida. Compilando el crate…
  FRESH=1: borrando /opt/target/x86_64-pc-windows-gnu antes de compilar
[2] compilación cruzada termina con exit 0                        PASO
        cargo exit=0 · Finished `release` profile [optimized] target(s) in 1m 46s
        warnings=0 · errors=0

  artefacto: 9279488 bytes
  sha256:    e3a62c42a7ff53c2c0f0adf2973446080556809184c5b11728878257aef997f0
  ruta en el contenedor: /opt/target/x86_64-pc-windows-gnu/release/edu-conect-rural-server.exe (volumen cargo-target-win)

== 3. Formato del artefacto
[3] file: PE32+ executable … x86-64                              PASO
        PE32+ executable for MS Windows 5.02 (console), x86-64 (stripped to external PDB), 10 sections

== 4. Importaciones del PE (objdump -p)
[4] objdump -p: 0 sqlite3.dll, 0 libgcc_s_seh-1.dll, 0 libwinpthread-1.dll PASO
        sqlite3.dll=0 · libgcc_s_seh-1.dll=0 · libwinpthread-1.dll=0
        DLL importadas: ADVAPI32.dll api-ms-win-core-synch-l1-2-0.dll bcrypt.dll bcryptprimitives.dll kernel32.dll KERNEL32.dll msvcrt.dll ntdll.dll ws2_32.dll

== 5. cargo tree --target x86_64-pc-windows-gnu sin crate zim
[5] cargo tree no contiene el crate zim                            PASO
        0 coincidencias de 'zim v…' en 554 líneas de árbol (target x86_64-pc-windows-gnu)

== 6. Arranque bajo Wine y GET /health
[6] el .exe arranca bajo Wine y /health responde 200               PASO
        wineboot exit=0 · /health -> {"status":"ok","version":"0.1.0"} · db=5062656 bytes
        líneas de escucha en el log: 1 · puerto 18907 liberado tras kill: 1

== Resumen
PASARON:       6
FALLARON:      0
NO EJECUTADAS: 0

Todos los controles se ejecutaron y pasaron.
Esto NO prueba que el .exe funcione en Windows real: solo bajo Wine.
```

Corrida de referencia con la receta del repositorio (T9), copia limpia en `/tmp/t9-green`, sin variables de receta y sin `FRESH`:

```
win-cross-build — EDUConect Rural D-WIN
repo:      /tmp/t9-green
receta:    /tmp/t9-green/docker/windows (del repositorio)
compose:   /tmp/t9-green/docker/windows/compose.yaml
rust:      1.88.0 · target x86_64-pc-windows-gnu
docker:    Docker Compose version 5.7.1

== 1. Receta — mingw presente, ZIM ausente, autocontenida
[1] receta: mingw presente, sin libzim, sin rutas del HOME         PASO
        instrucciones: mingw=3 (se exige >0) · libzim=0 (se exige 0)
        rutas del HOME en Dockerfile+compose: 0 (se exige 0)
        menciones de libzim en todo el archivo (comentarios incluidos): 1

== 2. Compilación cruzada --locked --release --target x86_64-pc-windows-gnu
  construyendo imagen win (RUST_VERSION=1.88.0)…
  imagen construida. Compilando el crate…
[2] compilación cruzada termina con exit 0                        PASO
        cargo exit=0 · Finished `release` profile [optimized] target(s) in 2m 04s
        warnings=0 · errors=0

  artefacto: 9279488 bytes
  sha256:    d79acb02f675e6e525c68b8f2c6d624c05f6bea600f425d99fc945e36038c490
  ruta en el contenedor: /opt/target/x86_64-pc-windows-gnu/release/edu-conect-rural-server.exe (volumen cargo-target-win)

== 3. Formato del artefacto
[3] file: PE32+ executable … x86-64                              PASO
        PE32+ executable for MS Windows 5.02 (console), x86-64 (stripped to external PDB), 10 sections

== 4. Importaciones del PE (objdump -p)
[4] objdump -p: 0 sqlite3.dll, 0 libgcc_s_seh-1.dll, 0 libwinpthread-1.dll PASO
        sqlite3.dll=0 · libgcc_s_seh-1.dll=0 · libwinpthread-1.dll=0
        DLL importadas: ADVAPI32.dll api-ms-win-core-synch-l1-2-0.dll bcrypt.dll bcryptprimitives.dll kernel32.dll KERNEL32.dll msvcrt.dll ntdll.dll ws2_32.dll

== 5. cargo tree --target x86_64-pc-windows-gnu sin crate zim
[5] cargo tree no contiene el crate zim                            PASO
        0 coincidencias de 'zim v…' en 573 líneas de árbol (target x86_64-pc-windows-gnu)

== 6. Arranque bajo Wine y GET /health
[6] el .exe arranca bajo Wine y /health responde 200               PASO
        wineboot exit=0 · /health -> {"status":"ok","version":"0.1.0"} · db=5062656 bytes
        líneas de escucha en el log: 1 · puerto 18907 liberado tras kill: 1

== Resumen
PASARON:       6
FALLARON:      0
NO EJECUTADAS: 0
```

Antes de que la receta estuviera versionada, la misma prueba sobre el mismo árbol contestaba **exit 3** (6 «no ejecutadas»): sin receta en el repositorio no hay nada que medir, y eso no es un aprobado.

Decisiones de la prueba que conviene dejar escritas:

| Decisión | Motivo |
|---|---|
| Control 1 ignora comentarios | el Dockerfile explica en prosa por qué no instala `libzim-dev`; contar prosa daría un fallo falso. Se informa igual el total de menciones |
| Control 1 exige además que la receta no mencione rutas del HOME (T9) | es la diferencia entre «la máquina que lo hizo una vez» y «cualquier clon»: un compose con `source: /home/<alguien>/…` reproduce el artefacto solo en esa máquina, y el script lo trata como fallo, no como advertencia |
| Control 6 exige cuatro señales (`/health` 200 **y** línea de escucha **y** base creada **y** puerto liberado) | un 200 solo no distingue un servidor real de un socket heredado; y el puerto liberado detecta procesos huérfanos de Wine |
| El `.exe` se extrae del volumen con `cat` y se ejecuta desde una copia en el scratch | el repo está montado en solo lectura y `DATA_DIR` debe ser escribible |
| `WINEPREFIX` siempre en `mktemp -d /tmp/…` | nunca el `HOME` del operador; el trap limpia al salir |
| Sin `docker compose` → exit 77 | Docker no está en todas las máquinas; omitir no puede parecer aprobar |

---

## 9. Verificación en código del arranque H.264

La investigación previa afirmó dos cosas sobre la línea `🎥 Encoder H.264 seleccionado: libx264`:

1. que la línea es un **fallback codificado a mano**, no un resultado de detección;
2. que `detect_h264_encoder()` **no** invoca `ffmpeg`, contra lo que dicen `docs/`.

**Las dos afirmaciones se refutan leyendo `src/main.rs` del árbol bajo prueba.** El código, literal (`src/main.rs:146-162`):

```rust
fn detect_h264_encoder() -> &'static str {
    let out = std::process::Command::new("ffmpeg")
        .args(["-encoders", "-v", "quiet"])
        .output();
    let stdout = match out {
        Ok(o) => o.stdout,
        Err(_) => return "libx264",
    };
    let s = String::from_utf8_lossy(&stdout);
    if s.contains("h264_v4l2m2m") {
        "h264_v4l2m2m"
    } else if s.contains("h264_omx") {
        "h264_omx"
    } else {
        "libx264"
    }
}
```

Y el sitio de llamada (`src/main.rs:329-330`), que interpola el valor — no es texto fijo:

```rust
let h264_encoder = detect_h264_encoder();
tracing::info!("🎥 Encoder H.264 seleccionado: {h264_encoder}");
```

Conclusión exacta, en los tres registros que importan:

| Afirmación | Veredicto |
|---|---|
| «`detect_h264_encoder()` no lanza `ffmpeg`» | **Falso.** `Command::new("ffmpeg").args(["-encoders", "-v", "quiet"])`, incondicional al arrancar |
| «la línea de log está codificada a mano» | **Falso.** Imprime el valor devuelto por la función |
| «bajo Wine se leyó `libx264`» | **Cierto, y ahora explicado**: en el prefijo Wine no hay `ffmpeg`, `output()` devuelve `Err`, y la función corta en `return "libx264"`. Es la rama de fallo de una detección real, no una constante |

Matiz que vale para el informe: la línea **no** dice que se detectó hardware. `libx264` es CPU pura, y sin `ffmpeg` no hubo detección alguna. En Windows, con `ffmpeg.exe` en el PATH, la función sí consultaría el binario; sin él —caso del Windows recién instalado— repite este mismo camino.

Una consecuencia para T7: esta ejecución de `ffmpeg` en el arranque es un proceso externo que **no existe** en Windows por defecto. No rompe el arranque (está en la rama tolerante), pero significa que la transcodificación de video no está disponible en un Windows limpio.

### 9.1 Correcciones aplicadas a documentos existentes

Ninguna de las dos afirmaciones de la investigación era correcta, así que **no hubo que corregir la doctrina**. Lo que sí estaba desactualizado eran **referencias de línea**, movidas por commits posteriores a la base de cada documento (`88a66f7` y `3336c99`: la configuración se centralizó en `config.rs` y el `main()` creció). Se corrigieron a la posición real en `398c27c`:

| Archivo | Antes | Después |
|---|---|---|
| `docs/sprint2/d01b-mapeo-appstate.md:34` | `detect_h264_encoder()` (`main.rs:148`, llamado en `:313`) | `detect_h264_encoder()` (`main.rs:146-162`, llamado en `:329`) |
| `docs/sprint2/decisiones-arquitectura.md:266` | shell-out a `ffmpeg` al arrancar (`main.rs:145-151`) | shell-out a `ffmpeg` al arrancar (`main.rs:146-162`) |

`docs/sprint2/d02-firma-configuracion.md:26` **no se tocó**: dice «`detect_h264_encoder()` (`main.rs:148`) ejecutando `ffmpeg -encoders`», y en `398c27c` la línea 148 es exactamente `.args(&["-encoders", "-v", "quiet"])`. Sigue siendo cierta. Su base declarada (`4697978`) sí tenía la función empezando en 148; la coincidencia es que el desplazamiento no afectó a esa cita concreta.

---

## 10. Hallazgos sobre el entorno de compilación (sin cambiar nada)

`Dockerfile.win` y `compose.yaml` están fuera del repositorio, así que esta unidad **no los modificó**. Lo observado:

| Hallazgo | Verificación | Impacto |
|---|---|---|
| **La receta no está versionada.** Vive en `$HOME/educonect-dev-env/`, no en git | `git log --all -- Dockerfile.win` → 0 commits; el archivo no existe en el repo | **El más serio para S10/T8.** La evidencia está registrada, pero la máquina que la reproduce no se clona: se reconstruye a mano. **Resuelto en T9**: `docker/windows/Dockerfile.win` (copia byte a byte) y `docker/windows/compose.yaml` (solo el servicio `win`, sin rutas del HOME) están en la rama `chore/win-recipe` (base `c41dd42`), y la prueba corre con esa receta por omisión. Queda pendiente **la referencia al commit** de esa rama: la unidad no commitea; cuando la coordinación lo cree, se anota el hash aquí |
| `libsqlite3-dev` y `libssl-dev` no los usa este target | `cargo tree --target x86_64-pc-windows-gnu`: `libsqlite3-sys` es `bundled` (compila su SQLite) y TLS resuelve en `schannel`, sin `openssl-sys`. La imagen trae SQLite 3.40.1 y el binario lleva 3.51.3 | Peso muerto. Cuestan tiempo de build. **No se quitó en esta unidad** |
| La imagen `win` no puede ejecutar su propio artefacto | `command -v wine` dentro del contenedor → ausente | Es una imagen de *compilación*, no de prueba. El sondeo de §6 corre en el host. Quien espere «compilar y probar en el contenedor» se equivoca. Opciones: instalar Wine en la imagen (más peso) o mantener la separación explícita, como está documentada aquí |
| El repo se monta en **solo lectura** | `compose.yaml`: `read_only: true` | Correcto y deliberado: un build no puede tocar el árbol. Efecto lateral conocido: `tests/integration_test.rs` necesita CWD escribible (deuda de D-03) |

---

## 11. Criterios de cierre de T8

| # | Criterio (S1, S9, S11) | Estado | Evidencia |
|---|---|---|---|
| 1 | El segundo entorno **compila** desde cero y sin warnings | **CUMPLIDO** | §2: `Finished` en 1m 46s, 0/0 |
| 2 | El binario es un PE32+ x86-64 válido | **CUMPLIDO** | §3 |
| 3 | Despliegue en un solo archivo: sin DLL de SQLite ni de runtime | **CUMPLIDO** | §4: tres importaciones en cero |
| 4 | El perfil Windows no arrastra ZIM | **CUMPLIDO** | §5: 0 coincidencias de `zim` |
| 5 | Arranque reproducible en instalación limpia | **CUMPLIDO bajo Wine** | §6: prefijo vacío → `/health` 200 en < 20 s |
| 6 | Degradación declarada y honesta por plataforma | **CUMPLIDO** | §7: 503 para ZIM, 500 con causa para TTS |
| 7 | Evidencia registrada y repetible | **CUMPLIDO** | §8: `tests/win-cross-build.sh`, seis controles, exit 0 |
| 8 | Ejecución en **Windows** | **NO CUMPLIDO** | §12: no hay forma no interactiva de hacerlo desde aquí |

T8 pide «al menos dos entornos». La letra se cumple: Linux (D-01a/D-02) y Windows-como-target + Wine-como-ejecutor. **La intención no del todo**: el segundo entorno de *ejecución* medido es Wine, no Windows.

---

## 12. Lo que sigue sin verificar

| Flanco | Estado | Por qué |
|---|---|---|
| **Ejecución en Windows real** | **NO VERIFICADO** | WinBoat expone solo RDP interactivo en `127.0.0.1:47300`; no hay WinRM ni agente, así que no se puede lanzar el `.exe` desde aquí sin sesión de escritorio remoto |
| Windows 7 / 8 | **NO VERIFICADO** | Sin VM. Solo hay una inferencia por la API set importada (`api-ms-win-core-synch-l1-2-0`): piso práctico Windows 8+ |
| Windows 10 / 11 | **NO VERIFICADO** | Es la misma carencia que el primer renglón: es donde *debería* funcionar y no se midió |
| Firma de código (Authenticode) | **NO VERIFICADO** | El `.exe` va sin firmar. SmartScreen y las políticas de aplicación de un colegio lo tratarán como desconocido |
| Antivirus / Windows Defender | **NO VERIFICADO** | Un `.exe` sin firma que abre un puerto y crea una base puede cuarentenarse. No se probó |
| Firewall de Windows | **NO VERIFICADO** | El bloqueo de conexiones entrantes al puerto está documentado como paso del operador (L4), no medido |
| Reproducibilidad bit a bit del artefacto | **NO VERIFICADO / sabido negativo** | §3.1: dos builds difieren en `TimeDateStamp` y `CheckSum` |
| Frontend servido en Windows | **NO VERIFICADO** | En el sondeo no se copió `frontend/out/`; `/` respondió desde `landing_page`, no desde el bundle |
| `yt-dlp`, `ffmpeg` en Windows | **NO VERIFICADO** | No existen en un Windows limpio; la matriz de §7 solo cubre ZIM y TTS |
| Migración de la base desde una instalación Linux | **NO VERIFICADO** | El arranque probado es de base nueva. Un `educonect.db` traído de Linux no se probó |
| Cross-compilación Windows desde un clon sin nada del operador | **VERIFICADO en T9** | §2.1: copia limpia en `/tmp`, receta del repositorio, exit 0 con los seis controles |
| Servicios `dev`, `nodev` y `lockfile` del entorno de desarrollo | **SIGUEN FUERA DEL REPOSITORIO** | No se copiaron: esta unidad movió solo la receta de cross-compilación. La línea base de desarrollo sigue dependiendo de la receta del operador (`entorno-compilacion.md` §8.2) |

### 12.1 Tipos de evidencia de este documento

| Tipo | Qué prueba | Qué no prueba |
|---|---|---|
| `cargo build --target …-windows-gnu` | El perfil default **compila** para Windows sin ZIM | Que el binario corra en Windows |
| `file` / `objdump -p` | Formato PE32+ y **ausencia de enlace** a DLL externas | Comportamiento en ejecución |
| `cargo tree --target` | El grafo del target no incluye `zim` | Nada sobre el runtime |
| Ejecución bajo Wine | El binario **arranca** y sirve HTTP con una API compatible de Windows | Nada sobre Windows real: Wine implementa las API, no las valida |
| Matriz `curl` de §7 | Degradación observable del contrato | Regresión futura: el script no re-verifica la matriz (solo `/health`) |
| `tests/win-cross-build.sh` | Los seis controles son **repetibles** | Nada si no hay Docker: en ese caso sale 77 y no aprueba |

---

## 13. Registro de decisiones

| Elemento | Decisión |
|---|---|
| D-WIN | **Aceptación técnica del cruce de compilación.** Windows real sigue pendiente |
| Perfil compilado | Default (sin feature `zim`), que es el que se distribuye |
| Evidencia durable | `tests/win-cross-build.sh`: seis controles, exit 0/1/3/77, sin falsos aprobados |
| `Dockerfile.win` y `compose.yaml` | **Versionados en T9** en `docker/windows/`. El Dockerfile es copia byte a byte (sha256 `55245bd8…cda55`); el compose conserva servicio, montaje en solo lectura y volúmenes, cambia el `source` del bind por `${EDUCONNECT_REPO:-../..}`, fija `RUST_VERSION` a `1.88.0` por omisión y usa el nombre de proyecto `educonect-win-cross` |
| `libsqlite3-dev` / `libssl-dev` en la imagen | Innecesarios para este target; **no se quitaron** |
| H.264 | La detección es real y lanza `ffmpeg`; bajo Wine se leyó la rama de fallo. Documentación corregida solo en referencias de línea (§9.1) |
| Reproducibilidad del hash | **No** se afirma. Solo el tamaño es estable entre builds |
| Ejecución en Windows | **Bloqueante declarado**, no un «pendiente menor»: necesita sesión RDP o WinRM |
| Commit | Prueba y este informe quedan en el árbol de trabajo; sin commit por indicación de la unidad |
