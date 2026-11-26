# Decisiones de arquitectura — Sprint 2

**Dev 3 · Responsable de arquitectura e integración técnica**
Estado: D-01 a D-04 **aprobadas por la coordinación**, con los ajustes A y B de la ronda 2 incorporados (§D-03) y la regla arquitectónica R-01 registrada. `cargo build` de la línea base en curso.

## R-01 — Regla arquitectónica del proyecto

> **Los recursos distribuidos con EDUConect pertenecen a `APP_ROOT` y son inmutables durante la ejecución. Los datos generados, modificados o persistidos pertenecen a `DATA_DIR` y deben sobrevivir a actualizaciones y sustituciones del paquete de aplicación.**

Consecuencias directas:

| Consecuencia | Efecto |
|---|---|
| Actualizar la aplicación | Se reemplaza `APP_ROOT` completo. `DATA_DIR` no se toca |
| Respaldar | Un solo directorio a respaldar: `DATA_DIR`. `APP_ROOT` se reconstruye desde el paquete |
| Permisos | `APP_ROOT` puede ser de solo lectura. Ningún proceso escribe ahí |
| Instalación sin privilegios | Posible: paquete en cualquier ruta legible, datos en el perfil del usuario |
| Windows sin administrador | Posible: `%LOCALAPPDATA%` en vez de `Program Files` |
| Docker | `APP_ROOT` = imagen; `DATA_DIR` = volumen. Ya funciona así |

Cualquier propuesta futura que escriba en `APP_ROOT` en tiempo de ejecución debe rechazarse en revisión, no discutirse.

Línea base de referencia: rama `fix/portable-runtime-baseline`, commit `a27adec`, imagen `768ca06704d7`.

---

## D-01 — ZIM como capacidad opcional en compilación

### Evidencia verificada

| Comprobación | Resultado |
|---|---|
| `use zim_rs::archive::Archive` | **Sí, en uso** — `src/zim_proxy.rs:11` |
| Tamaño del módulo | **706 líneas** (`src/zim_proxy.rs`) |
| Dónde se inicializa | `src/main.rs:303` — `zim_proxy::inicializar(...)` |
| Rutas afectadas | `/zim/*`, `/api/wikipedia/search`, `/api/wikipedia/article`, `/api/wikipedia/zims` |
| Crate `zim = { version = "0.4.0", optional = true }` | **Sin uso real.** Las únicas coincidencias de `zim` en `src/` son cadenas de ruta (`default-content/zim` en `config.rs:124,250-258`) |
| Contenido `.zim` en el repositorio | **Ninguno.** `data/contenido/zim/` existe y está vacío; el contenido se descarga en construcción |

### Decisión

1. **`zim-rs` pasa a dependencia opcional** detrás de un feature `zim`, **desactivado por defecto**.
2. **Se retira `zim = { version = "0.4.0", optional = true }`**: dependencia muerta confirmada.
3. La compilación sin el feature **no incluye** `src/zim_proxy.rs` ni las rutas asociadas; estas responden con un error explícito de capacidad no incluida, no con un 404 ambiguo.

### Consecuencia que hay que declarar

Con `zim-rs` opcional, el binario predeterminado pierde la **Wikipedia offline** y la búsqueda en ZIM. No es una capacidad de Windpeshi y hoy no hay contenido `.zim` en el repositorio, pero debe quedar registrado por escrito antes de aprobar el merge. Con la dependencia fuera del binario predeterminado, desaparece la cadena `libzim → libxapian → libicu` y el binario se vuelve enlazable en Windows.

**Riesgo real:** no es un cambio de configuración, es un cambio de compilación condicional sobre 706 líneas y 4 rutas. Debe hacerse con el módulo detrás de `#[cfg(feature = "zim")]`, en un commit propio y revertible.

**Prueba de aceptación:** compilar sin el feature; `/health` responde 200; `/zim/A/Colombia` devuelve un error explícito que nombra la capacidad ausente; `/api/modulos` sigue devolviendo 61 elementos. Compilar con el feature reproduce el comportamiento actual.

**Responsable asignado por la coordinación:** Dev 1 verifica el árbol de dependencias (`cargo tree`) y documenta qué se pierde. Esa evidencia se suma a este documento.

---

## D-02 — Configuración centralizada y modo `--check`

### Decisión

Un único módulo de configuración concentra **todas** las lecturas de entorno. Hoy se incumple la regla del propio proyecto:

| Módulo | Variable | Línea |
|---|---|---|
| `main.rs` | `DATA_DIR` | 277 |
| `main.rs` | `FRONTEND_PATH` | 283 |
| `main.rs` | `LISTEN_ADDR` | 285 |
| `db.rs` | `ADMIN_INITIAL_PASSWORD` | 68 |
| `config.rs` | `JWT_SECRET`, `PUBLIC_BASE_URL`, `DEFAULT_ZIM_DIR`, `DEFAULT_BIBLIOTECA_DIR` | 19, 54, 117, 134 |

### Requisitos aceptados

1. Leer todas las variables en un solo lugar.
2. Validar todos los valores (presencia, longitud, formato, valores por defecto conocidos).
3. Comprobar rutas y permisos de escritura.
4. **Informar todos los errores juntos**, no el primero.
5. `--check` **no muta la base de datos** ni crea archivos.

### Formato de salida

```
EDUConect — Diagnóstico de instalación

[ERROR] JWT_SECRET: variable ausente.
[ERROR] ADMIN_INITIAL_PASSWORD: mínimo 12 caracteres.
[WARN]  DATA_DIR: directorio no existe.
[OK]    LISTEN_ADDR: configuración válida.

Resultado: configuración no válida.
No se realizaron modificaciones.
```

### Regla de seguridad explícita

> El diagnóstico **nunca** imprime el valor de un secreto. Reporta presencia, longitud y motivo de rechazo. Un `JWT_SECRET` válido aparece como `[OK] JWT_SECRET: configuración válida`, nunca con su contenido.

**Prueba de aceptación:** con cuatro variables inválidas a la vez, `--check` reporta las cuatro en una sola ejecución, sale con código distinto de cero y deja el directorio de datos sin modificar (verificable por hash del contenido antes y después).

**Riesgo:** duplicar validación entre `config.rs` y `db.rs` y que diverjan. Se resuelve moviendo `ADMIN_INITIAL_PASSWORD` a la configuración y dejando en `db.rs` solo el consumo del valor ya validado. La prueba existente `debe rechazar el arranque sin ADMIN_INITIAL_PASSWORD` (`db.rs:1173`) **debe seguir pasando**, adaptada al nuevo punto de validación, no eliminada.

---

## D-03 — Raíz de aplicación derivada del ejecutable

### Precisión aceptada: separar tres conceptos

| Concepto | Qué es | Dónde vive |
|---|---|---|
| **Fuente** | Organización dentro del repositorio | No se mueve. `modulos/` sigue en `edu-conect-rural-dashboard/modulos` |
| **Construcción** | Proceso que prepara los recursos | El empaquetado copia fuente → paquete |
| **Ejecución** | Ubicación final respecto al ejecutable | `<APP_ROOT>`, derivada de `current_exe()` |

### Estructura del paquete de distribución

```
educonect/
├── bin/
├── modulos/
├── static/
├── frontend/
├── contenido/
└── config/
```

### Precisión que agrego: faltan dos directorios con naturaleza distinta

La estructura anterior es toda de **recursos de solo lectura**. No incluye dónde vive la base SQLite ni los archivos que el sistema genera (videos convertidos, miniaturas, respaldos). En un PC de colegio eso importa de forma directa: si el paquete se instala bajo `C:\Program Files\`, **ese directorio no es escribible por un usuario sin privilegios**.

Propuesta:

```
<APP_ROOT>/                    # recursos: solo lectura, versionados con el paquete
├── bin/
├── modulos/
├── static/
├── frontend/
├── contenido/                 # biblioteca, videos base, zim si se compiló con la feature
└── config/

<DATA_DIR>/                    # datos: escribible, por instalación, respaldable
├── educonect.db
├── videos/
├── miniaturas/
└── respaldos/
```

Dos raíces, dos reglas:

| Variable | Origen por defecto | Requisito |
|---|---|---|
| `APP_ROOT` | Directorio **padre** del ejecutable, con la estructura plana de §D-03.A | Solo lectura. Debe existir. Sin permisos de escritura requeridos |
| `DATA_DIR` — Linux como servicio | `/var/lib/educonect` | **Escribible** |
| `DATA_DIR` — Linux como usuario | `$XDG_DATA_HOME/educonect`, por defecto `~/.local/share/educonect` | **Escribible** |
| `DATA_DIR` — Windows como servicio | `%ProgramData%\EduConect` | **Escribible** |
| `DATA_DIR` — Windows como usuario | `%LOCALAPPDATA%\EduConect` | **Escribible** |
| `DATA_DIR` — Docker | `/data`, montado como volumen persistente | **Escribible** |

`DATA_DIR` siempre se puede sobrescribir por variable de entorno. **`APP_ROOT/data` deja de existir como valor por defecto**: contradice R-01 y exige permiso de escritura junto al ejecutable, que es exactamente lo que un PC de colegio no concede.

### Ajuste A — una sola estructura de distribución, sin heurísticas

La regla «padre del ejecutable» es ambigua si el binario vive en `bin/`: el padre sería `bin/`, no la raíz del paquete.

> **Decisión: estructura plana. El ejecutable vive en la raíz de `APP_ROOT`, junto a los recursos. `APP_ROOT` = directorio que contiene el ejecutable.**

```
APP_ROOT/
├── edu-conect-rural-server      ← el ejecutable
├── modulos/
├── static/
├── frontend/
├── contenido/
└── config/
```

Sin búsquedas hacia arriba, sin heurísticas, sin listas de candidatos. Una sola estructura documentada y una sola regla.

Justificación de por qué plana y no `bin/`:

1. **Docker ya funciona así.** `Dockerfile:92` deja el binario en `/app/server` y los recursos en `/app/static`, `/app/modulos`, `/app/frontend`. El padre del ejecutable es `/app`. Con estructura plana, Docker cumple R-01 sin cambiar una línea.
2. Con `bin/` habría que fijar `APP_ROOT = abuelo del ejecutable`, que es igual de arbitrario y más fácil de romper al empaquetar.
3. Un directorio menos en la ruta de instalación es un error menos en soporte telefónico.

Si más adelante se decide `bin/`, la regla cambia a una constante explícita y se documenta; lo que no se admite es una heurística que busque recursos en varios sitios.

**Prueba de aceptación:** el mismo binario responde 200 en `/modulos/mundo-3d-701/` y `/static/js/api.js` lanzado desde `/tmp`, `/var/tmp` y `/home`, con `APP_ROOT` sin definir. Y con `<APP_ROOT>` en solo lectura y `DATA_DIR` aparte, el sistema arranca y escribe solo en `DATA_DIR`.

**Riesgo:** el fallback de frontend actual (`../edu-conect-rural-dashboard/out/`) desaparece como default; pasa a `APP_ROOT/frontend`. Requiere que el empaquetado copie el export de Next, que hoy **no existe** en el repo (`out/` no está generado).

---

## D-04 — Arranque recuperable

### Decisión: dos fases con frontera estricta

| Fase | Qué hace | Qué puede escribir |
|---|---|---|
| **Prevalidación** | Configuración completa, rutas, permisos, puerto disponible, coherencia de secretos | **Nada** |
| **Inicialización** | Migraciones, semillas, administrador inicial, apertura del servidor | Solo después de prevalidación verde |

> Si la prevalidación falla, SQLite no se toca. No se crea el archivo, no se aplican migraciones, no se siembra.

### Matriz de comportamiento por etapa

| # | Etapa | Si falla | Requisito |
|---|---|---|---|
| 1 | Prevalidación | Nada escrito | Reporta todos los errores (D-02) |
| 2 | Creación del archivo | Sin archivo | Verifica directorio y permisos antes de crear |
| 3 | Migraciones 001–005 | Reversión de la migración en curso | Una transacción por migración; versión registrada solo si aplica completa |
| 4 | Semillas | Arranque continúa si no son críticas | Idempotentes y reejecutables |
| 5 | Administrador inicial | Sin cambios | La contraseña ya fue validada en la fase 1 |
| 6 | Apertura del servidor | Proceso termina | Mensaje con puerto y causa |

### Defecto adicional aceptado: los esquemas en `seeds/`

Dos esquemas se crean desde semillas que se ejecutan **en cada arranque**:

- `seeds/005_biblioteca_fts.sql` — tablas de `biblioteca` y su índice de texto completo.
- `seeds/006_diccionarios.sql` — tablas de `diccionario`.

Ambos deben pasar a `migrations/` como migraciones versionadas. Un esquema que nace en el arranque no es auditable ni versionable, y hoy viola el contrato que el propio proyecto declara.

Además: `seeds/002_admin.sql` está **vacío** y se ejecuta; debe retirarse o poblarse tras verificar si algo depende de su presencia.

### Separación de migraciones y semillas

| | `migrations/` | `seeds/` |
|---|---|---|
| Qué hace | Crea o modifica **estructuras** | Inserta **datos** iniciales |
| Versionado | Sí, con registro de ejecución | No |
| Reejecución | Una sola vez por versión | Idempotente, en cada arranque si hace falta |
| Sobre datos de usuario | No los toca | **No debe sobrescribir datos que el usuario modificó** |

Estado final propuesto:

```
migrations/
├── 001_initial_schema.sql
├── 002_admin.sql
├── 003_library_schema.sql        ← sale de seeds/005_biblioteca_fts.sql
└── 004_dictionary_schema.sql     ← sale de seeds/006_diccionarios.sql

seeds/
├── library_data.sql
└── dictionary_data.sql
```

Los archivos actuales se numeran `001_init`, `002_auth`, `003_content`, `004_search`, `005_quizzes`. La renumeración de la propuesta anterior es ilustrativa: **no se renumeran migraciones ya aplicadas**, porque el registro de versión las identifica y renumerar rompe instalaciones existentes. Las dos nuevas se agregan al final con el número siguiente.

### Lo que no se puede envolver en una transacción

No toda la inicialización es transaccional. Hay que clasificarla antes de escribir código:

| Operación | ¿Transaccional? | Observación |
|---|---|---|
| `CREATE TABLE` / `CREATE INDEX` | Sí, en SQLite | DDL es transaccional. Seguro |
| `CREATE VIRTUAL TABLE` (FTS5) | Sí | Pero conviene probarlo: depende de la compilación de SQLite |
| `ALTER TABLE` | Sí | Con las mismas reservas |
| `INSERT` de semillas | Sí | Idempotencia vía `ON CONFLICT DO NOTHING` |
| Creación del archivo `.db` | **No** | Efecto del sistema de archivos. Si falla, no hay rollback que deshacer |
| Descarga de contenido (ZIM, biblioteca, videos) | **No** | Efecto de red y disco externo. Debe ser un paso separado y reintentable |
| Invocación de `ffmpeg` / `yt-dlp` | **No** | Procesos externos. Nunca dentro de una transacción abierta |
| Generación de miniaturas | **No** | Ídem |

Regla derivada: **ningún proceso externo se ejecuta con una transacción de SQLite abierta.** Hoy `main.rs` hace `shell-out` a `ffmpeg` al arrancar (`main.rs:145-151`); debe quedar fuera del ciclo de inicialización transaccional.

**Prueba de aceptación:**
1. `ADMIN_INITIAL_PASSWORD` inválida ⇒ la base **no existe** después del intento.
2. Segundo intento con configuración válida ⇒ base correcta.
3. Tercer intento inmediato ⇒ mismo estado que el segundo (idempotencia).
4. Interrumpir durante la migración 003 ⇒ el arranque siguiente retoma desde 002 sin duplicar datos.

---

## 5. Evidencia pendiente de esta ronda

Evidencia completa del entorno en `docs/sprint2/entorno-compilacion.md`. Logs en `docs/sprint2/`.

| Evidencia | Estado |
|---|---|
| Imagen de desarrollo construida | **OK** — `educonect-dev-env-dev:latest`, ID `249d08fffca7` |
| `rustc` / `cargo` | **`rustc 1.88.0 (6b00bc388 2025-06-23)` · `cargo 1.88.0 (873a06493 2025-05-10)`** |
| Arquitectura y bibliotecas del entorno | `amd64` · clang 14.0.6 · libzim **8.1.1** · sqlite3 **3.40.1** |
| `cargo metadata --locked` | **OK** — `METADATA_OK`, sin errores de resolución |
| `cargo build --locked` sobre la línea base | **OK** — `Finished dev profile in 35.22s`, exit 0 |
| `ldd` del binario compilado | **OK** — 15 entradas, ninguna faltante. Cinco atribuibles a ZIM con certeza (`libzim`, `libxapian`, 3×`libicu`), cuatro más son dependencias de `libzim` |
| `cargo tree` de `zim-rs` y transitivas | **OK** — adelantado. `zim-rs` es dependencia directa única; `zim-sys/build.rs:28` ejecuta `pkg_config::probe_library("libzim").unwrap()` en compilación; el crate `zim v0.4` no aparece en el árbol |
| Prueba de los tres CWD | **No ejecutable todavía**: requiere D-03 implementada y un paquete generado |
| Comparación `ldd` con y sin feature `zim` | Pendiente: requiere D-01 implementada |
| Prueba de actualización con migración nueva | Pendiente: requiere D-04 implementada |

Ninguna decisión de este documento se considera implementada. Están aprobadas; su cierre exige la evidencia de §4 y §5.

---

## 6. Orden de implementación acordado

1. Entorno de compilación reproducible ← **en curso**
2. D-01 (dependencias nativas, binario sin ZIM)
3. D-03 (raíz de aplicación y rutas de recursos)
4. D-02 (configuración centralizada y `--check`)
5. D-04 (ciclo de inicialización, migraciones y semillas)
6. Integración de identidad (revisión del contrato de Dev 2)

Cada paso en su rama y su commit, con su prueba de aceptación. Sin excepción.
