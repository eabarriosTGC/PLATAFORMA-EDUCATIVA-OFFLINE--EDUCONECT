# D-04 — Inventario previo: arranque recuperable y esquemas fuera de `seeds/`

Auditoría de solo lectura hecha **antes** de implementar D-04, para que la unidad no gaste
descubrimiento. Unidad descrita en `docs/sprint2/decisiones-arquitectura.md` §D-04.

**Advertencia sobre las líneas.** El árbol estaba en movimiento cuando se levantó este inventario
(rama `feature/d03-app-root`, agente editando `src/{config,main,lib,db}.rs`). Los números de línea de
`migrations/`, `seeds/`, `tests/` y `docs/` son confiables; los de `src/*.rs` son de la copia de
trabajo y **deben re-verificarse** contra el commit base antes de apoyarse en ellos.

---

## 1. Orden de arranque hoy (de proceso a «escuchando»)

| # | Paso | Escribe |
|---|---|---|
| 0 | cortocircuito `--check`, sale antes de todo efecto | no |
| 1 | inicialización de `tracing` | no |
| 2 | `config::cargar()` — las ocho lecturas de entorno, validadas | **no** |
| 3 | hallazgos de solo aviso impresos | no |
| 4 | `RuntimePaths::nuevo` + `ensure_dirs()` — crea `data/` y compañía; `.expect` ⇒ **pánico** | directorios |
| 5 | `Database::open(...)`; `Connection::open` **crea el archivo** y los PRAGMA reescriben la cabecera | `.db`, `-wal`, `-shm` |
| 6 | ZIM (tras feature) | lee |
| 7 | `detect_h264_encoder()` — invoca `ffmpeg` | no |
| 8 | `AppState` + router | no |
| 9 | `TcpListener::bind(...).unwrap()` ⇒ **pánico si el puerto está ocupado** | no |

**Punto de no retorno:** `Connection::open` en `db.rs`. No hay ruta que deshaga el archivo.

**Siete commits independientes** dentro de `open_internal`, sobre una sola conexión de arranque:
migraciones → **semillas** → auth → contenido → búsqueda → quizzes → `reindex_search`.

Anomalía que D-04 hereda: **las semillas corren antes que las migraciones 002–005**, y es
carga estructural, no descuido. `seeds/005_biblioteca_fts.sql` y `seeds/006_diccionarios.sql`
crean sus propias tablas *y* sus tablas FTS5, y `reindex_search` reconstruye objetos que existen
**solo** porque las semillas los crearon. Sacar el esquema de `seeds/` obliga a re-establecer esa
dependencia en las migraciones, en el mismo cambio.

## 2. Migraciones

- Cinco archivos en `migrations/`, embebidos con `include_str!`: no se escanea el disco.
- **No hay seguimiento de versión**: ni tabla `schema_migrations`, ni `PRAGMA user_version`.
  La versión la implica la posición del archivo en el código. La idempotencia se delega entera
  a `IF NOT EXISTS`.
- Único precedente de «chequeo al arrancar»: quizzes consulta `PRAGMA table_info(quizzes)` y
  agrega la columna `publicado` si falta.
- Reintento tras fallo parcial: todas las migraciones vuelven a correr completas. No falla, pero
  el estado resultante es distinto del primer intento.

## 3. Semillas — qué es esquema y qué es dato

Se ejecutan cinco archivos, todos en **una sola transacción**.

| Archivo | Naturaleza |
|---|---|
| `001_cursos.sql` | dato, idempotente por PK explícita |
| `002_modulos.sql` | dato, idempotente por PK explícita |
| `002_admin.sql` | **archivo muerto**: cinco líneas de comentario, nunca referenciado |
| `005_biblioteca_fts.sql` | **esquema + dato**: tabla, tabla FTS5, tres disparadores, 21 filas |
| `006_diccionarios.sql` | **esquema + dato**: tabla, dos índices, FTS5, tres disparadores, ~21.800 filas |
| `007_biblioteca_unicos.sql` | migración disfrazada: `DELETE` destructivo + índice único + `rebuild` de FTS |

Documentos en conflicto sobre `002_admin.sql`: `decisiones-arquitectura.md` dice que se ejecuta,
`diagnostico-2026-11-25.md` dice que no. **El código dice que no.** Una de las dos afirmaciones
hay que corregirla en el mismo commit que toque este punto.

## 4. Defecto encontrado que no estaba registrado

`biblioteca` recibió un índice único en `seeds/007` precisamente para cortar la duplicación
(«21 filas × N arranques = 1050 registros»). **`diccionario` quedó afuera**: sus dos índices no son
únicos, así que `INSERT OR IGNORE` no tiene contra qué ignorar y **cada arranque agrega ~21.800
filas**, que después `reindex_search` vuelve a indexar.

Medido sobre el seed: arranque 1 = 21.800 · arranque 2 = 43.600 · arranque 3 = 65.400.

### Decisiones del 26/11 (el humano las tomó; no las re-litigues)

1. **Identidad de fila**: `UNIQUE(palabra, tipo, categoria)`. `palabra` sola sería incorrecta:
   `leer` aparece como verbo general y como verbo de la lista de verbos, y ambas filas son legítimas.
2. **Política de fallo de semillas: todo o nada** — se mantiene el código, se corrige el documento
   de decisiones, que hoy dice «continúa si no son críticas».
3. **Filas ya duplicadas: deduplicar al arrancar**, conservando el `id` mínimo por grupo, en una
   migración versionada. Es borrado de datos con autorización explícita del humano y tiene
   precedente idéntico en `seeds/007_biblioteca_unicos.sql:10-13`.

Consecuencia técnica de (3): en SQLite **crear el índice único falla si ya hay duplicados**, así
que el orden obligatorio es *deduplicar primero, indexar después*, en ese orden y en la misma
migración.

## 5. Estado parcial: quién lo causa y qué prueba lo esconde

Causa del hallazgo del Sprint 1 (un arranque fallido deja migraciones y semillas aplicadas):
el archivo se crea y las siete etapas se confirman **antes** del primer paso que puede fallar por
entorno. La variable ausente `ADMIN_INITIAL_PASSWORD` está clasificada como **aviso**, no como
error, así que la base queda creada y poblada y el fallo llega en el paso de auth.

Dos huecos, distintos:

- la variable **ausente** (aviso ⇒ base poblada);
- cualquier fallo **posterior** a las siete etapas: el caso común es el puerto ocupado.

Pruebas existentes y su punto ciego:

- `test_sin_admin_y_sin_variable_rechaza_arranque` es la reproducción de B2, pero **borra la
  evidencia que acaba de crear**: llama a `limpiar_db` y nunca verifica la ausencia del archivo.
  Es la prueba que D-04 tiene que endurecer.
- `test_reabrir_db_conserva_datos_y_seeds_idempotentes` prueba idempotencia solo para `cursos` y
  `admin_usuarios`; **no cuenta `biblioteca` ni `diccionario`**, por eso la duplicación pasa inadvertida.
- No existe ninguna prueba de «base no creada tras fallo», ni de interrupción a mitad de migración.

## 6. Pruebas que ya tocan el área — no duplicar

`journal_mode_wal_y_pragmas_por_conexion`, `reabrir_db_conserva_datos_y_seeds_idempotentes`,
`pool_ocho_conexiones_sin_lock_y_escritura_concurrente`, `sin_admin_y_sin_variable_rechaza_arranque`,
las seis de bootstrap de admin, y en `tests/arranque_sin_config.rs`:
`sin_jwt_secret_no_crea_directorios`, `con_configuracion_valida_crea_los_directorios`, más las tres
de D-03.

## 7. Lo que D-04 debe decidir, no codificar

- **Frontera con D-03.** D-03 ya trae `config::verificar` usado solo por `--check`, y su prueba
  `data_dir_no_escribible_falla_antes_de_crear_nada` cubre la misma compuerta que el paso 1 de la
  matriz de D-04. Decidir si D-04 consume `verificar()` en `main()` o solo se ocupa de la
  recuperación posterior a la apertura. Es separable, pero hay que elegirlo una vez.
- **`reindex_search`.** No es migración ni semilla, cuesta O(catálogo), depende de tablas FTS cuya
  propiedad se está moviendo, y hoy corre dos veces por arranque porque `seeds/007` ya hace un
  `rebuild`. Opciones: plegar el `rebuild` en cada migración dueña de FTS, dejarlo como paso único
  posterior, o hacerlo perezoso.
- **`seeds/002_admin.sql`.** Borrarlo (evidencia: nada lo referencia) o poblarlo con una fila de
  admin sin secreto.
- **Conteo previo a la migración de deduplicación.** Conviene medir filas totales y grupos con más
  de una definición distinta antes de borrar, y dejar el número en el reporte de la unidad.
