# D-CI 2 — Compuerta de enlace del perfil `default`

Rama `chore/ci-ldd-leg`, derivada de `feature/d02-config-check`. Verificación hecha en el entorno
contenedorizado (`nodev` sin ZIM, `dev` con ZIM), Rust 1.88.0.

## 1. Qué cambió

| Archivo | Cambio |
|---|---|
| `.github/workflows/ci.yml:65-74` | Paso `Verify default link closure has no ZIM libraries (ldd)`, entre `Build` y `Run tests`, con `if: matrix.perfil == 'default'` |
| `scripts/verificar-ldd-default.sh` (nuevo, 109 líneas) | Compuerta `ldd`. `0` válido · `1` biblioteca prohibida (la nombra) · `2` no verificable |
| `scripts/pruebas-ci-ldd.sh` (nuevo, 333 líneas) | 28 pruebas deterministas: clausuras reales por stub + invariantes del workflow |

**Nada más cambia.** El diff del workflow es de **+10 líneas y 0 borradas**. Sin renombrar el job,
sin tocar la matriz, sin tocar el leg `con-zim`.

## 2. Por qué `cargo build` no bastaba

`cargo build` en el leg default demuestra **independencia de compilación**: `zim-sys/build.rs` no
encuentra `libzim` y aborta. No demuestra que el binario resultante deje de arrastrar la cadena de
ZIM por **enlace dinámico**. Son dos propiedades distintas y D-01a las midió por separado
(`d01-verificacion.md` §2 y §3). Lo que faltaba en CI era la segunda.

## 3. Contrato de la compuerta

| Código | Significado | Por qué |
|---|---|---|
| 0 | Ninguna de `libzim`, `libxapian`, `libicu`, `libstdc++` en la clausura | Aprueba |
| 1 | Al menos una aparece; imprime `INFRACCIÓN: … enlaza «libX»` con las líneas de `ldd` | Falla el job nombrando la culpable |
| 2 | **NO VERIFICABLE**: binario ausente, `ldd` ausente, `ldd` ≠ 0, o clausura sin ninguna entrada reconocible | Una compuerta que no midió **no puede aprobar** |

El código 2 responde a la lección de proceso registrada en `ESTADO-2026-11-26.md`: los comandos de
verificación fallan en silencio. Antes de medir, el script confirma el **estado** del binario con
`-f`, `ls -l` y `file`; después exige que `ldd` haya salido 0 **y** que haya devuelto al menos una
**entrada reconocible**: una línea con `=>` o con un nombre de biblioteca terminado en `.so` /
`.so.N` —así cuentan `linux-vdso.so.1` y `ld-linux-x86-64.so.2`, que no llevan `=>`—. Un diagnóstico
suelto (`not a dynamic executable`) **no** es una entrada.

Las cuatro familias prohibidas se comparan por **nombre de biblioteca** (el token, sin ruta y sin
sufijo `.so.N`), no por subcadena de la línea: una familia incluye sus variantes reales
(`libicu` → `libicuuc`, `libicui18n`, `libicudata`) pero no una biblioteca distinta ni una ruta que
mencione el nombre (`/opt/libicu-legacy/libfoo.so.1` no es `libicu`). Ver §7.

## 4. Evidencia — el paso no es un no-op

### 4.1 Perfil default real (imagen `nodev`, `--release`)

```
$ docker compose run -T --rm nodev bash -lc 'cd /workspace/edu-conect-rural-server && cargo build --locked --release'
    Finished `release` profile [optimized] target(s) in 52.18s

$ ls -l /opt/target/release/edu-conect-rural-server
-rwxr-xr-x 2 root root 9766424 ... /opt/target/release/edu-conect-rural-server
ELF 64-bit LSB pie executable, x86-64, dynamically linked, stripped

$ bash scripts/verificar-ldd-default.sh target/release/edu-conect-rural-server
  total: 5 entradas — linux-vdso, libgcc_s, libm, libc, ld-linux
  ausente: libzim · libxapian · libicu · libstdc++
RESULTADO: VÁLIDO — 5 entradas en la clausura; ninguna de las prohibidas.
CODIGO=0
```

Ejecutado con el **CWD del job** (`edu-conect-rural-server/`) y la ruta por defecto del script: la
invocación exacta del pipeline.

### 4.2 Binario real CON ZIM — la compuerta falla

Construido en `dev`, que sí tiene `libzim-dev`:

```
$ docker compose run -T --rm dev bash -lc 'cargo build --locked --release --features zim'
    Finished `release` profile [optimized] target(s) in 50.53s

$ bash scripts/verificar-ldd-default.sh /opt/target/release/edu-conect-rural-server
INFRACCIÓN: enlaza «libzim»:     libzim.so.8 => /lib/x86_64-linux-gnu/libzim.so.8
INFRACCIÓN: «libxapian»:         libxapian.so.30
INFRACCIÓN: «libicu»:            libicui18n.so.72, libicuuc.so.72, libicudata.so.72
INFRACCIÓN: «libstdc++»:         libstdc++.so.6
RESULTADO: INVÁLIDO — 4 de 4 aparecen en la clausura.
CODIGO=1
```

15 entradas, idéntico a `ldd-baseline.log`. El contraste 5 → 15 es la diferencia entre un binario
portable y uno atado a la cadena ZIM, y es exactamente lo que la compuerta distingue.

### 4.3 El caso silencioso, descartado

```
$ bash scripts/verificar-ldd-default.sh target/release/inexistente
ERROR: no existe el binario: target/release/inexistente (¿se ejecutó el build antes de esta compuerta?)
RESULTADO: NO VERIFICABLE — no se midió el enlace; la compuerta no aprueba.
CODIGO=2
```

También cubierto: un `ldd` que falla **imprimiendo una clausura limpia** sale con 2, nunca «válido».

### 4.4 Pruebas

```
$ bash scripts/pruebas-ci-ldd.sh
  PRUEBAS: 28 pasadas, 0 fallidas   ·   RESULTADO: OK
```

RED previo, con la compuerta y el paso ausentes: 6 pasadas / 15 fallidas. Incluye 6 casos PRESERVE
que fijan `name: test (${{ matrix.perfil }})`, `perfil: default`/`con-zim`, los paquetes de cada leg,
`--features zim` del leg ZIM y la condición del paso nuevo. Tras el endurecimiento (§7) son 28:
las 21 originales más 7 nuevas (F1, F2 y los cuatro sondeos de entorno).

### 4.5 YAML

```
$ node -e 'YAML.parse(ci.yml)'
YAML OK — jobs: test, docker
name del job: "test (${{ matrix.perfil }})"
matrix: default {libssl-dev pkg-config, ""} · con-zim {libssl-dev pkg-config libzim-dev, --features zim}
pasos: … | Build | Verify default link closure (ldd) | Run tests
```

`actionlint` no está instalado en el host y no hay `pyyaml`; la validación se hizo con un parser YAML
real y con `bash -n` sobre los dos scripts.

## 5. Nombres de job — sin cambios

`test (default)` y `test (con-zim)` siguen derivándose de `name: test (${{ matrix.perfil }})`
(`ci.yml:21`), con `perfil: default` (`:30`) y `perfil: con-zim` (`:34`). El paso nuevo no toca
ninguno de los tres. El leg `con-zim` conserva paquetes y feature, y no ejecuta la compuerta: allí la
cadena ZIM es intencional.

## 6. Qué queda abierto

| Flanco | Estado |
|---|---|
| Ejecución real en GitHub Actions | **No observada.** Todo se verificó en el entorno contenedorizado; el primer run del pipeline es la prueba final |
| `libstdc++` en el perfil default | Hoy ausente y ahora protegido. Si una dependencia legítima futura exige runtime C++, la compuerta fallará y habrá que decidir si eso es aceptable: es una decisión, no un fallo del script |
| Leg `con-zim` en CI | Se puede construir aquí y su clausura con ZIM quedó registrada en §4.2. Que el pipeline no la mida es deliberado |
| `scripts/pruebas-ci-ldd.sh` en el pipeline | No se añadió: el paso de `ldd` ya es la defensa en CI; correr las pruebas costaría un job sin cubrir nada nuevo |
| **F3 — `ldd` prueba enlace, no uso en tiempo de ejecución** | Un `libzim.a` estático o un `dlopen("libzim.so.8")` son **invisibles** para `ldd`: la compuerta aprueba un binario que podría cargar la cadena ZIM en caliente. Lo que se demuestra es la clausura de enlace, no el comportamiento en ejecución |
| **F4 — un objetivo estático/musl futuro enrojece la compuerta** | Si el perfil default pasara a `*-musl` o a enlace estático, `ldd` respondería «not a dynamic executable» y la compuerta daría `2` (NO VERIFICABLE). Es un **acantilado del merge gate**, declarado a propósito: en ese escenario el paso de CI debe revisarse, no silenciarse |

## 7. Endurecimiento tras la verificación independiente

Una revisión independiente confirmó la compuerta y sus 21 pruebas (0 aprobaciones en 10 sondeos de
no-op, identidad `test (default)` / `test (con-zim)` intacta, orden correcto, y los binarios reales
re-derivados: 5 entradas / código 0 en default y 15 entradas / código 1 con `--features zim`).
Encontró **una forma de fail-open** y tres advertencias; dos se corrigen aquí. El contrato de
códigos 0/1/2 y los mensajes públicos no cambian, y `.github/workflows/ci.yml` no se toca.

### 7.1 F1 — un diagnóstico no puede contar como entrada

`entradas` contaba cualquier línea no vacía de `ldd`. Un `ldd` que saliera 0 imprimiendo solo un
diagnóstico (`not a dynamic executable`) producía `RESULTADO: VÁLIDO — 1 entradas` y código 0. No es
alcanzable con el `ldd` de glibc (sale 1 en objetos no dinámicos y la compuerta ya lo convierte en
`2`), pero la compuerta no debe **depender** de eso.

Ahora solo cuentan líneas que parecen entradas de la clausura: contienen `=>`, o un token terminado
en `.so` / `.so.N`. `linux-vdso.so.1 (0x…)` y `ld-linux-x86-64.so.2 (0x…)` no llevan `=>` y **siguen
contando**; la semántica de `2` se conserva: sin ninguna entrada reconocible la salida es
`NO VERIFICABLE`.

### 7.2 F2 — el nombre, no la subcadena

`grep -F -- libicu` marcaba como infracción una ruta como
`libfoo.so.1 => /opt/libicu-legacy/libfoo.so.1`. Ahora se compara el **nombre** de cada biblioteca de
la línea (basename, sin `.so.N`) contra la familia: `libicuuc.so.72` sigue siendo infracción,
`libzug.so.1` no dispara `libzim`, y la ruta con `libicu` no dispara nada. El fallo sigue siendo
ruidoso y sigue nombrando la biblioteca infractora.

### 7.3 Las siete pruebas nuevas

| # | Sondeo | Esperado |
|---|---|---|
| 1 | `ldd` ausente del PATH | código `2`, `ldd no está disponible en PATH` |
| 2 | `ldd` sale 0 imprimiendo solo espacios | código `2`, `no devolvió ninguna entrada`, nunca `VÁLIDO` |
| 3 | fixture `libzim.so.8 => not found` con `ldd` saliendo 0 (el caso real del leg default) | código `1`, nombra `libzim` |
| 4 | PATH con solo un `ldd` de prueba, sin `ls`/`grep`/`sed` | código `2` (falla cerrada) |
| 5 | **F1**: `ldd` sale 0 con solo un diagnóstico | código `2` (antes: `0` y `VÁLIDO`) |
| 6 | **F2**: `libfoo.so.1 => /opt/libicu-legacy/libfoo.so.1` | código `0`, sin infracción de `libicu` (antes: `1`) |
| 7 | PRESERVE de F2: `libzug.so.1` no dispara `libzim` | código `0` |

RED observado antes de los arreglos: 26 pasadas / 2 fallidas — los sondeos 5 y 6, con exactamente
los síntomas descritos (`código de salida 0, se esperaba 2` con `RESULTADO: VÁLIDO — 1 entradas`; y
`código de salida 1, se esperaba 0` con `INFRACCIÓN: … enlaza «libicu»` sobre la ruta
`/opt/libicu-legacy/`). Los sondeos 1–4 y 7 ya pasaban: fijan comportamiento existente.

### 7.4 Contraste real, sin recompilar

Ejecutada la compuerta arreglada contra las clausuras **reales registradas** —las 15 líneas del
binario con ZIM en `docs/sprint2/ldd-baseline.log` y las 5 del binario default— los números no se
mueven: default `RESULTADO: VÁLIDO — 5 entradas`, código `0`; con ZIM `4 de 4`, código `1`.
