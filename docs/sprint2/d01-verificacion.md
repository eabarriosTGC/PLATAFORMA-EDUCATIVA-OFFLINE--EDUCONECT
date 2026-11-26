# D-01a — Verificación y auditoría de aceptación

**ZIM como capacidad opcional, desactivada por defecto.**
Línea base: `a27adec` · rama `fix/portable-runtime-baseline` · imagen de referencia `768ca06704d7` · Rust 1.88.0.

Logs crudos en `docs/sprint2/`: `profile-default.log`, `profile-zim.log`, `tests-default.log`, `tests-zim.log`, `tests-zim-lib.log`, `ldd-baseline.log`, `auditar-clausura.log`.

Los diffs completos de la unidad no viven en archivos `.patch`: quedaron versionados como commits. Se reproducen con:

```
git show 215ab7e -- edu-conect-rural-server/Cargo.toml edu-conect-rural-server/src/
git show 215ab7e -- edu-conect-rural-server/Cargo.lock
```

---

## 1. Alcance real del diff

| Archivo | Inserción / borrado |
|---|---|
| `edu-conect-rural-server/Cargo.toml` | feature `zim`, `zim-rs` opcional, crate `zim 0.4.0` retirado |
| `edu-conect-rural-server/src/config.rs` | 6 líneas |
| `edu-conect-rural-server/src/main.rs` | 101 líneas |
| `edu-conect-rural-server/Cargo.lock` | +28 / −636 |
| **Código (sin lock)** | **+106 / −14** |

**Sin cambios fuera del alcance.** Verificado con `git diff --name-only`: ningún archivo fuera de esos cuatro. `start.sh` figura como modificado, pero con 0 líneas de diferencia (cambio de modo previo a esta tarea, no atribuible a D-01a). No se tocaron migraciones, seeds, SQLite, frontend, `zim_proxy.rs` ni `.github/`.

---

## 2. Demostración 1 — Independencia de compilación

Imagen hermana `educonect-dev-env-nodev`, idéntica salvo por la ausencia de `libzim-dev`, `libxapian-dev` e `libicu-dev`.

| Comprobación | Resultado |
|---|---|
| `pkg-config --exists libzim` | **ausente** |
| `pkg-config --exists libxapian` | **ausente** |
| `pkg-config --exists icu-uc` | **ausente** |
| Archivos `/usr/include/zim*`, `/usr/lib/*/libzim*` | **no existen** |
| `cargo build --locked` desde `target` vacío | **PASS** — `Finished dev profile in 2m 32s` |

Antes de D-01a, `zim-sys/build.rs:28` ejecutaba `pkg_config::probe_library("libzim").unwrap()`: en esta imagen la compilación habría abortado. **La independencia de compilación está demostrada.**

---

## 3. Demostración 2 — Independencia de ejecución

### `ldd`, los tres casos

| Perfil | Entradas | Bibliotecas |
|---|---|---|
| **Línea base** (`ldd-baseline.log`) | **15** | libzim, libxapian, libicu×3, libuuid, liblzma, libzstd, libz, libstdc++, libc, libm, libgcc_s, ld |
| **Con `--features zim`** | **15** | **idénticas a la línea base** |
| **Default (sin feature)** | **5** | `libc`, `libm`, `libgcc_s`, `ld-linux`, `vdso` |

Coincidencias de `zim|xapian|icu` en el perfil default: **0**.

### Lo que desapareció, y una advertencia

El perfil default perdió **10 de las 13 bibliotecas reales**: las 5 atribuibles a ZIM con certeza, más `libuuid`, `liblzma`, `libzstd`, `libz` (dependencias de `libzim`) **y `libstdc++.so.6`**.

`libstdc++` es el dato más elocuente: era la única razón por la que el binario necesitaba runtime de C++. Sin `zim-sys`/`cxx`, el binario default es **Rust puro más la libc**.

**Advertencia registrada:** que hayan desaparecido no prueba por sí solo que desaparecerán en todos los entornos futuros. Prueba que en esta compilación concreta no están enlazadas. Si mañana otra dependencia exige `libz` o `liblzma`, volverán. Lo que queda demostrado es la **ausencia de enlace**, no la imposibilidad futura.

### Independencia de ejecución, no solo de enlace

El binario default **se ejecutó** en la imagen nodev —sin `libzim`, sin `libxapian`, sin `icu-dev`— y respondió correctamente. No es solo que `ldd` no las liste: el servidor arrancó y sirvió peticiones en un entorno donde esas bibliotecas de desarrollo no existen.

---

## 4. Demostración 3 — Compatibilidad funcional del perfil ZIM

| Comprobación | Resultado |
|---|---|
| `cargo build --locked --features zim` | **PASS** — `Finished dev profile in 1m 01s` |
| `zim-rs v0.1.1` compilado y enlazado | Sí |
| `ldd` frente a línea base | **Idéntico** |
| Tests unitarios (bin) | **67 passed**, 0 failed |
| Tests unitarios (lib) | **23 passed**, 0 failed |
| `integration_test` | **3 passed**, 0 failed |

Totales por perfil, verificados ejecutando cada binario de prueba por separado:

| Perfil | lib | bin | integración | Total |
|---|---|---|---|---|
| Default | 23 | 59 | 3 | **85** |
| `--features zim` | 23 | **67** | 3 | **93** |

Nota sobre la diferencia: el perfil ZIM ejecuta **8 tests más** en el binario (67 frente a 59), que corresponden exactamente a los que aporta la feature — 4 de `config::tests_default_zim_dir` y 4 de `zim_proxy`. El bloque de librería es idéntico (23) en ambos perfiles, lo que confirma que `lib.rs` no contiene código ZIM: declara solo `db`, `models` y `network`. Es el comportamiento esperado, no una regresión.

---

## 5. Compuerta de calidad — Clippy

| Perfil | Comando | Resultado |
|---|---|---|
| Default | `cargo clippy --locked -- -D warnings` (el del CI) | **PASS** — `Finished in 8.13s`, sin advertencias |
| ZIM | `cargo clippy --locked --features zim -- -D warnings` | **PASS** — `Finished in 8.79s`, sin advertencias |
| Default | `cargo clippy --locked --all-targets -- -D warnings` | **FALLA** — `src/rate_limit.rs:53`, método `reset` nunca usado |
| `cargo fmt --all --check` | — | **PASS** |

### Deuda preexistente, documentada y no corregida

`cargo clippy --all-targets -- -D warnings` detecta una advertencia que el comando del CI **no** detecta:

1. `mod rate_limit;` se declara **solo en `main.rs`**, no en `lib.rs`.
2. `pub async fn reset()` está anotado `#[cfg(test)]`.
3. Ningún test lo invoca: los tests de ese archivo usan `check()`.
4. Sin `--all-targets` no se compila el target de test y el ítem no existe.
5. El CI usa `cargo clippy -- -D warnings` (`.github/workflows/ci.yml:39`), sin `--all-targets`.

No se corrige en D-01a: `rate_limit.rs` no forma parte del diff y arreglarlo implicaría ampliar el alcance. **Tarea de mantenimiento independiente.**

---

## 6. Contrato de degradación HTTP

Binario default ejecutándose en la imagen nodev.

| Petición | Código | `Content-Type` | Cuerpo |
|---|---|---|---|
| `GET /zim/` | **503** | `text/html; charset=utf-8` | página legible con instrucción de recompilar |
| `GET /zim/A/Colombia` | **503** | `text/html; charset=utf-8` | idem (subruta) |
| `GET /api/wikipedia/search?q=agua` | **503** | `application/json` | ver §6.1 |
| `GET /api/wikipedia/article?path=A/Colombia` | **503** | `application/json` | ver §6.1 |
| `GET /api/wikipedia/zims` | **503** | `application/json` | ver §6.1 |
| `GET /health` | **200** | `application/json` | `{"status":"ok","version":"0.1.0"}` |
| `GET /ruta-que-no-existe` | **404** | — | vacío |
| `GET /api/noexiste` | **404** | — | vacío |

### 6.1 Cuerpo de la API — contrato semántico

El contrato se define por **contenido**, no por representación textual. **El orden de las claves no forma parte del contrato.**

| Elemento | Garantía |
|---|---|
| Código HTTP | **503** |
| `Content-Type` | `application/json` |
| Objeto JSON | con exactamente dos propiedades |
| `error` | `string`, valor `capacidad zim no incluida en esta compilación` |
| `capacidad` | `string`, valor `zim` |
| Consumidores | deben identificar propiedades **por nombre**, nunca por posición |

Observación de salida: hoy `serde_json::json!` emite las claves en orden alfabético (`capacidad` antes de `error`). Eso es un detalle de implementación, **no una garantía**. Ninguna prueba ni consumidor debe depender de él.

El mensaje canónico `capacidad zim no incluida en esta compilación` aparece tanto en el JSON como en la página HTML, para que quien lea el navegador y quien consuma la API reciban el mismo texto. Un test de D-01b verifica ambas apariciones y, con eso, detecta cualquier divergencia futura entre los dos canales.

Si en el futuro se necesita JSON canónico —para firmas, hashes o comparación byte a byte— será una decisión técnica independiente, y requerirá fijar el orden con una estructura `serde` explícita. Hoy no se requiere.

### 6.2 Las dos pruebas que sostienen la elección de 503

- `/health` responde **200** mientras `/zim/` responde **503**: el servidor está operativo y lo que falta es una capacidad de compilación. Ese es exactamente el mensaje que 404 no podía transmitir.
- `/ruta-que-no-existe` y `/api/noexiste` responden **404**: el handler de degradación **no es un comodín**. No captura rutas ajenas.

### 6.3 Las seis rutas están registradas en ambos perfiles

El perfil ZIM sirve las mismas seis rutas desde el mismo punto del router (`.merge(zim_routes)`), y su `ldd` es idéntico a la línea base. El perfil default las registra con el handler de degradación.

---

## 7. Tests de integración: el fallo era del montaje, no del código

Primera ejecución: `3 failed` en 0.01 s.

```
panicked at tests/integration_test.rs:34:
Fallo al abrir BD de test: Sqlite(CannotOpen,
  "unable to open database file: data/test_integration_6440_reads.db")
```

Causa: el arnés crea su base en una ruta **relativa al CWD** (`data/…`) y el repositorio está montado en solo lectura.

Segunda ejecución, mismo binario ya compilado, desde un CWD escribible en `/tmp`: **3 passed** en 7.90 s (perfil default) y **3 passed** en 7.93 s (perfil ZIM).

El código fuente probado es el mismo: el binario de test se compiló desde `/workspace` (montaje de solo lectura, sin posibilidad de modificación) y lo único que cambió fue el directorio de trabajo del proceso.

**Hallazgo para D-03:** `tests/integration_test.rs` depende del CWD y de poder escribir en él. Debe usar `DATA_DIR` cuando exista, una ruta temporal explícita cuando no, y garantizar aislamiento entre ejecuciones concurrentes. No se corrige en D-01a.

---

## 8. Estado del manifiesto

| Comprobación | Resultado |
|---|---|
| Paquetes en el lock, antes → después | **372 → 308** |
| Pares `nombre + versión` retirados | **64** |
| Paquetes agregados | **0** |
| `zim 0.4.0` en `Cargo.lock` | **eliminado** |
| `zim-rs` / `zim-sys` en el lock | presentes como opcionales (`zim-rs 0.1.1`, `zim-sys 0.1.0`) |
| `--locked` respetado en ambos perfiles | sí |
| Validación TOML del manifiesto tras el cambio | `cargo metadata --locked` → OK |

### 8.1 Qué son exactamente las 28 líneas agregadas

No son dependencias nuevas. Son **re-cualificaciones**: cuando conviven dos versiones de un crate, Cargo escribe `"syn 1.0.109"` para desambiguar; al retirar la versión duplicada queda `"syn"`. Verificado en el diff:

```
- "syn 2.0.117",        + "syn",           (22 ocurrencias)
- "thiserror 2.0.18",   + "thiserror",      (3)
- "thiserror-impl 2.0.18", + "thiserror-impl", (1)
- "num-bigint 0.4.6",   + "num-bigint",     (1)
- "r-efi 6.0.0",        + "r-efi"           (1)
```

Ninguna arista de dependencia nueva. Ninguna versión de crate cambiada.

### 8.2 Los 64 pares retirados

`zim 0.4.0` y su árbol: `clap_derive 4.6.1`, `indicatif 0.17.11`, `console 0.15.11`, `number_prefix 0.4.0`, `Inflector 0.11.4`, `pbr 1.1.1`, `stopwatch 0.0.7`, `anstream/anstyle-*`, `colorchoice`, `utf8parse`, `is_terminal_polyfill`, `once_cell_polyfill`, `encode_unicode`, `arrayvec`, `lzma-sys 0.1.20`, `xz2 0.1.7`, `zstd 0.12.4`, `zstd-safe 6.0.6`, `zstd-sys 2.0.16`, `bitreader`, `memmap 0.7.0`, `md-5 0.10.6`, `hex 0.4.3`, `ouroboros`/`ouroboros_macro 0.15.6`, `aliasable`, `num`/`num-*` (6 paquetes), `num_cpus`, `num-format`, `rayon`/`rayon-core`, `crossbeam-channel`/`-deque`/`-epoch`/`-utils`, `either`, `jobserver`, `getrandom 0.3.4`, `rand 0.4.6`, `rand_core 0.3.1` y `0.4.2`, `rdrand`, `rustc-serialize`, `fuchsia-cprng`, `web-time`, `hermit-abi`, `r-efi 5.3.0`, `portable-atomic`, `proc-macro-error`/`-attr`, `syn 1.0.109`, `thiserror 1.0.69`/`-impl`, `winapi`, `winapi-*-pc-windows-gnu`, `windows-sys 0.59.0`.

Diez de esos paquetes **siguen presentes en otra versión** —`syn 2.0.117`, `thiserror 2.0.18`, `windows-sys 0.52.0` y `0.61.2`, `rand`, `rand_core`, `getrandom`, `num-bigint 0.4.6`, `r-efi 6.0.0`—, lo que confirma que se retiró una **versión duplicada**, no la funcionalidad que otros crates usan.

**Precisión:** las 636 líneas menos del lock no equivalen a 636 líneas menos de código compilado. Eliminan resolución y descarga de un árbol que nunca se usaba.

### 8.3 Auditoría por clausura de dependencias

En lugar de revisar el parche línea por línea, se calculó la **clausura transitiva de `zim 0.4.0`** en el lock de la línea base y se contrastó contra el conjunto de paquetes retirados.

| Comprobación | Resultado |
|---|---|
| Paquetes en la clausura de `zim 0.4.0` (lock viejo) | **124** |
| Paquetes retirados | **64** |
| Retirados **fuera** de la clausura | **0** |
| Paquetes agregados | **0** |
| Supervivientes cuya **versión en uso** cambió | **0** |

**Los 64 retirados pertenecen íntegramente al árbol de `zim 0.4.0`.** Ninguno es un paquete ajeno. Los otros 60 miembros de la clausura siguen en el lock porque otros crates dependen de ellos.

### 8.4 Por qué las re-cualificaciones prueban la consistencia

Nueve nombres perdieron una versión duplicada. De esos nueve, **solo cinco quedaron con una única versión**: `num-bigint`, `r-efi`, `syn`, `thiserror`, `thiserror-impl`. Y son **exactamente los cinco** que aparecen como re-cualificados en las 28 líneas agregadas.

Los otros cuatro —`getrandom`, `rand`, `rand_core`, `windows-sys`— conservaron dos o más versiones, de modo que sus entradas siguen cualificadas y no generan línea nueva.

La correspondencia es total y en ambos sentidos. No hay re-cualificación sin duplicado eliminado, ni duplicado eliminado que deje un nombre con versión única sin re-cualificar. Esto descarta cambios de versión inadvertidos.

### 8.5 Consistencia manifiesto ↔ lock

| Comprobación | Resultado |
|---|---|
| `cargo metadata --locked` tras el cambio de manifiesto | **OK** |
| `cargo build --locked` (perfil default, imagen sin ZIM) | **PASS** |
| `cargo build --locked --features zim` | **PASS** |
| Tests ejecutados sobre ese lock | **85 + 93** |

### 8.6 Cobertura demostrada del script de auditoría

El script tiene **cinco** condiciones que producen `AUDITORÍA INVÁLIDA` y `exit 1`. Las cinco están ejercitadas, no solo implementadas:

| Condición | Fixture | Evidencia observada |
|---|---|---|
| `ambiguas > 0` | `fixtures/lock-ambiguedad.toml` | `AMBIGUA: raiz 0.1.0 -> dup (ambigua:2)` → INVÁLIDA, exit 1 |
| `irresolubles > 0` | `fixtures/lock-irresoluble.toml` | `IRRESOLUBLE: raiz 0.1.0 -> fantasma` → INVÁLIDA, exit 1 |
| `agregados > 0` | `fixtures/lock-{antes,despues}-agregado.toml` | `retirados: 0  agregados: 1` → INVÁLIDA, exit 1 |
| cambio de versión con ganancia | `fixtures/lock-{antes,despues}-ganancia.toml` | `x pierde=[] gana=['2.0.0'] -> CAMBIO REAL` → INVÁLIDA, exit 1 |
| retirados fuera de la clausura | ejecución real con raíz `serde` | INVÁLIDA |
| **control**: grafo consistente | `fixtures/lock-consistente.toml` | 3 paquetes en clausura, 1 ref exacta y 1 por nombre → **VÁLIDA**, exit 0 |

Salida en `docs/sprint2/auditar-clausura-pruebas.log`.

El fixture de ambigüedad también ejerce la **identidad por terna**: el script reporta `pares (nombre, versión) con más de una fuente: 1` y lista los dos `source` distintos de `dup 1.0.0`. Es decir, la parte del algoritmo que distingue origen no queda solo declarada.

### 8.7 Lo que sigue sin ejercitarse

| Flanco | Estado |
|---|---|
| Referencias de tres campos `"nombre version (source)"` | Implementadas. **Cero ocurrencias en ambos locks reales.** No se declaran verificadas: un fixture sintético probaría mi supuesto sobre el formato, no la salida real de Cargo |
| Paquetes huérfanos conservados por Cargo | No auditado. Fuera del alcance acordado |

### 8.8 Precisión sobre la prueba de «raíz inexistente»

`auditar-clausura.py` con una raíz que no existe sale con código 1 por `sys.exit("ERROR: ...")`. Es **validación de entrada**, no invalidación de auditoría: no llega a calcular clausura ni veredicto. Se distingue para no contarla como evidencia de las cinco condiciones.

---

## 9. Criterios de cierre

| # | Criterio | Estado | Evidencia |
|---|---|---|---|
| 1 | Compilación predeterminada sin bibliotecas de desarrollo ZIM | **CUMPLIDO** | §2, build 2m32s en nodev |
| 2 | Tests predeterminados satisfactorios | **CUMPLIDO** | §7: 23 lib + 59 bin + 3 integración = 85 |
| 3 | Binario predeterminado sin dependencias dinámicas ZIM | **CUMPLIDO** | §3: 5 entradas, 0 coincidencias |
| 4 | Cinco rutas con degradación 503 y servicio de salud operativo | **CUMPLIDO** | §6. Las seis rutas ZIM registradas son cinco de contenido (2 × `/zim/*` + 3 × `/api/wikipedia/*`); la sexta comprobación de la corrida es `/health`, que responde 200 |
| 5 | Rutas desconocidas conservan su 404 | **CUMPLIDO** | §6.2 |
| 6 | Compilación con ZIM habilitado satisfactoria | **CUMPLIDO** | §4, build 1m01s |
| 7 | Tests y comportamiento ZIM original satisfactorios | **CUMPLIDO** | §4: 23 lib + 67 bin + 3 integración = 93; `ldd` idéntico |
| 8 | Diff revisado, sin cambios fuera del alcance | **CUMPLIDO** | §1 |

---

## 10. Límites de esta verificación

Lo que **no** está demostrado y no debe declararse:

1. **Portabilidad.** El binario default no enlaza ZIM, pero no se probó en Windows ni en otra distribución. `ldd` mide enlaces, no portabilidad.
2. **Que las bibliotecas no vuelvan.** Si otra dependencia exige `libz`, `liblzma` o `libicu`, reaparecerán. Lo demostrado es la ausencia de enlace en esta compilación.
3. **Comportamiento funcional de ZIM con archivos reales.** El perfil ZIM compila, pasa sus pruebas y enlaza igual que la línea base, pero no se cargó ningún `.zim` real: el repositorio no contiene ninguno.
4. **El frontend.** El ítem «Wikipedia Offline» sigue visible y ahora lleva a un 503 explícito. Es el comportamiento acordado para D-01a.
5. **Ejecución en hardware objetivo.** Sigue pendiente, y sigue siendo el criterio que no se puede sustituir con Docker.
6. **Las verificaciones HTTP son manuales, no pruebas automatizadas.** Las 8 comprobaciones de §6 se hicieron con `curl` contra el binario en ejecución. **No existe hoy ningún test automatizado que cubra el contrato 503.** Consecuencia: si alguien modifica `zim_no_disponible_api` o `zim_no_disponible_html` mañana, nada lo detectará en CI. Es una brecha real de cobertura, no un detalle de forma.
7. **Cobertura automatizada real.** `cargo test` cubre lógica de servidor (base de datos, evaluaciones, autenticación, límite de tasa) e integración concurrente. No cubre rutas HTTP del router de producción: el `integration_test` monta su propio router, observación que ya constaba en el diagnóstico previo. El contrato de degradación no es una excepción a esa regla.

### 10.1 Distinción entre tipos de evidencia

| Tipo | Qué prueba | Qué no prueba |
|---|---|---|
| `cargo build` en imagen sin ZIM | Independencia de **compilación** | Nada sobre ejecución |
| `ldd` | Ausencia de **enlace** dinámico | Portabilidad ni funcionamiento |
| `cargo test` (23 + 59 + 3) | Lógica y concurrencia interna | Rutas HTTP del router real |
| Ejecución del binario en nodev | Independencia de **ejecución** | Comportamiento con datos reales |
| 8 comprobaciones `curl` | Comportamiento observable del contrato | Regresión futura: no están automatizadas |
| Perfil ZIM compilado y probado | Compatibilidad de la capacidad | Servir un `.zim` real: no hay ninguno en el repo |

---

## 11. Registro de decisiones

| Elemento | Decisión |
|---|---|
| D-01a | **Aceptación técnica favorable**, pendiente de inspección del diff |
| Orden de claves del JSON | **No forma parte del contrato.** Contrato semántico (§6.1) |
| Compuerta de Clippy | `cargo clippy -- -D warnings`, el comando del CI, sin `--all-targets` |
| D-01b | Pendiente, **no iniciado** |
| `rate_limit.rs:53` | Deuda independiente, fuera del alcance |
| `integration_test.rs` y `data/` relativo | Insumo para D-03 |
| Pruebas en hardware objetivo | Pendientes |
| Commit | **No realizado.** Los parches quedan separados para revisión |
