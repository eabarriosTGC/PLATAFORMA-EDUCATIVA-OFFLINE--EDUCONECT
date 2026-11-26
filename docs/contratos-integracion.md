# Contratos de Integración — EDUConect Windpeshi

**Documento de coordinación técnica. Rol responsable: Desarrollador 3 (backend, estabilización, integración).**

| Campo | Valor |
|---|---|
| Versión | 0.1 |
| Fecha | Noviembre de 2026 |
| Rama de referencia | `fix/portable-runtime-baseline` (commit `a27adec`) |
| Estado | Propuesta para acuerdo de los tres desarrolladores. Sin acuerdo no se implementa sincronización |
| Base | Código verificado por lectura (ver §6) + `docs/propuesta-windpeshi-innova.md` |

---

## 0. Por qué este documento existe

El riesgo declarado por el equipo es terminar con *dos sistemas de autenticación, dos bases de datos y datos duplicados*. Ese riesgo no se evita con disciplina: se evita fijando, antes de escribir código, **quién es dueño de cada registro** y **qué identificadores son válidos**.

Tres contratos, en este orden de dependencia:

1. **Identidad** — cómo se nombra cada cosa. Si esto queda mal, todo lo demás se contamina.
2. **Datos** — quién puede escribir cada registro. Es la regla que impide la duplicación.
3. **API** — cómo se hablan los módulos.

Ningún desarrollador implementa sincronización, autenticación de estudiantes ni colecciones centrales antes de que estos tres contratos estén cerrados.

---

## 1. Estado real del sistema (lo que hay que respetar)

Verificado por lectura del código, no por suposición:

| Hecho | Evidencia | Consecuencia para el contrato |
|---|---|---|
| Solo los administradores se autentican | `AuthClaims { sub, exp, iat }` en `src/models.rs:58-65`; `POST /admin/login` en `src/main.rs:378`; `AuthLayer` en `src/auth.rs:33` | **No existe identidad de profesor ni de estudiante.** Hay que crearla, no completarla |
| El progreso se identifica con un texto libre | `Progreso { usuario: String, curso_id: i64 }` en `src/models.rs:25-31`; UPSERT sobre `(usuario, curso_id)` en `src/db.rs` | El identificador actual no es estable ni único. Es el principal obstáculo para la sincronización |
| Los cursos usan identificador numérico | `Curso { id: i64 }` en `src/models.rs:7-13` | No se puede usar el `id` numérico como identificador global entre nodos |
| El error de API tiene una sola forma | `ApiError { error: String }` en `src/models.rs:35-37` | Un sobre `{success, data, error}` rompe a todos los consumidores actuales |
| Los roles no existen en el modelo de datos | No hay columna de rol ni tabla de roles; `admin_usuarios` solo cubre administración | La distinción profesor/alumno es una decisión de esquema, no de pantallas |
| `ADMIN_INITIAL_PASSWORD` es obligatoria por diseño | `src/db.rs:369-395`; prueba explícita `debe rechazar el arranque sin ADMIN_INITIAL_PASSWORD` en `src/db.rs:1173` | **No se relaja la validación. Se provisiona la variable** |
| `JWT_SECRET` es obligatoria y se valida | `src/config.rs:17-49` (`jwt_secret_requerido`) | Mismo criterio: se provisiona, no se hace opcional |
| El instalador no provisiona ninguno de los dos secretos | `install.sh:180-199` escribe la unidad systemd con solo `DB_PATH`, `FRONTEND_PATH`, `LISTEN_ADDR` | Instalación limpia = pánico al iniciar |
| Existen dos unidades systemd incompatibles | `install.sh` genera `WorkingDirectory=${INSTALL_DIR}` y `FRONTEND_PATH=${INSTALL_DIR}/data/frontend`; `deploy/educonect.service` declara `/opt/educonect` y `/opt/educonect/dashboard/out` | Dos despliegues distintos conviviendo. Hay que elegir uno |
| `DB_PATH` no la lee el servidor | Según `docs/diagnostico-2026-11-25.md`, el servidor lee `DATA_DIR` (`src/main.rs:66-77,272`) | Toda unidad que exporte `DB_PATH` está escribiendo una variable muerta |

---

## 2. Contrato 1 — Identidad

### 2.1. Reglas

| # | Regla | Motivo |
|---|---|---|
| I1 | Todo identificador de entidad es **UUIDv7 en texto** | Ordenable por tiempo, generable sin coordinación, válido como clave en SQLite y como ID de documento en Firestore |
| I2 | El `id` numérico existente **no se elimina**; se conserva como clave interna | Eliminarlo rompe `progreso.curso_id` y todo el código que ya consulta por `i64` |
| I3 | Todo `node_id` es inmutable una vez establecido | Un nodo reasignado corrompe la atribución histórica de los registros |
| I4 | El `sub` del JWT es el `user_id`, nunca el nombre de usuario | El nombre cambia; el identificador no |
| I5 | Un rol se declara en el token y se **verifica en el servidor** | Un rol solo en el frontend no es un control |

### 2.2. Modelo propuesto (aditivo, no destructivo)

```sql
-- Nuevas tablas. Ninguna modifica una tabla existente en este paso.
CREATE TABLE IF NOT EXISTS usuarios (
    id          TEXT PRIMARY KEY,          -- UUIDv7
    nombre      TEXT NOT NULL,
    rol         TEXT NOT NULL CHECK (rol IN ('admin','profesor','estudiante')),
    creado_en   TEXT NOT NULL,
    nodo_origen TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inscripciones (
    id          TEXT PRIMARY KEY,          -- UUIDv7
    usuario_id  TEXT NOT NULL REFERENCES usuarios(id),
    curso_id    INTEGER NOT NULL REFERENCES cursos(id),
    profesor_id TEXT NOT NULL REFERENCES usuarios(id),
    estado      TEXT NOT NULL DEFAULT 'activa',
    creado_en   TEXT NOT NULL,
    nodo_origen TEXT NOT NULL,
    UNIQUE (usuario_id, curso_id)
);

CREATE TABLE IF NOT EXISTS nodo (
    clave TEXT PRIMARY KEY,
    valor TEXT NOT NULL
);
```

### 2.3. Migración del identificador de progreso

`progreso.usuario` es texto libre. La transición es **aditiva y en dos pasos**:

1. Agregar `usuario_id TEXT NULL` a `progreso`. El código nuevo escribe ambos campos.
2. Completar `usuario_id` para registros existentes mediante una tabla de correspondencia explícita, revisada a mano. **No** deducir el identificador por coincidencia de nombre: dos personas pueden llamarse igual en comunidades distintas.

`progreso.usuario` no se elimina durante la fase 1. Se declara obsoleto y se elimina en fase 2, con respaldo previo.

### 2.4. Claims del JWT extendidos

```json
{
  "sub": "<user_id UUIDv7>",
  "rol": "admin | profesor | estudiante",
  "nodo": "<node_id>",
  "exp": 1764000000,
  "iat": 1763913600
}
```

**Efecto declarado:** los tokens emitidos antes de este cambio dejan de ser válidos al introducir `rol` como campo obligatorio en la verificación. Es aceptable en fase 0 (los tokens expiran y no hay usuarios en producción), pero debe ejecutarse como paso coordinado, no como efecto colateral de un commit.

---

## 3. Contrato 2 — Datos

### 3.1. Regla de escritor único

> **Cada tipo de registro tiene exactamente un escritor autorizado. Todo lo demás es lector.**

Esta regla es la que impide el escenario que el equipo quiere evitar. Si un tipo de registro admite dos escritores, la sincronización deja de ser un problema de transporte y pasa a ser un problema de resolución de conflictos sin criterio.

| Registro | Escritor único | Vive en | Dirección de sincronización |
|---|---|---|---|
| Cursos, módulos, biblioteca, contenidos | **Centro** (tras aprobación de Econova) | Centro | Centro → nodo. El nodo nunca modifica contenido oficial |
| Banco de preguntas frecuentes | **Centro** | Centro | Centro → nodo, con versión y hash |
| Comunicados y novedades | **Centro** | Centro | Centro → nodo, con versión y hash |
| Usuarios | **Nodo que los crea** | Nodo | Nodo → centro (solo alta y actualización de perfil) |
| Inscripciones | **Nodo** | Nodo | Nodo → centro |
| Progreso | **Nodo** | Nodo | Nodo → centro, solo lectura en el centro |
| Intentos de evaluación y puntuaciones | **Nodo** | Nodo | Nodo → centro, solo lectura en el centro |
| Inquietudes comunitarias | **Nodo** (contenido) / **Centro** (respuesta) | Ambos, por campos | Nodo → centro (consulta) / Centro → nodo (respuesta) |
| Indicadores y dashboard | **Ninguno: derivado** | Centro | Se recalcula desde los registros. Nunca es fuente de verdad |
| Datos personales de contacto | **Nodo** | Nodo | **No se sincroniza** salvo inquietud con seguimiento autorizado |

### 3.2. Propiedad por campos en inquietudes

Es el único registro con dos escritores, y por eso se parte por campos:

| Campo | Escritor |
|---|---|
| `id`, `node_id`, `created_at_local`, `texto`, `tema`, `comunidad`, `canal` | Nodo |
| `respuesta`, `respondido_por`, `respondido_en`, `estado` | Centro |

Un nodo que recibe una respuesta **no puede modificar el texto original ni el sello temporal**. Si lo hace, la bitácora de escucha deja de ser evidencia.

### 3.3. Separación de regímenes de datos

Los datos educativos y los datos personales de interacción comunitaria **no comparten tabla, ni endpoint, ni consulta**. No se separan por permisos sobre la misma tabla: se separan en el almacenamiento.

Consecuencia operativa: el dashboard general no puede mostrar teléfonos ni el texto de inquietudes individuales. Muestra agregados por comunidad y por tema.

### 3.4. Identificador de nodo

- Formato: `node-<comunidad>-<n>`, por ejemplo `node-majayura-1`.
- Se genera una vez, se persiste en la tabla `nodo` y se documenta en el acta de instalación.
- Un nodo reinstalado **no reutiliza** el identificador anterior: se retira y se crea uno nuevo con sufijo incrementado. La razón es que los registros del nodo anterior ya están atribuidos y no se pueden reescribir.

---

## 4. Contrato 3 — API

### 4.1. Forma de respuesta

**Decisión: no se adopta el sobre `{success, data, error}` global.**

El código actual responde errores como `{"error": "..."}` (`ApiError`, `src/models.rs:35-37`) y los consumidores existentes (dashboard Next, `static/js/*`) dependen de esa forma. Adoptar el sobre global obliga a reescribir a todos los consumidores en el mismo commit, y eso es exactamente el tipo de integración big-bang que este plan quiere evitar.

| Situación | Forma |
|---|---|
| Errores | `{"error": "<mensaje>"}` — se conserva |
| Endpoints existentes | Sin cambios de forma |
| Endpoints nuevos de sincronización | Envoltura propia documentada en §4.3, aislada del resto |
| Necesidad futura de sobre uniforme | `/api/v2` con versión explícita, no reemplazo silencioso |

### 4.2. Registro sincronizable

```json
{
  "id": "0199a3c2-7f10-7b3e-9a11-2c4f8d5e6b01",
  "tipo": "inquietud",
  "node_id": "node-majayura-1",
  "created_at_local": "2026-11-25T18:00:00-05:00",
  "secuencia_local": 42,
  "schema_version": 1,
  "payload": {}
}
```

Reglas:

| # | Regla |
|---|---|
| A1 | `id` es UUIDv7 generado **antes** de cualquier intento de envío. Un reintento reutiliza el mismo `id` |
| A2 | `created_at_local` es ISO 8601 **con desplazamiento horario**. Nunca fecha sin zona |
| A3 | `secuencia_local` es un contador monotónico del nodo. Sirve para ordenar dentro del nodo; **nunca** para ordenar entre nodos |
| A4 | `sync_status` **no viaja**: es estado interno del nodo, no un dato del dominio |
| A5 | `schema_version` viaja siempre. Un centro que recibe una versión que no conoce rechaza el registro con motivo explícito, no lo adivina |

### 4.3. Envoltura de lote

Solicitud:

```json
{
  "node_id": "node-majayura-1",
  "lote_id": "0199a3c2-aaaa-7b3e-9a11-000000000001",
  "registros": [ { "...": "registro sincronizable" } ]
}
```

Confirmación:

```json
{
  "aceptados": ["0199a3c2-7f10-7b3e-9a11-2c4f8d5e6b01"],
  "duplicados": ["0199a3c2-7f10-7b3e-9a11-000000000002"],
  "rechazados": [
    { "id": "0199a3c2-7f10-7b3e-9a11-000000000003", "motivo": "schema_version_no_soportada" }
  ]
}
```

Reglas:

| # | Regla |
|---|---|
| B1 | Un registro **duplicado es un éxito**, no un error. Se informa aparte |
| B2 | Reenviar el mismo `lote_id` produce la misma confirmación. El lote es idempotente |
| B3 | Un rechazo es definitivo para ese registro. El nodo lo marca y **no reintenta en bucle** |
| B4 | La confirmación parcial es normal: el nodo vacía solo los `aceptados` y `duplicados`, y conserva los `rechazados` para revisión |
| B5 | Sin confirmación explícita, el nodo **no borra nada** de su cola de salida |

### 4.4. Prohibiciones explícitas

| # | Prohibición | Motivo |
|---|---|---|
| C1 | No copiar tablas completas entre SQLite y Firestore | El propio plan del equipo lo prohíbe; además impide detectar duplicados |
| C2 | No sincronizar por diferencia de fecha del servidor | El reloj del nodo no es confiable y el del centro no estaba cuando se creó el registro |
| C3 | No resolver conflictos automáticamente | Un conflicto silencioso destruye evidencia de escucha comunitaria |
| C4 | No sincronizar datos de contacto sin seguimiento autorizado | Separación de regímenes (§3.3) |

---

## 5. Frontera de Firebase

Firebase puede incorporarse. No puede convertirse en el backend de la aplicación.

### 5.1. Lo que Firebase puede poseer

| Servicio | Responsabilidad admitida | Condición |
|---|---|---|
| Cloud Firestore | Registros centrales agregados: inquietudes recibidas, respuestas, indicadores materializados | El centro **nunca** escribe hechos educativos |
| Cloud Functions | Validación del lote entrante, deduplicación, materialización de indicadores | La lógica de dominio vive en el servidor Rust, no en la función |
| Firebase Authentication | Identidad central de administradores, **si se aprueba** | El nodo sigue siendo la autoridad local de estudiantes y profesores |
| Cloud Messaging | Notificación a administradores y gestores | No requiere identidad de estudiante |

### 5.2. Lo que Firebase no puede poseer

| Prohibido | Razón |
|---|---|
| La base de datos del nodo | El nodo debe operar sin Internet. Firestore no cumple ese requisito |
| El contenido educativo y los módulos | Ya existen, ya funcionan offline y no se duplican |
| La fuente de verdad del progreso y las evaluaciones | Serían dos fuentes de verdad para el mismo hecho |
| La autenticación de estudiantes y profesores en fase 1 | Duplicaría el sistema de autenticación que el equipo quiere evitar |
| La lógica de negocio del servidor Rust | Reescribiría EDUConect, que es lo que el plan prohíbe |

### 5.3. Prueba de no duplicación

Antes de conectar Firestore, el equipo debe poder responder esta pregunta por escrito:

> Si el nodo y el centro discrepan sobre el progreso de un estudiante, ¿cuál es el correcto y por qué?

Si la respuesta no es *«el del nodo, porque es el único escritor»*, el diseño tiene dos fuentes de verdad y no está listo.

---

## 6. Puertas de integración por sprint

Ningún sprint se cierra sin que otro desarrollador pueda ejecutar algo.

| Sprint | Puerta de salida | Verificación |
|---|---|---|
| 1 | Contratos firmados + entorno reproducible | Los tres pueden arrancar el servidor con un comando y sin pasos manuales |
| 2 | EDUConect arranca en el entorno objetivo y el aula funciona sin Internet | Instalación limpia registrada; módulos visibles |
| 3 | Contrato de sincronización congelado y endpoint con datos simulados | El nodo puede enviar un lote contra un centro simulado y recibir confirmación |
| 4 | Sincronización idempotente demostrable | Desconectar, crear 10 registros, reconectar, no perder ni duplicar |
| 5 | Respuestas alineadas al banco aprobado | Consulta fuera del banco devuelve límite declarado, no invención |
| 6 | Dashboard separado por regímenes | El dashboard no expone teléfonos ni texto individual sin autorización |
| 7 | Versión integrada demostrable | Guion de demostración reproducible por terceros |

---

## 7. Reglas de trabajo compartidas

Tomadas del plan del equipo, con dos agregados propios del código actual:

| Regla | Aplicación |
|---|---|
| Rama por funcionalidad | `feature/firebase-sync`, `feature/profesor-alumno`, `feature/fase0-estabilizacion` |
| No trabajar en `main` | Integración por Pull Request |
| API documentada antes de consumirse | Rutas, parámetros y respuestas en este documento |
| Migraciones controladas | **Solo aditivas** en fase 1. Ninguna columna o tabla se elimina |
| Pruebas obligatorias | Una funcionalidad no está terminada por abrir una pantalla |
| Integración frecuente | Cada sprint entrega algo ejecutable |
| **(nuevo) `src/models.rs` es contrato** | Cualquier cambio en `models.rs` requiere revisión de los tres, no solo del autor |
| **(nuevo) Aislamiento de configuración** | Ningún módulo lee variables de entorno salvo `config.rs`. Es la regla existente del proyecto y se mantiene |

### Definition of Done del equipo de desarrollo

Se adopta la del plan, con dos precisiones:

- [ ] Código integrado en la rama correspondiente.
- [ ] Pruebas pasan.
- [ ] No rompe funcionalidades existentes.
- [ ] Manejo de errores explícito.
- [ ] Funciona en el escenario offline **cuando corresponde, y el escenario está nombrado** (qué se probó: sin red, red intermitente, reconexión).
- [ ] Documentado.
- [ ] Revisado por otro integrante.
- [ ] **(nuevo)** Si toca `models.rs` o una migración, revisado por los tres.
- [ ] **(nuevo)** Si agrega un endpoint, la forma de respuesta está en este documento antes del merge.

---

## 8. Decisiones pendientes de los contratos

| # | Decisión | Responsable | Bloquea |
|---|---|---|---|
| 1 | ¿Firestore almacena registros educativos o solo comunitarios? | Dev 1 propone, equipo decide | Sprint 3 |
| 2 | ¿Firebase Authentication se adopta para administradores o se mantiene solo JWT del nodo? | Dev 1 propone, equipo decide | Sprint 3 |
| 3 | ¿Los usuarios se crean solo en el nodo o también en el centro? | Dev 2 + Dev 3 | Sprint 3 |
| 4 | ¿Las inscripciones son del nodo o del centro? | Dev 2 + Dev 3 | Sprint 4 |
| 5 | ¿Qué campos de una inquietud son visibles en el dashboard general? | Coordinación + Econova | Sprint 6 |
| 6 | Formato definitivo de la confirmación de lote | Dev 3 | Sprint 3 |

---

## 9. Registro de evidencia

Afirmaciones de estado verificadas por lectura del código en `edu-conect-rural-server/`:

- `src/models.rs:7-13` (`Curso`), `:25-31` (`Progreso`), `:35-37` (`ApiError`), `:58-65` (`AuthClaims`)
- `src/config.rs:17-49` (`jwt_secret_requerido`, con `SECRETOS_CONOCIDOS` y longitud mínima)
- `src/db.rs:369-395` (`initial_password_requerida`), `:1173` (prueba de rechazo sin `ADMIN_INITIAL_PASSWORD`)
- `src/auth.rs:33,58,139,158` (`AuthLayer`, `AuthMiddleware`, `create_token`, `decode_token`)
- `src/main.rs:322-425` (registro de rutas)
- `install.sh:180-199` (unidad systemd generada), `deploy/educonect.service`, `docker-compose.yml`, `.github/workflows/ci.yml`
- `docs/diagnostico-2026-11-25.md` (`DATA_DIR` frente a `DB_PATH`, CWD-relativo de `modulos/` y `static/`)

**No verificado:** comportamiento en hardware objetivo; que el servidor efectivamente ignore `DB_PATH` en la versión compilada actual (se toma del diagnóstico); estado real de la integración continua.
