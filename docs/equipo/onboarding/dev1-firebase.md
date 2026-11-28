# Paquete de incorporación — DEV1

**Área:** Firebase, identidad, autenticación offline, persistencia.
**Unidad inicial:** **F-01 — identidad, autenticación offline y frontera Firebase.**
**Documento autocontenido.** No hace falta leer `.git/coordinacion/` para empezar. Si algo de esta
página y el código discrepan, **manda el código** y hay que corregir esta página.

**Referencias:** todas las rutas son relativas a la raíz del repositorio. Los `archivo:línea`
corresponden a la línea base `educonect-baseline-v1` (`2858404`).

---

## 0. Qué NO podés hacer todavía

| Prohibición | Por qué |
|---|---|
| **No implementar esquemas definitivos** sin acuerdo conjunto | `E1–E12` de [`../contratos/modelo-educativo.md`](../contratos/modelo-educativo.md) es base de discusión, no esquema congelado |
| **No integrar contribuciones al producto** antes de aclarar el régimen de licencia | No hay `LICENSE` ni titularidad; sin regla de entrada conservás tus derechos y el proyecto no puede ceder nada |
| **No tocar `src/models.rs`** | Es contrato y requiere revisión de los tres (S3) |
| **No tocar las superficies reservadas por Codex** | Ver §7 |
| **No implementar sincronización** | Bloqueada; ver §5 |
| Prototipos | Permitidos, **aislados**, fuera de `main` y sin integrarse |

Sí podés: investigar, diseñar, escribir prototipos aislados y proponer contratos.

---

## 1. Arquitectura actual

**Crate:** `edu-conect-rural-server` (`edu-conect-rural-server/Cargo.toml:2`), edition 2021.
**bin:** `src/main.rs`. **lib** delgada: `src/lib.rs:3-6`, expone sólo `config, db, models, network`
para los tests de integración.

**Feature `zim`** apagada por defecto (`Cargo.toml:7-14`). `zim-sys` exige `libzim-dev`, `libxapian` y
`libicu` **en tiempo de compilación**.

**Módulos** (declarados en `src/main.rs:1-9`):

| Módulo | Responsabilidad |
|---|---|
| `src/config.rs` | Lectura y validación de entorno; `APP_ROOT`/`DATA_DIR`; modo `--check` |
| `src/db.rs` | Pool, migraciones, semillas y **todo** el SQL |
| `src/models.rs` | DTOs: `Curso:7`, `Progreso:25`, `ApiError:35`, `AuthClaims:58`, `AuthUser:71`, `AdminUsuario:78` |
| `src/auth.rs` | JWT: `AuthLayer`, `AuthMiddleware`, `create_token:57`, `decode_token:139`, `AuthUser:105` |
| `src/quiz.rs` | DTOs y corrección: `para_estudiante:104`, `TIPOS:5-45`, `calificar:113` |
| `src/rate_limit.rs` | Ventana deslizante en memoria: `RateLimiter::new:22` |
| `src/content.rs` | Tamaños de directorio |
| `src/network.rs` | URL de LAN y QR |
| `src/zim_proxy.rs` | Proxy ZIM, sólo con la feature |

**Secuencia de arranque** — `main()` en `src/main.rs:262`:

1. `--check` corta antes de todo (`:267`).
2. tracing (`:277`).
3. `config::cargar()` (`:285`).
4. `config::verificar()`: prevalidación de entorno, **aborta** si falla (`:296-303`).
5. `RuntimePaths::nuevo` + `ensure_dirs` (`:306-311`).
6. `Database::open(&conf.db_path, &conf.jwt_secret, admin_initial_password)` (`:326`).
7. ZIM si la feature está activa (`:333`); `detect_h264_encoder` (`:339`).
8. `AppState` con `login_limiter: RateLimiter::new(5, 60)` (`:352`).
9. `app(state)` (`:356`) → bind y apagado ordenado (`:361-372`).

**El router se construye aislado en `fn app(state)` (`src/main.rs:379`), sin I/O.** Eso es lo que hace
testeable cualquier contrato HTTP nuevo: no hay que levantar la base para probarlo.

**Quién consume el servidor:** el dashboard Next por `edu-conect-rural-dashboard/lib/api.ts:3`
(`API_BASE = NEXT_PUBLIC_API_URL || "http://localhost:8080"`) y **el panel vanilla** en
`edu-conect-rural-server/static/`. Conviven dos frontends en el mismo proceso.

---

## 2. Persistencia SQLite

**Ruta de la base:** derivada **sólo** de `DATA_DIR` →
`data_dir.join("educonect.db")` (`src/config.rs:790`). **`DB_PATH` no se lee en ningún sitio**: si la
ves exportada, está declarada en vano.

**Resolución de `DATA_DIR`** (`src/config.rs:392`, `resolver_data_dir`):

| Contexto | Ruta |
|---|---|
| Servicio Linux | `/var/lib/educonect` |
| Usuario Linux | `$XDG_DATA_HOME/educonect` o `~/.local/share/educonect` |
| Windows | `%ProgramData%\EduConect` o `%LOCALAPPDATA%\EduConect` |

Docker fija `ENV DATA_DIR=/data` (`Dockerfile:101`); systemd fija
`Environment=DATA_DIR=@DATA_DIR@` (`deploy/educonect.service:30`).

**Pool:** r2d2, `max_size(8)`, con `PRAGMA foreign_keys=ON; busy_timeout=5000; synchronous=NORMAL` por
conexión (`src/db.rs:114-121`). `journal_mode = WAL` se fija **una vez** en una conexión bootstrap
fuera de transacción (`src/db.rs:97-103`).

**Migraciones — y esto es lo que tenés que saber de entrada:**

- **No hay ledger.** No existe tabla que registre qué migración corrió ni en qué orden.
- Cada migración se `include_str!` y se **re-ejecuta en cada arranque**, dentro de su propia
  transacción: `001_init.sql` (`db.rs:125`), `002_auth.sql` (`:323`), `003_content.sql` (`:427`),
  `004_search.sql` (`:538`), `005_quizzes.sql` más un `ALTER TABLE quizzes ADD COLUMN publicado`
  condicional (`:134-152`).
- La idempotencia depende de `IF NOT EXISTS`.
- El SQLite se modifica **antes** de que puedan fallar pasos posteriores: es el hallazgo `P1-06`.
- **Ninguna unidad de esquema puede empezar sin ledger** (gate G1). Si tu diseño de identidad necesita
  una migración nueva, primero hay que resolver esto con DEV3.

**Semillas** (una transacción, `src/db.rs:156-180`): `001_cursos`, `002_modulos`,
`005_biblioteca_fts`, `006_diccionarios`, `007_biblioteca_unicos`, `008_diccionario_unicos`.
`002_admin.sql` es un **stub de comentarios**: el admin se crea y rota en Rust (`db.rs:323-380`) con
bcrypt coste 12 y rotación del `admin123` legado. La política vive en
`config::validar_politica_password` (`src/config.rs:30`, mínimo 12 caracteres).

**Tablas existentes:** `cursos`, `progreso`, `admin_usuarios`, `videos`, `archivos`,
`cursos_fts`/`videos_fts` (+6 triggers), `quizzes`, `biblioteca`+`biblioteca_fts`,
`diccionario`+`diccionario_fts`.

**No existen:** `usuarios`, `roles`, `inscripciones`, `intentos`, `nodo`.

---

## 3. Autenticación y permisos que YA existen

**Lo que hay:**

- bcrypt + **JWT HS256**, expiración 24 h, `Validation::default()` con `leeway = 60`
  (`src/auth.rs:139-170`).
- Claims **sólo** `{sub, exp, iat}` (`src/models.rs:58-65`). **Sin rol, sin nodo, sin id de usuario.**
- `AuthLayer` valida `Authorization: Bearer` e inyecta `AuthUser{usuario}` (`src/auth.rs:78-100`).
- Montado en **exactamente dos** `nest`: `/api/profesor` (`src/main.rs:471`) y `/admin` (`:507`).
- `/admin/login` es público, con rate-limit 5/min/IP (`src/main.rs:1385-1392`).

**Lo que NO hay — esto es el estado, no un pendiente menor:**

| Ausencia | Evidencia |
|---|---|
| **Ningún concepto de rol o permiso** | `admin_usuarios` tiene sólo `usuario` y `password_hash` (`migrations/002_auth.sql`); no hay columna `rol` |
| **Profesor = admin** | el panel de profesor autentica contra `/admin/login` (`static/profesor.html:590`) |
| **No existe login de estudiante** | no hay ruta ni tabla |
| **Identidad de estudiante: texto libre, no autenticado** | `POST /api/progreso` y `GET /api/progreso/{usuario}` son públicos (`src/main.rs:399-400`) |
| **Escritura sin autorización** | cualquier cliente puede escribir el progreso de cualquier nombre (`db.rs:231-260`) |

**Trampa:** `src/auth.rs:9` contiene `// TODO: integrar AuthLayer en main.rs`. **Es obsoleto**: la capa
**sí** está integrada en `main.rs:471,507`. No «arregles» algo que no está roto; si querés, borrá el
comentario en tu primera unidad.

---

## 4. Frontera Firebase — lo que está decidido y lo que no

**Estado del código:** **no hay ni una línea de Firebase, Firestore ni Identity Toolkit** en ningún
`.rs`, `.ts`, `.js`, `.toml`. Las únicas menciones son documentales. **No hay nada que reutilizar: la
ausencia es el punto de partida.**

**Lo que el contrato ya fija** (`docs/contratos-integracion.md`):

- §5 — Firestore puede poseer **sólo agregados centrales**; el nodo sigue siendo autoridad para
  estudiantes y docentes (`:244-266`). Hay una prueba de no-duplicación (`:269-273`).
- §3 — `node_id` con formato `node-<comunidad>-<n>` (`:164-170`).
- §2 — `I4`: `sub` = `user_id`; `I5`: rol verificado **en servidor** (`:52-56`). Claims extendidos
  `{sub, rol, nodo}` **invalidan todos los tokens existentes** (`:101-113`).
- §1 — «Los roles no existen en el modelo de datos».

**La decisión abierta #2 es tuya** (`docs/contratos-integracion.md:328-329`):

> «¿Firebase Authentication se adopta para administradores o se mantiene solo JWT del nodo? — **Dev 1
> propone**».

Eso es **F-01**: proponer, con evidencia, si Firebase Auth entra para administradores o si el nodo
mantiene JWT para todos. Todo lo demás depende de eso.

---

## 5. Restricciones de funcionamiento offline (las que pueden matar tu diseño)

1. **El nodo debe funcionar sin Internet.** `docs/contratos-integracion.md:261` prohíbe Firestore como
   base de datos del nodo. No es preferencia: es requisito de aula rural.
2. **No hay proveedor de identidad alcanzable.** La verificación de token tiene que ser **local**:
   secreto compartido o clave local. Cualquier llamada de red en el login o en el chequeo de sesión
   rompe el escenario.
3. **No hay garantías de reloj ni de CA.** Un token con `exp` validado contra un reloj que puede estar
   mal es una bomba; considerá `leeway` y qué pasa cuando el equipo estuvo apagado meses.
4. **El navegador puede estar offline indefinidamente.** El JWT vive en `sessionStorage`
   (`static/profesor.html:602`), que **muere al cerrar la pestaña**, y **no hay ruta de refresco**.
5. **Todo lo demás es local:** SQLite, sistema de ficheros, `ffmpeg`, `espeak-ng`, `qrcode` en SVG
   local (sin CDN, `src/main.rs:332`). `yt-dlp` sólo como descarga puntual del admin.
6. **El arranque aborta ruidosamente** si `JWT_SECRET` es inválido o conocido, si
   `ADMIN_INITIAL_PASSWORD` falta o es corta cuando hay que sembrar admin, si `APP_ROOT` no es
   absoluto o no existe, si `DATA_DIR` no es escribible, o si hay un `./data/educonect.db` legado
   huérfano.

**Consecuencia de diseño:** un modelo de identidad que asuma un IdP en línea no es «mejor con red»: es
**inutilizable**. Y `E11` (rol revalidado en BD, no confiado del JWT) existe precisamente porque el
token viaja y se puede fabricar.

**Sincronización: no.** Los invariantes §8 de `04-sincronizacion.md` no están cerrados y `P3` está
bloqueado. Si tu diseño la necesita, primero hay que cerrar esos invariantes.

---

## 6. Investigación RD-01A — Kolibri, y por qué te importa

**Qué es:** investigación de arquitectura sobre **Kolibri** (Learning Equality) y su constelación:
`Kolibri`, `Studio`, `Morango`, `Ricecooker`, `le-utils`, `sync-extras`, instaladores. Clonados
**fuera** del repositorio; no reserva archivos de EduConect. Licencias MIT salvo `kolibri-server`
GPL-2+ (**no copiar**).

**Hallazgos que condicionan tu diseño:**

- Kolibri es un monolito Django (170 migraciones, >123k LOC): **no portable**. Lo valioso son sus
  contratos e invariantes, no su código.
- La identidad de registro de Morango es un **hash de 32 hex**, **no UUIDv7**. No revoca certificados.
  Es bidireccional por defecto. Sirve como **arquitectura de referencia**, no como implementación.
- El diagnóstico, seco: «EduConect hoy no tiene identidad de estudiante ni de docente y no persiste
  intentos».
- **No implementar sincronización todavía**; cerrar primero los invariantes.

**Backlog que heredás** (`P0` y `P1` de `07-backlog-riesgos.md`):

| ID | Contenido |
|---|---|
| `RD-01A-01..06` | Congelar identidad · escritor único · lápidas · versionado · invariantes de sync · ledger/backup de D-04 |
| `RD-01A-07..12` | Tablas aditivas `usuarios`/`roles`/`colecciones`/`inscripciones` · autorización en servidor · login de estudiante y docente con `sub=user_id` y rol revalidado en BD · `intentos` persistidos · migrar `progreso.usuario`→`usuario_id` · reportes de docente |

**Riesgos ya identificados que no debés redescubrir con un incidente:** «rol sólo en JWT → escalada»;
«sin RLS en SQLite → fuga entre estudiantes»; «backup por copia de archivo con WAL → inconsistente».

---

## 7. Archivos y componentes que NO debés modificar todavía

### Reservados por Codex (`DEV4-002` y `DEV4-003`)

```
edu-conect-rural-server/static/sw.js
tests/e2e/pwa-cache-privacy.spec.js
tests/e2e/helpers/pwa-cache-fixture.js
tests/e2e/helpers/legacy-sw-v2.js
tests/e2e/playwright.pwa.config.js
scripts/auditar-catalogo.py
scripts/tests/test_auditar_catalogo.py
scripts/README-auditar-catalogo.md
```

**Estado:** DEV4-002 está **aprobada a nivel de revisión, no integrada**. Sus worktrees
(`fix/dev4-pwa-cache-privacy`, `feat/dev4-catalog-integrity-audit`) tienen trabajo sin commitear y
**no se tocan**.

### Superficies de estabilización (D-05a/b/c)

```
Dockerfile · Dockerfile.local · docker-compose.yml · docker-compose.local.yml
tests/fixtures/ · .github/workflows/ci.yml · scripts/
```

### Superficies de D-03 / Persona C

```
src/config.rs (resolución de raíz) · src/main.rs (RuntimePaths, main, router)
deploy/educonect.service · install.sh
```

### A nivel de contrato

`src/models.rs` y **cualquier migración** requieren revisión de los tres.

### Trampa concreta

**`install.sh` existe dos veces**: `./install.sh` y `edu-conect-rural-server/install.sh`. Editar el
equivocado es un error silencioso.

---

## 8. F-01 — tu primera unidad

**Objetivo:** proponer, con evidencia, la frontera entre Firebase y el nodo para identidad y
autenticación. **Es diseño, no implementación.**

**Entregable:** un documento de propuesta que responda, con `archivo:línea`:

1. ¿Firebase Authentication entra para administradores, para todos, o para nadie? Con el argumento
   offline de §5 y la decisión #2 del contrato como marco.
2. ¿Cómo se verifica un token **sin red**? Concreto: qué secreto o clave, dónde vive, cómo se rota en
   un aula sin administrador.
3. ¿Qué pasa con los tokens actuales, que se invalidan todos si se extienden los claims?
4. ¿Cómo se revalida el rol **en BD** (E11) sin una consulta por petición?
5. ¿Qué NO va a Firestore, y cómo se prueba la no-duplicación?
6. Qué necesita `G1` (ledger de migraciones) antes de que tu diseño toque el esquema.

**No escribas código de producto.** Prototipos aislados sí.

---

## 9. Mapa de símbolos para arrancar

| Necesitás | Mirá |
|---|---|
| Arranque y orden de inicialización | `src/main.rs:262-372` |
| Construcción del router | `src/main.rs:379` |
| Middleware de auth y dónde se monta | `src/auth.rs:78-100`, `src/main.rs:471,507` |
| Claims del token | `src/models.rs:58-71` |
| Apertura de base y PRAGMAs | `src/db.rs:97-121` |
| Migraciones y semillas | `src/db.rs:125-180` |
| Creación/rotación del admin | `src/db.rs:323-380` |
| Política de contraseña | `src/config.rs:30` |
| Resolución de `DATA_DIR` | `src/config.rs:392` |
| Prevalidación de entorno | `src/config.rs` (`cargar`, `verificar`, `check`) |
| UPSERT de progreso | `src/db.rs:231-266` |
| Corrección de quizzes | `src/quiz.rs:113-180` |
| Cliente del dashboard | `edu-conect-rural-dashboard/lib/api.ts:3` |
| Estado de sesión en el panel vanilla | `static/profesor.html:562,602` |

## 10. Documentos que debés leer, en este orden

1. [`../contratos/modelo-educativo.md`](../contratos/modelo-educativo.md) — S1–S5 (reglas) y E1–E12
   (base de discusión).
2. [`../agenda-decisiones-conjuntas.md`](../agenda-decisiones-conjuntas.md) — qué se decide y cuándo.
3. [`../licencias/inventario-decisiones.md`](../licencias/inventario-decisiones.md) — por qué no
   integrás nada antes de aclarar licencia.
4. `docs/contratos-integracion.md` — el contrato vigente de los tres.
5. `odd/tasks/fase1-baseline-onboarding.md` — el estado de esta fase.
