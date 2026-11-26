# Sprint 2 — Línea base del runtime y paquete de revisión

**Persona C / Dev 3 · Responsable de arquitectura e integración técnica**

Este documento es la respuesta a la solicitud de revisión de `src/main.rs`, `src/config.rs`, `Cargo.toml`, `install.sh`, la estructura de `public/`, `static/` y `modulos/`, y las migraciones de SQLite. Todo lo aquí escrito proviene de los archivos reales del repositorio, no de la memoria del diagnóstico anterior.

---

## 1. Línea base registrada

| Elemento | Valor |
|---|---|
| Repositorio | `https://github.com/eabarriosTGC/PLATAFORMA-EDUCATIVA-OFFLINE--EDUCONECT` |
| Rama | `fix/portable-runtime-baseline` |
| Commit | `a27adec` |
| Imagen | `educonetv2-educonect:latest` · ID `768ca06704d7` · 947 MB |
| Binario de referencia | `edu-conect-rural-server/target/release/edu-conect-rural-server` (9,8 MB, 21 ago) |
| Estado del árbol | `start.sh` modificado; `Dockerfile.local`, `docker-compose.local.yml`, `docs/diagnostico-2026-11-25.md` sin seguimiento |

**Cualquier prueba posterior debe citar este commit.** Si la línea base cambia, las comparaciones dejan de ser válidas.

---

## 2. `Cargo.toml`: el hallazgo que cambia la estrategia de portabilidad

```toml
zim = { version = "0.4.0", optional = true }   # opcional, sin feature asociada
zim-rs = "0.1.1"                               # NO opcional
```

Dos dependencias de ZIM conviviendo. La que realmente enlaza el binario es **`zim-rs`**, y no es opcional. Consecuencia empírica, observada hoy:

```
libzim.so.8        => not found            (no existe en el host)
libxapian.so.30    => not found            (dependencia de libzim)
libicui18n.so.72   => not found
libicuuc.so.72     => not found
```

Al copiar `libzim.so.8.1.1` desde la imagen, la cadena se profundiza: `libzim` requiere `xapian` e `icu 72`, que son las versiones de Debian bookworm. En cualquier otra distribución —o en Windows— no están.

### Decisión D-01 propuesta

> **Convertir ZIM en una capacidad opcional en tiempo de compilación.**

`zim-rs` pasa a `optional = true` detrás de un feature `zim`. El servidor compila y funciona sin esa capacidad; las rutas `/zim/*` y la búsqueda en Wikipedia responden con un error explícito del tipo «capacidad no incluida en esta compilación».

Justificación:

1. Es la única forma de producir un binario portable a Windows y a distribuciones no-Debian, que es el objetivo declarado de despliegue.
2. La capacidad ZIM **no es un requisito de Windpeshi**. Los anexos no piden Wikipedia offline. Es una capacidad heredada de un contexto anterior.
3. Sin esta separación, el paquete portable del colegio arrastra una cadena de bibliotecas nativas del sistema.

Riesgo: si algún contenido ya entregado depende de `/zim/*`, se degrada. Debe verificarse contra el catálogo antes de decidir. **Alternativa si se decide conservar ZIM:** distribuir un bundle con las bibliotecas empaquetadas o un contenedor obligatorio — lo que contradice el requisito de instalar en un PC de colegio.

Otras observaciones de `Cargo.toml`:

| Observación | Efecto |
|---|---|
| `tower-http` con `features = ["fs"]` únicamente | No hay `CompressionLayer`. Confirmado: `three.min.js` (589 KB) viaja sin comprimir |
| `zim 0.4.0` opcional y sin `use zim::` en `src/` | Dependencia muerta. Retirar o usar |
| `[profile.release] opt-level="z", lto=true, strip=true` | Binario pequeño. Bien para distribución; encarece la compilación |

---

## 3. `src/config.rs`: la regla que el propio código no respeta

El módulo declara en su cabecera:

> «`JWT_SECRET` se lee UNA sola vez al arrancar y se inyecta por parámetro. **Ningún otro módulo debe leer la variable.**»

Inventario real de lecturas de entorno:

| Archivo | Variable | Línea |
|---|---|---|
| `config.rs` | `JWT_SECRET` | 19 |
| `config.rs` | `PUBLIC_BASE_URL` | 54 |
| `config.rs` | `DEFAULT_ZIM_DIR` | 117 |
| `config.rs` | `DEFAULT_BIBLIOTECA_DIR` | 134 |
| **`db.rs`** | **`ADMIN_INITIAL_PASSWORD`** | **68** |
| **`main.rs`** | **`DATA_DIR`** | **277** |
| **`main.rs`** | **`FRONTEND_PATH`** | **283** |
| **`main.rs`** | **`LISTEN_ADDR`** | **285** |

Tres módulos distintos leen el entorno. La regla existe y se incumple en el mismo repositorio. Esto no es cosmético: es la razón por la que hoy **toda la validación es dispersa y ocurre tarde** — `ADMIN_INITIAL_PASSWORD` se descubre inválida en `main.rs:298`, después de migraciones y semillas.

### Decisión D-02 propuesta

> **Una sola función de validación que corre antes de tocar la base de datos, y que reporta todos los errores de configuración juntos.**

Hoy el operador corrige un error, relanza, y encuentra el siguiente. Con una validación previa:

```
$ edu-conect-rural-server --check
Configuración inválida:
  - JWT_SECRET: no definida
  - ADMIN_INITIAL_PASSWORD: no definida (mínimo 12 caracteres)
  - DATA_DIR: /var/educonect no es escribible por el usuario actual
  - FRONTEND_PATH: /opt/educonect/dashboard/out no existe
```

Un modo `--check` que **no muta nada** es, además, la prueba de aceptación más barata que puede tener el instalador: el instalador termina con `--check` verde o no termina.

---

## 4. Dónde viven realmente los recursos

Este cuadro es el núcleo de la corrección estructural. Faltaba en todos los diagnósticos anteriores.

| Recurso | Dónde está en el repo | Dónde lo busca el servidor | Dónde lo pone Docker |
|---|---|---|---|
| `modulos/` | `edu-conect-rural-dashboard/modulos/` — **59 entradas, 116 archivos** | `ServeDir::new("modulos")` — relativo al CWD (`main.rs:410`) | `COPY … /app/modulos/` (`Dockerfile:95`), con `WORKDIR /app` |
| `static/` | `edu-conect-rural-server/static/` — 26 archivos | `ServeDir::new("static")` — relativo al CWD (`main.rs:421`) | `COPY … /app/static/` (`Dockerfile:93`) |
| Frontend | `edu-conect-rural-dashboard/out/` — **no existe** (requiere `npm run build`) | `state.frontend_path`, default `../edu-conect-rural-dashboard/out/` (`main.rs:283`), fallback `main.rs:426` | `COPY … /app/frontend/` (`Dockerfile:94`) |
| Datos | `data/` — 3 subdirectorios, **0 archivos** | `DATA_DIR`, default `data` (`main.rs:277`) | Volumen `/data` (`Dockerfile:101`) |
| `public/` | `edu-conect-rural-dashboard/public/` — 4 iconos | **No se sirve directamente**: el export de Next lo copia a `out/`, que no existe | Va dentro de `/app/frontend/` |

**`edu-conect-rural-server/modulos` no existe.** No es un directorio vacío: no existe. Por eso el 404 no es un problema de permisos ni de contenido faltante, es que la ruta nunca apunta a nada fuera de Docker.

Conclusión: hay **cuatro** convenciones de ubicación distintas — repo, servidor, Docker e instalador. Ninguna coincide con otra.

### Decisión D-03 propuesta

> **Una sola raíz de aplicación, derivada de la ubicación del ejecutable, con anulación por variable de entorno.**

```
<APP_ROOT>/                     # derivada de current_exe(), no del CWD
  ├── bin/edu-conect-rural-server
  ├── static/                   # recursos del servidor
  ├── modulos/                  # catálogo educativo
  ├── dashboard/                # export de Next
  └── data/                     # base de datos, contenido, videos
```

Regla de resolución, en orden:

1. `APP_ROOT` si está definida y es un directorio existente.
2. Si no, el directorio padre del directorio del ejecutable.
3. En ningún caso el directorio de trabajo actual.

Con esto, el mismo binario funciona en `/app` (Docker), en `/opt/educonect` (instalación Linux), en `C:\EduConect` (PC de colegio) y en `/home/pi/educonect`, sin cambiar una línea de código. Docker deja de necesitar `WORKDIR /app` para que las rutas funcionen.

Efecto colateral que hay que manejar: `modulos/` hoy vive dentro de `edu-conect-rural-dashboard/`. Debe moverse a la raíz o copiarse en el empaquetado. **Mover el directorio afecta al dashboard y a `Dockerfile:95`**, así que es un cambio coordinado, no un `mv` suelto.

---

## 5. `install.sh` frente a las otras dos convenciones

| Aspecto | `install.sh` (genera la unidad) | `deploy/educonect.service` (versionada) | `Dockerfile` |
|---|---|---|---|
| Raíz | `${INSTALL_DIR}` | `/opt/educonect` | `/app` |
| Ejecutable | `${INSTALL_DIR}/bin/` | `/opt/educonect/server/` | `/app/server` |
| Frontend | `${INSTALL_DIR}/data/frontend` | `/opt/educonect/dashboard/out` | `/app/frontend` |
| `modulos/` | **no se copia** | **no se copia** | `/app/modulos/` |
| `static/` | **no se copia** | **no se copia** | `/app/static/` |
| Usuario | `root` | `pi` | — |
| `JWT_SECRET` | **ausente** | **ausente** | variable de compose |
| `ADMIN_INITIAL_PASSWORD` | **ausente** | **ausente** | variable de compose |

Cuatro layouts, tres de ellos incompatibles entre sí, y solo uno (Docker) funcional. D-03 los unifica; la unidad systemd y el instalador pasan a derivar de la misma definición.

---

## 6. Migraciones y semillas: el arranque no es recuperable

Inventario:

| Migración | Propósito |
|---|---|
| `001_init.sql` | Esquema base |
| `002_auth.sql` | Autenticación y administradores |
| `003_content.sql` | Contenido |
| `004_search.sql` | Búsqueda de texto completo |
| `005_quizzes.sql` | Evaluaciones |

| Semilla | Observación |
|---|---|
| `001_cursos.sql` | Cursos base |
| `002_admin.sql` | **no se ejecuta**: cuatro líneas de comentario y 225 bytes, sin sentencias; `db.rs` no lo incluye |
| `002_modulos.sql` | Catálogo; los identificadores deben revisarse contra los directorios reales |
| `005_biblioteca_fts.sql` | Esquema de biblioteca vive aquí, no en `migrations/` |
| `006_diccionarios.sql` | Esquema de diccionario vive aquí, no en `migrations/` |
| `007_biblioteca_unicos.sql` | Dedupe de biblioteca + índice único, con `rebuild` de FTS |
| `008_diccionario_unicos.sql` | Dedupe de diccionario + índice único de `(palabra, tipo, categoria)`; sin él la tabla crecía ~21.800 filas por arranque |

**Defecto de contrato:** dos esquemas (`biblioteca`, `diccionario`) se crean desde `seeds/` y se ejecutan en cada arranque. Las migraciones deberían ser la única fuente del esquema. Un esquema que se crea en el arranque no es versionable ni auditable.

### Matriz de recuperación (tarea de la semana)

Comportamiento observado hoy: si el paso 4 falla, los pasos 1 a 3 **quedan escritos**.

| # | Etapa | Qué deja escrito | Si falla hoy | Comportamiento requerido |
|---|---|---|---|---|
| 1 | Creación del archivo de base de datos | Archivo `.db` | Desconocido | Verificar directorio y permisos **antes** de crear. Fallar sin dejar archivo |
| 2 | Migraciones (001–005) | Tablas y registros de versión | Desconocido | Una transacción por migración. Fallo ⇒ reversión de esa migración, versión no registrada |
| 3 | Semillas | Filas de contenido | Semillas aplicadas y confirmadas | Idempotentes: `INSERT OR IGNORE` sólo ignora si existe el índice único que lo respalde (ver `007` y `008`). Las seis corren en **una sola transacción**: un fallo revierte el lote completo y **aborta el arranque** (todo o nada, `db.rs:163-178`). No hay semillas «críticas» y «no críticas» |
| 4 | Administrador inicial | — | **Pánico con base ya migrada y sembrada** | Validar `ADMIN_INITIAL_PASSWORD` **antes** de abrir la base (D-02) |
| 5 | Inicio del servidor | — | Pánico si el puerto está ocupado | Mensaje accionable con el puerto y el proceso |

Regla derivada:

> **Ningún fallo de configuración debe poder dejar la base de datos en un estado nuevo.** Toda validación que no dependa del contenido de la base ocurre antes de abrirla.

Segunda regla:

> **Reejecutar el instalador sobre una instalación fallida debe ser seguro y explícito.** Hoy es accidentalmente seguro para las semillas (por el `ON CONFLICT` del dedupe) e inseguro para el resto. Debe ser una propiedad probada, no una coincidencia.

---

## 7. Checklist de revisión del contrato de identidad (para la propuesta de Dev 2)

No propongo el modelo: le corresponde a Dev 2. Sí fijo las condiciones que debe cumplir para que el backend pueda sostenerlo.

| # | Condición | Por qué |
|---|---|---|
| 1 | Identificador único **no derivado del nombre** | `progreso.usuario` es texto libre (`models.rs:25-31`). Dos personas con el mismo nombre en comunidades distintas son hoy el mismo registro |
| 2 | Formato compatible con SQLite y con cualquier almacén central | Si el identificador no es transportable, la sincronización reescribe identidades |
| 3 | Roles como dato, no como valor fijo en el token | Un cambio de rol no debe exigir esperar la expiración del token |
| 4 | Relación usuario–curso explícita (inscripción) | Hoy el vínculo está implícito en `progreso.usuario` × `progreso.curso_id` |
| 5 | Migración **aditiva**: `progreso.usuario` no se elimina en fase 1 | Eliminarlo exige reescribir todos los consumidores y perder trazabilidad |
| 6 | El rol se verifica en el servidor, en cada petición protegida | Un rol solo en el frontend no es un control |
| 7 | Estado del usuario (activo / inactivo / trasladado) | Sin estado, un estudiante que se traslada de comunidad conserva acceso a la anterior |
| 8 | Sin contraseñas en texto plano y sin autenticación paralela a la JWT existente | El equipo ya descartó dos sistemas de autenticación |

---

## 8. Riesgos y pruebas de aceptación por corrección

| Corrección | Riesgo | Prueba de aceptación |
|---|---|---|
| **D-01** ZIM opcional | Degradar contenido en uso | Compilar sin el feature: `/health` responde 200 y `/zim/*` devuelve error explícito de capacidad no incluida |
| **D-02** Validación previa | Duplicar la validación que ya existe y divergir | `--check` con cuatro configuraciones inválidas distintas reporta las cuatro; con configuración válida sale 0 sin escribir en disco |
| **D-03** Raíz de aplicación | Romper Docker al dejar de depender de `WORKDIR` | El mismo binario responde 200 en `/modulos/mundo-3d-701/` y `/static/js/api.js` lanzado desde tres CWD distintos, y desde un directorio sin relación con el repo |
| **D-04** Arranque recuperable | Semillas no idempotentes escritas a mano | Arranque con `ADMIN_INITIAL_PASSWORD` inválida ⇒ base **no creada**. Segundo intento con configuración válida ⇒ base correcta. Repetir dos veces seguidas ⇒ mismo estado |

Cada corrección va en su propia rama y su propio commit: son revertibles de forma independiente.

---

## 9. Lo que necesito del equipo

| # | Necesidad | Para qué |
|---|---|---|
| 1 | Toolchain de compilación o un nodo instalado | Ejecutar fuera de Docker. Hoy el binario del host no carga: faltan `libzim`, `xapian` e `icu 72` |
| 2 | Decisión sobre ZIM | D-01 no se puede implementar sin saber si el contenido ZIM está en uso |
| 3 | Propuesta de identidad de Dev 2 | Revisión contra el checklist de §7 |
| 4 | Confirmación de que `modulos/` puede moverse a la raíz | Condiciona D-03 y toca al dashboard |
| 5 | Un equipo Windows, aunque sea una máquina virtual | Sin eso, todo el camino portable sigue sin verificar |

---

## 10. Registro de evidencia

Ejecutado hoy, sin modificar el repositorio:

```bash
# 1. El binario del host no carga fuera del contenedor
target/release/edu-conect-rural-server
# => error while loading shared libraries: libzim.so.8

# 2. Con libzim copiada desde la imagen, la cadena se profundiza
ldd target/release/edu-conect-rural-server
# => libxapian.so.30 => not found
# => libicui18n.so.72 => not found
# => libicuuc.so.72   => not found

# 3. En contenedor sí carga, y el árbol de módulos es correcto
curl /api/modulos | grep -o '"id":' | wc -l   # => 61
```

Leído: `Cargo.toml`, `src/config.rs`, `src/main.rs:277-285,408-428,298`, `src/db.rs:68`, `Dockerfile`, `install.sh`, `deploy/educonect.service`, inventario de `migrations/`, `seeds/`, `static/`, `modulos/`, `public/`.

No verificado: comportamiento en Windows; carga WebGL en hardware objetivo; estado exacto de las tablas tras un fallo en cada etapa (la matriz de §6 se derivó del orden de ejecución en código y de la observación del Sprint 1, no de interrumpir el proceso en cada paso).
