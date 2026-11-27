# D-05 — Perfiles Docker Core / Full (Persona C — backend e integración)

Feature ODD. Alcance de este documento: D-05 completo. Lo que se ejecuta ahora es **sólo D-05a**.

Documento de referencia: `.git/coordinacion/tareas/D05.md` (diseño acordado), mensajes `pi-006`
(propuesta de perfiles), `pi-008` (ratificación y criterios de aceptación) y `pi-009` (ajustes y
códigos de `motivo`). Base de partida registrada: `main` @ `dc38c9e`.

## Specs

- **S1** — «Core: Compilación sin feature zim.»
- **S2** — «Sin dependencias nativas de ZIM.»
- **S3** — «Sin descarga de archivos ZIM.»
- **S4** — «Conservación del contrato HTTP de degradación.»
- **S5** — «Configuración válida para una base de datos nueva.»
- **S6** — «Full: Compilación explícita con feature zim.»
- **S7** — «Dependencias necesarias para ejecutar el lector.»
- **S8** — «Contenido ZIM mediante montaje externo.»
- **S9** — «Sin descargas masivas durante la construcción.»
- **S10** — «Funcionamiento degradado y explícito cuando falte contenido.»
- **S11** — «No modifiques todavía el router, frontend ni contrato de capacidades.»
- **S12** — «No implementes D-05b–f dentro de este cambio.»
- **S13** — «Se autoriza comenzar D-05a en un worktree independiente, desde una referencia estable y registrada de main.»
- **S14** — «Implementa los targets Core y Full según el diseño acordado en tareas/D05.md.»

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | **D-05a** — `Dockerfile` multi-etapa con targets `core` y `full` (`rust-builder` → `runtime-base` → `core`/`full`); `core` sin `libzim` ni feature, `full` con `--features zim` y `libzim`; ningún `.zim` dentro de la imagen; contenido sólo por montaje externo en `full`; compose por perfil; el mismo chequeo exige resultados **opuestos** en las dos patas | S1-S10, S13, S14 | `Dockerfile`, `Dockerfile.local`, `docker-compose*.yml` | — |
| T2 | **D-05b** — fixture ZIM mínimo con procedencia, licencia y sha256 | — | `tests/fixtures/` | — |
| T3 | **D-05c** — CI diferenciado con las siete detecciones | — | `.github/workflows/ci.yml`, `scripts/` | — |
| T4 | **D-05d** — `/api/capacidades` (espera a D-03, ya en `main`) | — | `src/main.rs` | — |
| T5 | **D-05e** — el frontend consume las capacidades | — | `edu-conect-rural-dashboard/`, `static/` | — |
| T6 | **D-05f** — `install.sh` consciente del perfil + actualización de T7 | — | `install.sh`, `docs/` | — |

T2 a T6 están **pendientes y no se tocan** en este cambio (S12).

## Log

**L1 — Encargo del humano (verbatim):**

> «Fase 3 — D-05a: Docker Core/Full
>
> Se autoriza comenzar D-05a en un worktree independiente, desde una referencia estable y registrada
> de main.
>
> Implementa los targets Core y Full según el diseño acordado en tareas/D05.md.
>
> Core:
>
> - Compilación sin feature zim.
> - Sin dependencias nativas de ZIM.
> - Sin descarga de archivos ZIM.
> - Conservación del contrato HTTP de degradación.
> - Configuración válida para una base de datos nueva.
>
> Full:
>
> - Compilación explícita con feature zim.
> - Dependencias necesarias para ejecutar el lector.
> - Contenido ZIM mediante montaje externo.
> - Sin descargas masivas durante la construcción.
> - Funcionamiento degradado y explícito cuando falte contenido.
>
> No modifiques todavía el router, frontend ni contrato de capacidades.
>
> No implementes D-05b–f dentro de este cambio.»

**L2 — Verificación independiente de D-05a (26/11):**

Veredicto: **S1–S14 cumplidas**, S11 y S12 respetadas (nada bajo `src/`, `dashboard/`, `static/`; ninguna
unidad de D-05b-f colada). El verificador reutilizó las imágenes del autor y comprobó su procedencia
contra las etapas del Dockerfile antes de medir.

Lo que la verificación **sí** demostró, y que la entrega no había demostrado:

- **`full` sirve contenido real por montaje externo.** Con `wikiquote_es.zim` montado read-only en
  `/data/contenido/zim`, `/api/wikipedia/zims` responde 200 con `{"default":"wikiquote_es","zims":[{…,"articles":16306}]}`,
  `/zim/` redirige 307 a `Main_Page` (200) y `/zim/A/Amor` devuelve 73 062 bytes. El **mismo montaje**
  sobre `core` sigue respondiendo 503: nunca lee el archivo. Eso convierte S8 en algo medido y no sólo
  declarado.
- **La sonda no es tautológica, en las dos direcciones.** Con el mismo artefacto en los dos huecos da 1;
  con el artefacto `core` en los dos huecos da 1 y nombra las tres fallas; con una imagen que contiene un
  `.zim` falso da 1 y el detector dispara; sin argumentos, con imagen inexistente o con la misma ruta da
  **2** («no verificable») y nunca 0.
- **La limitación de BuildKit es real y está bien documentada.** `docker buildx` no existe en esta
  máquina y el constructor clásico compila toda etapa ubicada **antes** del target: como `binario-full`
  (`Dockerfile:65`) y `full` (`:153`) van antes de `core` (`:176`), un build de `core` acá compila
  también la pata ZIM. Los targets siguen eligiendo el artefacto correcto; el aislamiento del grafo sólo
  se verá en CI.
- Contra el criterio ratificado en `pi-008` (`ldd` sin la cadena ZIM), `core` cumple: su clausura es
  libc/libm/libgcc. `libzim8` y `libxapian30` no están instalados.

**Hallazgos de la verificación, y qué se hizo con cada uno:**

| # | Hallazgo | Acción |
|---|---|---|
| 1 | La comprobación de contraste comparaba cadenas sin validarlas: un error del demonio en una pata y 200 en la otra satisfacía la desigualdad y la prueba pasaba en falso | **Corregido** en esta unidad: sólo `200` y `503` cuentan como medición; cualquier otra cosa es falla declarada |
| 2 | La prueba de resultados opuestos sólo corre **sin** contenido; la forma más fina (core montado vs full montado) no estaba en la sonda | Se verificó a mano; llevarlo a la sonda exige el fixture, que es D-05b |
| 3 | El build sigue descargando 87 MB que no son ZIM (16 PDF de la biblioteca, manifiesto con SHA-256) | Preexistente, sin cambios en esta unidad. Leído al pie de la letra, S9 no está cumplida; en el contexto de D-05 (prohibición del ZIM enciclopédico) sí. Decisión aparte |
| 4 | `core` embarca `libicu72` y `libstdc++6` por `ffmpeg`→`libxml2`, no por la cadena ZIM | Cumple S2 bajo el criterio `ldd`. Exigir «ni un paquete con nombre ZIM» también se cumple; exigir «ni siquiera libicu» obliga a sacar `ffmpeg`, que es otra decisión |
| 5 | `Dockerfile.local` figura en T1 y en `tareas/D05.md` pero nunca existió en el repositorio | Registrado acá: no hay nada que actualizar. Si D-05f necesita un override local, se crea entonces |

**Control negativo durable:** `tests/docker/autoprueba-verificar-perfiles.sh` (propuesto por el
verificador, incorporado). Deja en el repositorio la garantía de que la sonda **puede fallar**, en lugar
de depender de que alguien la repita a mano. Corre en 1 s sobre cualquier imagen ya construida.

**Estado de la entrega:** sonda de perfiles 15/15 y autoprueba OK después de la corrección; ambos
perfiles sanos sobre volumen nuevo con secretos efímeros; contraseña vacía o ausente falla con exit 101
nombrando la variable.

**Hallazgo para unidad posterior, no implementado (S11):** con `full` sin contenido, el mensaje de
arranque de `src/zim_proxy.rs` («El paquete incluido vive en la imagen») pasó a ser falso, porque la
imagen ya no incluye el paquete. Es texto de `src/` y va como hallazgo, no como parte de D-05a.

**L3 — D-05c: el CI de Docker, recuperado (27/11):**

El job `docker` estaba **rojo en `main` desde `dc38c9e`**, antes de D-05a, y nadie lo veía: su
condición era `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` (`ci.yml:81` al
integrar #15), así que en los PR salía **omitido** y el check aparecía verde. Al integrar, el job sí
corrió y falló en `main` dos veces seguidas.

Causa, reproducida con el comando exacto del workflow: `JWT_SECRET=test-secreto-para-ci` tiene 20
caracteres y D-02 exige 32 como mínimo. El contenedor arranca, la validación lo mata con exit 1,
`sleep 10` espera un proceso ya muerto y `curl -sf` devuelve 7 sin mostrar la razón. Faltaba además
`ADMIN_INITIAL_PASSWORD`, que una base nueva necesita para inicializar el administrador.

Lo que el job mide ahora, reutilizando las sondas de D-05a en vez de duplicar lógica:

| Comprobación | Dónde |
|---|---|
| Construcción explícita `--target core` y `--target full` | `ci.yml` |
| Aislamiento de BuildKit en las dos direcciones, desde `--progress=plain` | `verificar-aislamiento-buildkit.sh` |
| Ausencia de `.zim`, clausura `ldd` por perfil, sanidad sobre volumen nuevo, contraste 503/200, contraseña vacía | `verificar-perfiles.sh` (D-05a, reutilizada) |
| Espera acotada de `/health` con el log adjunto, puerto publicado con `-P` | `esperar-salud.sh` |
| Tres configuraciones inválidas, exigiendo exit ≠ 0 y la variable nombrada con su motivo | `verificar-configuracion.sh` |
| Que las sondas puedan fallar | `autoprueba-d05c.sh` (18 comprobaciones, sin demonio) |
| Limpieza por etiqueta de corrida en `if: always()` | `ci.yml` |

Ninguna validación del producto se relajó: el producto sigue rechazando la configuración mala y es CI
la que ahora manda configuración buena (secreto de 64 caracteres y contraseña efímeros, volumen nuevo
por corrida).

**Limitación declarada:** el aislamiento de BuildKit **no se puede probar en este host** (sin `buildx`,
y el constructor clásico rechaza `--progress` y compila las etapas de `full` aun con `--target core`).
La comprobación devuelve 2 —«no verificable»— ante un log que no es de BuildKit, en lugar de aprobar
en falso; en `ubuntu-latest` sí aplica. Es un punto de mantenimiento si BuildKit cambia el formato de
las cabeceras de etapa.
