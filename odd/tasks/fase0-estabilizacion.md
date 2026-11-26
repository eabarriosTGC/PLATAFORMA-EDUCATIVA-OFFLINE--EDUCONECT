# Fase 0 — Estabilización EDUConect (Persona C — backend, estabilización e integración)

Feature ODD. Alcance: los siete bloqueantes de instalación y despliegue que impiden presentar la plataforma como operativa en el hardware objetivo.

Documento de referencia: `docs/propuesta-windpeshi-innova.md` (Fase 0), `docs/contratos-integracion.md`.

## Specs

- **S1** — «Fase 0: estabilizar EDUConect y conseguir que funcione en una instalación limpia, fuera de Docker.»
- **S2** — «Desarrollador 3 / coordinación — Backend, estabilización e integración. Responsable de los bloqueantes de la instalación, API, modelo de datos, seguridad, registro de inquietudes y coordinación de las integraciones.»
- **S3** — «Sprint 1 — Desarrollador 3: corregir configuración inicial, variables de entorno, secretos y problemas de instalación.»
- **S4** — «Sprint 2 — Desarrollador 3: resolver rutas estáticas, módulos, archivos de cursos, instalador y configuración de systemd.»
- **S5** — «no desarrollar tres partes aisladas que después tengamos que intentar unir; desarrollar módulos independientes desde el inicio, pero con contratos de integración definidos entre todos.»
- **S6** — «no terminar con dos sistemas de autenticación, dos bases de datos y datos duplicados.»
- **S7** — «El nodo local debe continuar funcionando con SQLite.» / «No implementar una sincronización que simplemente copie tablas completas entre SQLite y Firestore.»
- **S8** — «Firebase no debe convertirse automáticamente en el backend de toda la aplicación.»
- **S9** — «Cada sprint debe terminar con algo que los demás puedan probar.»
- **S10** — Definition of Done: «El código está integrado en la rama correspondiente. Las pruebas pasan. No rompe funcionalidades existentes. Tiene manejo de errores. Funciona en el escenario offline cuando corresponde. Está documentada. Otro integrante ha revisado el resultado.»
- **S11** — «la raspberry es una alternativa, pero lo mas probable es que sea en un pc normal, tambien debemos pensar que pueda ser utilizada en colegios, osea en pc de colegios o computadores de profesores»
- **S12** — «debemos definir exactamente qué responsabilidad tendrá para no terminar con dos sistemas de autenticación, dos bases de datos y datos duplicados.»

## Tasks

| ID | Tarea | Specs | Ruta | Commit |
|---|---|---|---|---|
| T1 | Contratos de integración acordados (identidad, datos, API) | S5, S6 | `docs/contratos-integracion.md` | — |
| T2 | Provisionar `JWT_SECRET` y `ADMIN_INITIAL_PASSWORD` en instalador, compose y CI sin relajar las validaciones existentes | S3, S10 | `edu-conect-rural-server/install.sh`, `docker-compose*.yml`, `.github/workflows/ci.yml` | — |
| T3 | Layout portable: raíz de aplicación derivada del ejecutable (no del CWD) y lanzadores por plataforma — systemd en Linux, `.bat`/`.ps1` en Windows. Un solo template, defaults bajo la raíz | S3, S4, S11 | `install.sh`, `deploy/educonect.service`, `deploy/windows/`, `src/config.rs` | — |
| T4 | Servir `modulos/`, `static/`, `dashboard/` y `data/` desde la raíz de aplicación explícita | S4, S11 | `edu-conect-rural-server/src/main.rs`, `config.rs` | — |
| T5 | Implementar la ruta de descarga de archivos de curso | S4 | `src/main.rs`, `static/js/curso-viewer.js` | — |
| T6 | Re-sembrar el catálogo con identificadores reales | S4 | `edu-conect-rural-server/seeds/002_modulos.sql` | — |
| T7 | Matriz de funciones por plataforma: qué se degrada fuera de Linux (`libzim`, `espeak-ng`, `ffmpeg`, `yt-dlp`) | S11 | `docs/` | — |
| T8 | Arranque reproducible en al menos dos entornos (Linux y Windows), con evidencia registrada | S1, S9, S11 | — | — |
| T9 | Traer al repo la receta de compilación cruzada de Windows: `Dockerfile.win`, servicio `win` del compose y verificación de que compila desde cero en un directorio limpio. Hoy vive en `~/educonect-dev-env`, fuera de git, y por eso nadie más puede reproducirla | S1, S9, S10, S11 | `docker/windows/` | 9c08fcb |
| T10 | Una sola identidad de fila en el diccionario: migración versionada que deduplica conservando el `id` mínimo por `(palabra, tipo, categoria)` y **después** crea el índice único, con `rebuild` de FTS5; y corrección de `docs/sprint2/decisiones-arquitectura.md`, que hoy afirma que el arranque «continúa si las semillas no son críticas» cuando `db.rs` es todo o nada (L6) | S6, S10 | `edu-conect-rural-server/seeds/`, `edu-conect-rural-server/tests/`, `docs/sprint2/decisiones-arquitectura.md` | b35f253 |

## Log

**L1 — Solicitud original del usuario (verbatim, fragmento de rol):**

> «nosotros vamos a tener el papel del desarrollador 3»

En el mismo mensaje el usuario fija el reparto: Desarrollador 1 = Firebase e integración central; Desarrollador 2 = flujo profesor–alumno; Desarrollador 3 = «Backend, estabilización e integración». Sprints de dos semanas. Fase 0 = sprints 1 y 2. Fase 1 = sprints 3 a 7.

**L2 — Hallazgos de lectura del código que condicionan las tareas:**

1. `ADMIN_INITIAL_PASSWORD` no está «sin definir»: está **deliberadamente validada** y tiene una prueba que exige el rechazo del arranque sin ella (`src/db.rs:369-395`, `:1173`). Por tanto T2 provisiona la variable; no relaja el control.
2. `install.sh:180-199` genera una unidad systemd con solo `DB_PATH`, `FRONTEND_PATH` y `LISTEN_ADDR`. Faltan los dos secretos: es la causa directa del pánico en instalación limpia.
3. Existen dos unidades incompatibles (`install.sh` y `deploy/educonect.service`), con layouts distintos. T3 elige una.
4. `DB_PATH` no la lee el servidor (`docs/diagnostico-2026-11-25.md`). Toda unidad que la exporte la está declarando en vano.
5. `docker-compose.yml` pasa `ADMIN_INITIAL_PASSWORD` vacío y el humo de CI solo define `JWT_SECRET`: ambos fallan en volumen nuevo.
6. El progreso se identifica con texto libre (`models.rs:25-31`): sin identificador estable, la sincronización de la fase 1 no es construible. Es insumo del contrato de identidad, no de esta feature.

**L3 — Decisión de secuencia:** T1 se ejecuta antes que cualquier T2–T8, porque los contratos condicionan lo que el Desarrollador 1 y el Desarrollador 2 escriben en paralelo. T2 y T3 no dependen de T1 y pueden avanzar en paralelo.

**L4 — Cambio de requisito de plataforma (verbatim del usuario):**

> «la raspberry es una alternativa, pero lo mas probable es que sea en un pc normal, tambien debemos pensar que pueda ser utilizada en colegios, osea en pc de colegios o computadores de profesores»

Consecuencias registradas:

1. **El objetivo de despliegue deja de ser un dispositivo y pasa a ser una familia heterogénea**: PC de escritorio Linux, PC/portátil de colegio presumiblemente Windows, y Raspberry Pi como alternativa.
2. **La instalación basada en `install.sh` + systemd deja de ser la vía principal.** En un PC de colegio con Windows no existe systemd. Se requiere un paquete portable y un lanzador por plataforma.
3. **La raíz de aplicación no puede depender del CWD.** En un acceso directo de Windows o en un servicio de Linux, el directorio de trabajo es distinto del directorio del ejecutable. Es la causa del 404 de `modulos/` y `static/`, ahora con un argumento adicional: debe derivarse de la ubicación del ejecutable.
4. **Las dependencias nativas pasan a ser un problema de plataforma, no de empaquetado.** `libzim`, `espeak-ng` y `ffmpeg` se invocan o enlazan en Linux; en Windows no existen por defecto. T7 debe declarar qué se degrada y cómo.
5. **El hotspot de `install.sh` no aplica en un colegio**, donde ya hay red. En una PC de docente el acceso puede ser local (misma máquina) o por la red del colegio. El modo de acceso debe declararse por entorno.
6. **Firewall de Windows** bloquea conexiones entrantes al puerto 8080: es un paso documentado, no un supuesto.

**L5 — Plan de 8 sprints semanales y renombrado de roles (verbatim del usuario):**

> «Con tres desarrolladores y sprints de una semana, organizaría el proyecto en 8 sprints iniciales, con una revisión técnica al final de cada semana.»

> «No comiencen los tres a desarrollar funcionalidades nuevas el mismo lunes. Dediquen el primer sprint a auditar, definir contratos y tomar decisiones.»

Los roles pasan a denominarse **Persona A** (servicios centrales), **Persona B** (profesor–alumno) y **Persona C** (backend, estabilización e integración). Esta feature cubre los sprints 1 y 2; los sprints 3 a 8 abren su propia feature cuando comiencen.

**Cierre del Sprint 1:** cumplido en `docs/sprint1-informe-p0-dev3.md`. Tres de los siete bloqueantes (**B1**, **B2**, **B6**) quedaron confirmados en ejecución real con el binario compilado, no solo por lectura. Los otros cuatro requieren un entorno ausente en la máquina de trabajo (sin `cargo`, sin `libzim.so.8`, sin systemd, sin Windows) y así se declaran.

Hallazgos nuevos del Sprint 1 que no estaban en el diagnóstico previo:

1. `ADMIN_INITIAL_PASSWORD` exige **mínimo 12 caracteres** (`src/db.rs`), no 8.
2. Un arranque fallido por B2 **deja migraciones y semillas aplicadas**: el reintento parte de un estado distinto. Debe documentarse antes de entregar el instalador.
3. El curso declara `archivo_path` bajo `/contenido/*.pdf` y el visor pide `/api/cursos/{id}/archivo`: **son dos rutas distintas y ninguna existe**.
4. El contenedor sirve **61 módulos** exactos: el árbol de contenido está completo en la imagen y el problema es solo de resolución de rutas.

**L6 — Decisiones del humano para D-04 (26/11), tomadas sobre `docs/sprint2/d04-inventario.md`:**

El inventario previo encontró un defecto no registrado: `diccionario` no tiene restricción única,
así que cada arranque agrega ~21.800 filas (`biblioteca` sí se corrigió en `seeds/007`).

1. **Identidad de fila del diccionario**: `UNIQUE(palabra, tipo, categoria)`. `palabra` sola es
   incorrecta: `leer` aparece como verbo general y como verbo de la lista de verbos, y ambas filas
   son legítimas (verbatim de la respuesta del humano: «(palabra, tipo, categoria)»).
2. **Política de fallo de semillas**: «Todo o nada (código actual)» — se mantiene `db.rs` y se
   corrige `docs/sprint2/decisiones-arquitectura.md`, que hoy afirma que el arranque «continúa si
   no son críticas».
3. **Filas ya duplicadas**: «Deduplicar al arrancar, como hizo biblioteca» — borrado de datos
   autorizado explícitamente, con el precedente de `seeds/007_biblioteca_unicos.sql:10-13`,
   conservando el `id` mínimo por grupo, dentro de una migración versionada.

Consecuencia aceptada: en SQLite el índice único no puede crearse mientras existan duplicados, de
modo que la migración deduplica **primero** e indexa **después**.

**L7 — T9 nace de un hallazgo de D-WIN (verbatim del humano):**

> «traerlo al repo es el trabajo, y probablemente sea un work unit propio (`chore(win):` con el
> Dockerfile, el compose y la verificación de que compila desde cero en un directorio limpio).
> No lo mezcles con D-03.»

Origen del hallazgo: la sonda durable `tests/win-cross-build.sh` compila y verifica el `.exe`, pero
la receta que usa —`Dockerfile.win` y el servicio `win` del compose— vive en `~/educonect-dev-env`,
**fuera del repositorio**: `git log --all -- Dockerfile.win` no devuelve ningún commit. T8 exige que
el artefacto sea reconstruible por cualquiera; una dependencia invisible en el HOME de una máquina
rompe eso en cuanto ese entorno desaparece.

Regla de secuencia registrada por el mismo mensaje, tras el error de merge de D-02:

> «se mergea desde la hoja hacia la raíz, y no se mergea un PR cuyo target todavía tiene PRs abiertos
> encima.»

**L8 — Cierre del stack apilado (26/11, reanudación):** los cuatro PRs abiertos quedaron mergeados en
`main` en orden de hoja a raíz, cada uno verde en `test (default)` y `test (con-zim)`: #10
(`docs/canal-coordinacion`), #11 (`feature/d03-app-root`), #12 (`docs/t7-matriz-plataforma`), #13
(`chore/win-recipe`). `main` quedó en `4111df0` sin PRs abiertos. Con eso T3, T4, T7 y T9 tienen
commit en la tabla de tareas (D-03 en `5dc9087`, T7 en `82bfd27`, T9 en `9c08fcb`).

**L9 — T10 cerrada y verificada por separado (26/11):**

Slice de la unidad, en tres commits: `c3bd5d1` (rastro ODD: T9 con commit, T10 definida, decisiones
L6), `b35f253` (comportamiento: migración `008`, registro en `db.rs`, tres pruebas, corrección del
documento de arquitectura) y `d50b7a3` (inventario de D-04 y esta evidencia). 659 líneas autoradas:
390 son la suite, que no se puede recortar sin perder el arranque real. La forma de entrega es un
solo PR, con el commit de comportamiento en medio para que la revisión vea primero la migración.

Verificación independiente (`gentle-ai-verify`), sobre una copia scratch y con el binario real:

- Defecto reproducido contra el código previo: `21826 → 43652 → 65478` filas en tres arranques
  (+21.826 exactos por arranque). Con la migración: `21823 → 21823 → 21823`, índice presente, cero
  grupos duplicados. La diferencia de tres filas son tres identidades repetidas dentro del propio
  texto de `006` (`a'yatawaa`, `atüjaa`, `mochila`).
- Base heredada de 65.478 filas: repara a 21.823 conservando exactamente los `MIN(id)`, sin
  reinserciones (`diff` vacío), `integrity-check` pasa y la búsqueda deja de repetir (`leer` 9→3,
  `sol` 10→5).
- Atomicidad: una sentencia inválida inyectada después del borrado aborta el arranque y deja la base
  byte-idéntica. El `DELETE` no encuentra la trampa `NOT IN`/NULL: `palabra`, `tipo` y `categoria`
  son `NOT NULL` y `id` es `INTEGER PRIMARY KEY`.
- Coste: no es regresión, es más rápido. Fase de semillas 3.640 ms → 3.379 ms (default) porque `006`
  deja de insertar 21.826 filas por arranque; reparar una base ya inflada cuesta +538 ms una sola vez.
- Hallazgo que corrige una creencia: con FTS5 de contenido externo, el conteo total, el `LEFT JOIN`
  de huérfanas y el propio `integrity-check` **no** detectan entradas obsoletas; solo una consulta
  `MATCH` las ve. La sonda de FTS se sostiene en esa aserción, y el worker la validó por mutación
  (quitando el disparador `AFTER DELETE` y el rebuild) hasta verla fallar con 500 marcas vivas.

Pendientes que la verificación dejó fuera de alcance y no se tocan acá: `decisiones-arquitectura.md`
sigue afirmando que `seeds/002_admin.sql` «está vacío y se ejecuta» (mide 225 bytes y `db.rs` no lo
ejecuta), y `docs/sprint2-baseline-runtime.md` ni `README.md` listan `008_diccionario_unicos.sql`.
Ambas son ediciones de documentación, no reglas de T10.
