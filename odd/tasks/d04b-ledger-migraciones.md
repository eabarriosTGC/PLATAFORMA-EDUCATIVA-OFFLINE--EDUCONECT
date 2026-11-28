# D-04b — Ledger de migraciones SQLite (cierra G1)

Feature ODD. Alcance: dar al proyecto un registro verificable de qué migración y qué semilla se aplicó,
con checksums, orden garantizado, exclusión de ejecuciones concurrentes, adopción segura de bases
existentes, detección de divergencia de esquema, backup consistente con WAL y recuperación verificable.

**Estado: PROPUESTA. Sin implementar.** Este documento es el diseño y la estrategia de transición; la
implementación es una unidad posterior y requiere revisión de los tres (S3).

**Fuera de alcance, explícito:** no se crean tablas de `usuarios`, `aulas`, `colegios`, grupos,
asignaciones, `intentos` ni `resultados`. D-04b no decide el modelo educativo: sólo hace posible
migrarlo.

---

## Specs

- **S1** — «Declara una unidad independiente D-04b para cerrar G1.»
- **S2** — «Primero audita el mecanismo actual y presenta una propuesta técnica que incluya:»
  inventario, tabla de registro, versiones y checksums, diferenciación esquema/semillas, transacciones
  y atomicidad, exclusión de concurrentes, adopción de bases existentes, detección de divergencias,
  backup consistente con WAL, recuperación ante interrupciones, política ante migraciones modificadas,
  compatibilidad Core/Full y Windows/Linux. (Los doce puntos se resuelven en §2–§13.)
- **S3** — «No marques migraciones antiguas como aplicadas sin verificar el estado real del esquema.»
  (Núcleo de §8.)
- **S4** — «No introduzcas todavía tablas de usuarios, aulas, grupos o intentos.»
- **S5** — Criterios mínimos de aceptación 1–10 y «controles negativos que demuestren que las pruebas
  detectan fallos».
- **S6** — «Presenta el diseño y la estrategia de transición antes de implementar.»

---

## 1. Qué hay hoy (auditoría verificada)

**Orden real de ejecución** (`src/db.rs:94-96`), sobre una conexión bootstrap (`src/db.rs:84`):

```
PRAGMA journal_mode=WAL; foreign_keys=ON; busy_timeout=5000; synchronous=NORMAL
   (fuera de toda transacción — obligatorio para journal_mode)
   ↓
001_init.sql          → tx → commit          (src/db.rs:126-129)
   ↓
LAS SEIS SEMILLAS     → UNA sola tx → commit (src/db.rs:163-172)
   ↓
002_auth.sql          → tx → commit          (src/db.rs:327-373)
003_content.sql       → tx → commit          (src/db.rs:428-431)
004_search.sql        → tx → commit          (src/db.rs:539-542)
005_quizzes.sql       → tx (+ ALTER condicional) → commit (src/db.rs:135-150)
reindex_search        → tx → commit          (src/db.rs:549-560)
```

**Los defectos que hay que arreglar, con evidencia:**

| # | Defecto | Evidencia |
|---|---|---|
| D1 | **No existe registro de qué se aplicó.** Sin `schema_migrations`, sin `PRAGMA user_version`, sin checksum. | búsqueda exhaustiva sobre `*.rs`/`*.sql`/`*.sh`: sólo `CARGO_PKG_VERSION` |
| D2 | **Las semillas corren antes que 002–005.** Una base parcialmente migrada puede tener catálogos completos y no tener `quizzes`. | `src/db.rs:94-96` |
| D3 | **Dos «semillas» crean esquema.** `seeds/005_biblioteca_fts.sql` crea `biblioteca`, `biblioteca_fts` y 3 triggers; `seeds/006_diccionarios.sql` crea `diccionario`, 2 índices, `diccionario_fts` y 3 triggers. Y `seeds/007`/`008` crean índices `UNIQUE`. | auditoría §2 |
| D4 | **Borrado destructivo en cada arranque.** Dos `DELETE … WHERE id NOT IN (SELECT MIN(id) …)` se ejecutan en cada boot. | `seeds/007:10-13`, `seeds/008:24-27` |
| D5 | **Reconstrucción de FTS en cada arranque**, cinco veces: `INSERT INTO biblioteca_fts(…) VALUES('rebuild')` (`seeds/007:18`) más los cuatro `rebuild` de `reindex_search` (`src/db.rs:551-557`). Con ~21,8k filas de diccionario, es coste puro en cada inicio. | auditoría §10 |
| D6 | **La única sentencia no idempotente está neutralizada por código, no por SQL**: el `ALTER TABLE quizzes ADD COLUMN publicado` | `src/db.rs:146-147`, guardado por `PRAGMA table_info` en `:138-144` |
| D7 | **Nada impide dos procesos migrando la misma base.** Y el puerto se vincula **después** de abrir la base, así que la segunda instancia puede migrar y sembrar antes de morir. | `src/main.rs:324-331` (open) vs `:362` (bind) |
| D8 | **Sin detección de divergencia.** No se compara el esquema vivo contra el esperado. Un trigger editado nunca se reemplaza (`IF NOT EXISTS`), y nadie lo nota. | auditoría §6 |
| D9 | **Sin backup.** `install.sh:56-57` dice «Respaldar es copiar un solo directorio», pero con WAL activo copiar `educonect.db` sola es inconsistente: hacen falta `-wal` y `-shm`, o el servidor parado. | auditoría §7 |
| D10 | **`seeds/002_admin.sql` nunca se ejecuta.** Es un stub de comentarios sin `include_str!`. | auditoría §2 |
| D11 | **Un fallo a mitad deja un prefijo confirmado** y el siguiente arranque repite la cadena entera, incluidas 21,8k inserciónes, sin poder distinguir «reintento» de «primera vez». | auditoría §9 |

**Lo que sí está bien y no hay que romper:** cada migración ya va en su propia transacción
(`tx.execute_batch` + `commit`), todos los ficheros usan `IF NOT EXISTS`/`INSERT OR IGNORE`, y
`busy_timeout = 5000` está probado (`src/db.rs:1042-1071`).

---

## 2. Tabla de registro

```sql
CREATE TABLE IF NOT EXISTS `_migraciones` (
  id            TEXT    NOT NULL PRIMARY KEY,   -- 'esquema:001_init' | 'datos:001_cursos'
  clase         TEXT    NOT NULL CHECK (clase IN ('esquema','datos')),
  orden         INTEGER NOT NULL,               -- monotonico global, sin huecos
  nombre        TEXT    NOT NULL,
  checksum      TEXT    NOT NULL,               -- sha256 hex, 64 caracteres
  checksum_base TEXT,                           -- sólo en filas adoptadas: ver §8
  adoptada      INTEGER NOT NULL DEFAULT 0 CHECK (adoptada IN (0,1)),
  aplicada_en   TEXT    NOT NULL,               -- ISO-8601 UTC, nunca hora local
  duracion_ms   INTEGER,
  motor         TEXT    NOT NULL,               -- 'sqlite 3.x.y'
  origen        TEXT    NOT NULL DEFAULT 'normal'
                        CHECK (origen IN ('normal','adopcion','override'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_migraciones_clase_orden
  ON `_migraciones`(clase, orden);

CREATE TABLE IF NOT EXISTS `_meta` (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);
-- claves: formato_ledger, esquema_objetivo, huella_esquema, ultima_apertura
```

**Por qué `orden` es global y no por clase:** el orden real de hoy intercala clases (semillas en medio
de las migraciones). Un contador por clase no puede expresar eso, y el orden es justamente lo que hoy
no está garantizado.

**Por qué una tabla con prefijo `_`:** queda fuera del espacio de nombres del dominio educativo, y es
visible a cualquiera que abra el fichero con `sqlite3`.

---

## 3. Versiones y checksums

**El checksum se calcula sobre la cadena compilada, no sobre el fichero en disco.** Es la decisión más
importante del documento.

Los SQL entran al binario por `include_str!` (`src/db.rs:126,136,157-162,327,428,539`). El fichero en
disco puede cambiar de fin de línea por `core.autocrlf` en un checkout de Windows, y entonces un
checksum de fichero daría un falso positivo de manipulación **en cada máquina Windows**. Calcular
sha256 sobre el `&'static str` que `include_str!` produce elimina ese problema de raíz: mide
exactamente lo que se va a ejecutar.

```
checksum(unidad) = sha256(bytes(include_str!(ruta)))   // 64 hex, minúsculas
```

**`PRAGMA user_version`** se fija además al `orden` máximo de esquema tras cada arranque. No sustituye
al ledger —no guarda autores, fechas ni checksums— pero da a herramientas externas (`sqlite3`, GUI,
scripts de operador) una señal barata y estándar de «hasta dónde está migrada esta base».

---

## 4. Esquema frente a datos: la distinción operativa

La distinción útil **no** es «está en `migrations/` o en `seeds/`» — porque `seeds/005`, `006`, `007` y
`008` contienen DDL. La distinción es por garantía:

| Clase | Definición | Contrato |
|---|---|---|
| **`esquema`** | Contiene DDL: crea o altera tablas, índices, triggers o vistas | Se aplica **una sola vez**. Nunca se re-ejecuta. Su checksum es vinculante (§12) |
| **`datos`** | Sólo DML idempotente (`INSERT OR IGNORE`) | Converge a un estado. Se registra para saber si corrió y con qué checksum, pero re-ejecutarla no cambia el resultado |

**Manifiesto explícito, en código, no inferido.** Una función `unidades() -> &'static [Unidad]` con
`(id, clase, orden, ruta, dependencias)`. Inferir la clase leyendo el SQL en runtime es frágil y
sorprendente; el manifiesto es revisable en un diff.

**Reordenamiento propuesto** (corrige D2 y D3):

```
orden  clase     unidad
  10   esquema   001_init                  (cursos, progreso)
  20   esquema   002_auth                  (admin_usuarios)
  30   esquema   003_content               (videos, archivos)
  40   esquema   004_search                (FTS + 6 triggers)
  50   esquema   005_quizzes               (+ ALTER condicional)
  60   esquema   biblioteca                (desde seeds/005: tablas, FTS, triggers)
  70   esquema   diccionario               (desde seeds/006: tablas, índices, FTS, triggers)
  80   esquema   unicidad                   (desde seeds/007:15 y 008:29: los dos UNIQUE INDEX)
  ---
 110   datos     001_cursos                (5 filas)
 120   datos     002_modulos               (~40 filas)
 130   datos     biblioteca_filas          (21 filas, desde seeds/005:46,52)
 140   datos     diccionario_filas         (~21.826 filas, desde seeds/006:50+)
```

**Las semillas corren después de todo el esquema.** Es la corrección de fondo: hoy una base puede tener
catálogos y no tener `quizzes`.

**Los dos `DELETE` destructivos y los cinco `rebuild` no se ejecutan en el arranque** (corrige D4 y D5).
La deduplicación ya la garantizan los `UNIQUE INDEX` de orden 80; el `rebuild` de FTS pasa a una
operación de mantenimiento explícita, no a cada inicio.

**Compatibilidad de contenido:** el SQL de cada unidad se mueve **sin reescribirlo**. Mover y reescribir
a la vez hace imposible revisar el diff. La unicidad de orden 80 se extrae como `CREATE UNIQUE INDEX IF
NOT EXISTS` de las líneas citadas, sin tocar el resto.

**`seeds/002_admin.sql`:** se retira del árbol o se documenta como histórico. Es un stub de comentarios
que nadie ejecuta; dejarlo sugiere que hace algo.

---

## 5. Transacciones y atomicidad

**Una unidad, una transacción, con su fila de ledger dentro.**

```
BEGIN IMMEDIATE
  ejecutar el SQL de la unidad
  INSERT INTO _migraciones (…) VALUES (…)
  UPDATE _meta SET valor = … WHERE clave IN ('esquema_objetivo','huella_esquema')
COMMIT
```

Eso da la propiedad que hoy no existe: **o la unidad quedó aplicada y registrada, o no quedó ninguna de
las dos cosas**. No hay ventana en la que el esquema cambió y el registro no.

`BEGIN IMMEDIATE` y no `BEGIN` diferido: el diferido puede fallar al escalar de lectura a escritura a
mitad de la unidad, con `SQLITE_BUSY` que `busy_timeout` no siempre cubre. `IMMEDIATE` toma el bloqueo
de escritura al inicio y falla temprano o no falla.

**El `ALTER TABLE` condicional se conserva, pero deja de ser necesario.** Con ledger, la unidad 50 corre
una vez. Se mantiene el guard (`PRAGMA table_info`) porque una base adoptada puede ya tener la columna
(§8); pero ahora se comprueba **tipo, `NOT NULL` y `DEFAULT`**, no sólo la existencia del nombre — hoy
una columna `publicado TEXT` pasaría el guard y el esquema quedaría divergente en silencio.

**Lo que queda fuera de transacción, y debe quedar:** `PRAGMA journal_mode = WAL` (`src/db.rs:86`).
`journal_mode` no puede cambiar dentro de una transacción. Se ejecuta antes, y se verifica después
leyendo el valor de vuelta. Si la base no está en WAL y no se puede poner, el arranque lo reporta.

---

## 6. Exclusión de ejecuciones concurrentes

Hoy no hay nada (D7), y el orden actual lo empeora: se abre y se migra la base **antes** de vincular el
puerto, así que la segunda instancia hace daño y muere después.

**Dos mecanismos, en capas:**

1. **Bloqueo de fichero del proceso, adquirido antes de abrir la base.**
   `<DATA_DIR>/educonect.lock` con `File::try_lock()` (biblioteca estándar) o `flock`. Se mantiene
   durante toda la vida del proceso. Si no se adquiere: **mensaje claro y salida distinta de cero**,
   sin tocar la base. Funciona en Linux y en Windows (`LockFileEx` por debajo).
2. **`BEGIN IMMEDIATE` por unidad** (§5), como defensa en profundidad si alguien salta el bloqueo.

**Reordenamiento de `main()`:** adquirir el bloqueo → migrar → vincular el puerto. Alternativa
igualmente válida: vincular el puerto primero (es barato y falla rápido) y migrar después. **Cualquiera
de las dos es aceptable; lo inaceptable es el orden actual**, con la migración antes de ambas.

**Prueba:** dos procesos sobre el mismo `DATA_DIR`, arrancados a la vez. Exactamente uno migra; el otro
sale con un mensaje que dice qué pasó y qué fichero de bloqueo lo delata. El ledger no debe tener filas
duplicadas.

---

## 7. Backup consistente con SQLite WAL

**Antes de aplicar la primera unidad pendiente**, si hay alguna pendiente y la base no está vacía:

```sql
VACUUM INTO '<DATA_DIR>/backups/educonect-<AAAAMMDDTHHMMSS>-v<desde>-a-v<hasta>.db';
```

`VACUUM INTO` produce un fichero único y **consistente**, funciona con WAL activo y **no requiere parar
el servidor**. Es la forma correcta de hacer lo que `install.sh:56` sugiere mal.

**Retención:** las 3 más recientes, más la del salto más antiguo de la serie pendiente. Nunca se borra
fuera de esa política sin decisión del operador. Un backup que se borra solo no es un backup.

**Si `VACUUM INTO` falla** (disco lleno, permisos): **no se migra**. Se aborta con el error. Migrar sin
red de seguridad es exactamente lo que hoy ocurre y lo que se quiere dejar de hacer.

**Procedimiento de restauración, documentado y probado:**

```
1. parar el servidor
2. mover  educonect.db, educonect.db-wal, educonect.db-shm  a un destino de cuarentena
3. copiar el backup como educonect.db
4. arrancar
```

El paso 2 importa: dejar un `-wal` huérfano junto a un `.db` restaurado produce una base inconsistente
que SQLite no siempre detecta.

**Documentación para el operador:** «copiar un solo directorio» sólo es cierto con el servidor parado.
Con el servidor corriendo hacen falta los tres ficheros (`educonect.db`, `-wal`, `-shm`) y aun así no es
atómico. La forma correcta es `VACUUM INTO`. Esto hay que corregir en `install.sh` y `DEPLOY.md`.

---

## 8. Adopción de bases existentes — el punto que no se puede apurar

**S3 es tajante: no marcar como aplicado sin verificar.** Una base existente **no** es prueba de que sus
migraciones corrieron: puede estar a medias (D11), puede haber sido modificada a mano, o puede venir de
una versión anterior con otro contenido.

### Procedimiento

```
1. Crear _migraciones y _meta (vacías) en su propia transacción.
2. Si _migraciones está vacía Y la base ya tiene objetos → MODO ADOPCIÓN.
3. Para cada unidad en orden, VERIFICAR SU FORMA contra el esquema vivo:
     esquema: ¿existen sus tablas, índices, triggers, vistas y columnas con el tipo y las
               restricciones esperadas?   (sqlite_master + PRAGMA table_info/table_xinfo)
     datos:   ¿existe el UNIQUE que garantiza la convergencia? ¿hay filas?
              (no se exige un conteo exacto: el operador puede haber borrado cursos)
4. Resultado por unidad:
     TODO PRESENTE   → registrar con origen='adopcion', adoptada=1,
                       checksum = sha256 actual, checksum_base = NULL
     NADA PRESENTE   → queda PENDIENTE y se aplica normalmente
     PARCIAL         → ABORTAR (ver abajo)
5. Calcular la huella de esquema y fijar esquema_objetivo.
```

### Lo que la adopción **no** hace

- **No** escribe «aplicada» porque la base exista. La existencia de `cursos` no implica que `003` corrió.
- **No** inventa un checksum histórico: registra el **actual**, y lo marca con `origen='adopcion'` para
  que nadie confunda «este es el checksum con el que se aplicó» con «este es el checksum que encontré».
  `checksum_base` queda `NULL` en esa fila; en la primera verificación posterior se rellena con el
  actual y **a partir de ahí** la comparación es vinculante (§12).
- **No** repara nada en silencio. Un estado parcial es un hallazgo, no una molestia.

### Estado parcial: abortar, no adivinar

Si una unidad tiene algunos objetos y no otros:

```
ABORTA: la base no está en un estado que este binario pueda adoptar.
  unidad:      esquema:004_search (orden 40)
  presente:    cursos_fts, videos_fts
  ausente:     triggers cursos_ai, cursos_ad, cursos_au
  ruta:        <DATA_DIR>/educonect.db
  backup:      <DATA_DIR>/backups/…-pre-adopcion.db
  opciones:    (a) restaurar un backup conocido y reintentar
               (b) reparación explícita: edu-conect-rural-server --reparar-esquema
                   (crea lo que falta, registra origen='override' y el motivo)
```

La opción (b) existe porque un operador con un `-wal` huérfano va a acabar ahí; lo importante es que sea
**una decisión registrada**, no un efecto secundario del arranque.

---

## 9. Detección de divergencias de esquema

**Huella de esquema determinista:**

```
huella = sha256(
  "PRAGMA user_version=" + user_version + "\n" +
  for each row in sqlite_master
     order by (type, name)
     where name NOT LIKE '_%'            -- el propio ledger no cuenta
  → "type|name|tbl_name|normalize(sql)\n"
)
```

`normalize(sql)` colapsa espacios en blanco repetidos y recorta. Sin normalizar, un cambio de formato
del SQL produce una divergencia falsa.

**Cuándo se comprueba:** en cada arranque, después de aplicar lo pendiente. Coste: una lectura de
`sqlite_master`, despreciable.

**Si difiere:**

```
DIVERGENCIA DE ESQUEMA
  esperado: <huella_base>   (registrada el <fecha>)
  actual:   <huella_actual>
  diferencias:
    + tabla  nueva_desconocida
    - índice idx_progreso_curso
    ~ trigger cursos_au   (el cuerpo cambió)
  causas probables: (a) alguien modificó la base a mano
                    (b) un binario anterior aplicó algo y luego se hizo downgrade
                    (c) restauración de un backup de otra versión
  opciones: reconstruir desde backup · aceptar la divergencia registrándola · investigar
```

**No** se repara automáticamente. **`PRAGMA integrity_check`** no se ejecuta en cada arranque: tarda
proporcionalmente al tamaño de la base y bloquearía el inicio. Va en un comando de mantenimiento.

---

## 10. Recuperación ante interrupciones

Con §5, cada unidad es atómica y su fila de ledger se confirma con ella. Entonces:

| Interrupción | Estado en disco | Siguiente arranque |
|---|---|---|
| `kill -9` a mitad de la unidad N | unidades < N confirmadas; N revertida por SQLite | reanuda en N. Sin ambigüedad |
| Corte de corriente | ídem, **salvo** que con `synchronous=NORMAL` (`src/db.rs:89`) el último commit puede perderse | reanuda en la última unidad efectivamente confirmada. El ledger dice cuál es |
| Fallo dentro de la unidad N | N revertida entera; sin objetos parciales | reanuda en N, y el error queda registrado |
| Fallo tras confirmar N y antes de N+1 | N confirmada | reanuda en N+1 |

**La propiedad que se gana:** «¿se aplicó?» deja de ser una pregunta que se responde inspeccionando el
esquema a ojo. El ledger lo dice, y el esquema lo confirma.

**`synchronous=NORMAL` con WAL es correcto** para el perfil de uso (aula, no banco) y no se cambia. Lo
que sí se documenta es su consecuencia: ante corte de corriente se puede perder la última transacción
confirmada, y el sistema queda consistente, no corrupto. Si el operador quiere durabilidad total, hay una
variable de configuración que sube a `FULL` a cambio de latencia de escritura.

---

## 11. Política ante migraciones modificadas

Un checksum sólo sirve si se compara **siempre**, no sólo al aplicar.

**En cada arranque, para cada unidad ya registrada:**

| Situación | Acción |
|---|---|
| checksum calculado == registrado | continuar |
| difieren, y la fila **no** es adoptada | **FALLA EL ARRANQUE.** Mensaje con unidad, checksum registrado, checksum actual, fecha de aplicación, y las tres salidas |
| difieren, primera verificación de una fila adoptada | fijar `checksum_base` = actual y continuar (una única vez) |
| difieren, fila adoptada con `checksum_base` ya fijado | **FALLA EL ARRANQUE**, igual que arriba |

**Las tres salidas que el mensaje debe ofrecer:**

1. **Revertir el fichero** al contenido registrado. Es lo correcto cuando alguien editó una migración ya
   aplicada «para arreglarla».
2. **Crear una unidad nueva** que corrija hacia adelante. Es lo correcto cuando el cambio es necesario
   para bases nuevas. La unidad vieja no se toca nunca: ya corrió en bases reales.
3. **Override explícito y registrado:** `--aceptar-checksum <id>` escribe una fila de auditoría con
   `origen='override'`, el motivo obligatorio, el actor y la fecha. **Nunca silencioso**, y queda en el
   ledger para siempre.

**La razón de fallar en vez de advertir:** una migración editada después de aplicarse significa que dos
bases del mismo proyecto con el mismo `user_version` tienen esquemas distintos. Eso rompe la única
propiedad que hace útil un ledger. Un aviso en el log no se lee; un arranque que falla, sí.

---

## 12. Compatibilidad Core/Full y Windows/Linux

**Hecho verificado: hoy el camino de migración no tiene ninguna condición de compilación.** `grep 'cfg('`
sobre `src/db.rs` sólo devuelve `#[cfg(test)]`. La feature `zim` afecta rutas e inicialización, nunca
migraciones. **Eso debe seguir siendo cierto, y ahora de forma comprobable.**

**Compromisos:**

1. **Misma cadena de unidades, mismo orden, mismos checksums en Core y Full.** Una base creada por Core
   abre en Full sin migrar nada; una creada por Full abre en Core sin migrar nada.
2. **Misma cadena en Windows y Linux.** Todo el SQL es portable; nada de rutas dentro del SQL.
3. **Rutas con `Path`, nunca concatenación de strings.** `VACUUM INTO` con ruta construida por `Path`
   evita el clásico `\` interpretado como escape.
4. **Fechas siempre UTC ISO-8601.** Una base migrada en Windows con hora local y abierta en Linux no debe
   parecer del futuro.
5. **El fichero de bloqueo funciona en ambos sistemas** (`try_lock`/`LockFileEx`), y su ruta va en
   `DATA_DIR`, que ya se resuelve por plataforma (`src/config.rs:392`).
6. **Sin `PRAGMA` específicos de plataforma.** `journal_mode=WAL` funciona en ambos. Si en el futuro se
   detecta que una plataforma no puede, el arranque lo reporta y degrada explícitamente; no cambia de
   esquema en silencio.

**Prueba de compatibilidad cruzada (parte de la aceptación):** crear con Core, abrir con Full, crear con
Full, abrir con Core. Cuatro combinaciones, cero migraciones nuevas en las tres últimas.

---

## 13. Criterios mínimos de aceptación

Cada criterio con su **control negativo**: la mutación concreta que debe hacer fallar la prueba. Sin eso,
una prueba que nunca puede fallar no prueba nada.

| # | Criterio | Prueba | Control negativo |
|---|---|---|---|
| **C1** | Base nueva inicializada correctamente | arrancar con `DATA_DIR` vacío; el ledger tiene **todas** las unidades, `user_version` = orden máximo, `/health` 200 y `/api/cursos` devuelve filas | sembrar una unidad con SQL inválido → el arranque falla y el ledger **no** tiene esa fila |
| **C2** | Base antigua adoptada sin pérdida de datos | tomar una base del binario **anterior** con datos de prueba (cursos, progreso, quizzes); arrancar el nuevo; contar filas antes y después en cada tabla | quitar un trigger del esquema previo → la adopción **aborta** con estado parcial, no lo registra |
| **C3** | Reinicios repetidos sin reejecución indebida | 5 arranques sobre la misma base; contar filas del ledger (sin cambios) y medir que las unidades `esquema` **no** se re-ejecutan (instrumentar con un contador o `duracion_ms` nulo) | forzar la re-ejecución de una unidad de esquema → la prueba debe detectarla |
| **C4** | Migración fallida sin cambios parciales | inyectar una sentencia que falle en medio de una unidad; comparar `sqlite_master` antes/después: **idéntico**, y sin fila de ledger | hacer que la unidad confirme el ledger antes del SQL → la prueba debe detectar objetos parciales |
| **C5** | Interrupción durante migración y recuperación verificable | `kill -9` a mitad (unidad con `sleep` o trabajo largo) → reiniciar → el ledger continúa exactamente en la unidad interrumpida, sin duplicados ni huecos | escribir el ledger fuera de la transacción de la unidad → debe aparecer la asimetría y la prueba fallar |
| **C6** | Checksum alterado detectado | cambiar un byte de una migración ya aplicada → **el arranque falla** con el mensaje de §11 | desactivar la comparación → el arranque debe pasar y la prueba fallar |
| **C7** | Arranque concurrente sin aplicación duplicada | dos procesos sobre el mismo `DATA_DIR`, lanzados simultáneamente, 20 repeticiones; exactamente uno migra; cero filas duplicadas | quitar el bloqueo de fichero → aparecen duplicados o `SQLITE_BUSY` y la prueba falla |
| **C8** | Backup y restauración probados | migrar con datos → `VACUUM INTO` presente y consistente (`integrity_check` sobre el backup) → simular desastre → restaurar según §7 → datos íntegros | corromper el backup a propósito → la restauración debe fallar y detectarse |
| **C9** | Compatibilidad con ambos perfiles | crear con Core, abrir con Full, y al revés: cero migraciones nuevas, huella de esquema idéntica | añadir una unidad bajo `#[cfg(feature="zim")]` → la prueba de paridad debe fallar |
| **C10** | Controles negativos demostrados | los nueve anteriores verdes **con sus nueve mutaciones en rojo**, en la misma ejecución | — |

**Y tres controles adicionales que el encargo no pidió pero el defecto exige:**

| # | Criterio | Por qué |
|---|---|---|
| **C11** | Ningún borrado destructivo en el arranque | `seeds/007:10-13` y `008:24-27` borran en **cada** boot. Prueba: insertar una fila con `id` menor que el mínimo de su grupo y comprobar que **sobrevive** al reinicio tras la migración de D-04b |
| **C12** | Ningún `rebuild` de FTS en arranques sin cambios | medir el tiempo de arranque con la base ya migrada; debe bajar de forma perceptible y no ejecutar `rebuild`. Prueba: contar ejecuciones de `rebuild` y exigir 0 |
| **C13** | Estado parcial aborta con informe | construir una base a la que le falta un trigger; el arranque falla y **no** escribe filas de ledger |

**Capacidad de prueba:** todo esto se puede ejecutar en un `DATA_DIR` temporal por prueba, sin tocar la
base del operador. Cada prueba crea su propio directorio y lo borra al terminar.

---

## 14. Estrategia de transición

**El orden importa porque hay bases reales en uso.** Cinco pasos, cada uno revisable por separado.

| Paso | Qué hace | Riesgo | Reversible |
|---|---|---|---|
| **P1** | **Manifiesto de unidades** sin cambiar comportamiento: la lista `unidades()` con clase, orden y ruta, ejecutada en el orden actual. Cero cambios de esquema | Nulo | Sí, es refactor puro |
| **P2** | **Ledger + checksums + transacción por unidad.** Se crea `_migraciones`/`_meta`, se registra cada unidad al aplicarse. `IF NOT EXISTS` se mantiene como red | Bajo | Sí: borrar las dos tablas y el código vuelve al comportamiento de P1 |
| **P3** | **Bloqueo de fichero + reordenar `main()`** (bloqueo antes de migrar). Cierra D7 | Bajo | Sí |
| **P4** | **Backup `VACUUM INTO` antes de aplicar pendientes** + retención + documento de restauración. Cierra D9 | Bajo | Sí |
| **P5** | **Reordenar unidades**: esquema todo primero, datos después; sacar `DELETE` y `rebuild` del arranque. Cierra D2, D4, D5 | **Medio**: cambia el orden de ejecución en bases existentes | Sí con backup de P4 |

**P5 es el único paso con riesgo real** y por eso llega al final, cuando ya hay ledger que prueba qué
corrió, backup que permite volver y bloqueo que evita dos procesos a la vez. Hacer P5 primero sería
exactamente el error que D-04b viene a corregir.

**Sobre las bases existentes:** una base que hoy funciona tiene sus cinco migraciones y sus seis semillas
aplicadas, aunque nadie lo sepa. P2 la **adopta** verificando forma (§8): si todo está, se registra con
`origen='adopcion'`; si falta algo, **aborta**. No se marca nada por suposición.

**Migración de datos no necesaria:** el ledger es aditivo. Ninguna tabla existente cambia de forma en
P1–P4. P5 tampoco las cambia: sólo el orden de ejecución.

---

## 15. Lo que este documento no decide

- El **modelo educativo** (G0, G2, G3). D-04b no crea `usuarios`, `aulas`, `grupos` ni `intentos`.
- Si la sincronización llega. `E12` sigue cerrada.
- El valor definitivo de `synchronous`. Se documenta el actual (`NORMAL`) y se deja configurable.
- Si se mueven físicamente los ficheros de `seeds/` a `migrations/`. El manifiesto hace innecesario el
  movimiento; moverlo es una mejora de legibilidad que puede ir después.

## 16. Cierre de G1

G1 se cierra cuando C1–C13 están verdes **con sus controles negativos en rojo**, sobre los dos perfiles
y con una base antigua real adoptada. No antes: un ledger sin control negativo es un ledger que nadie
sabe si funciona.
