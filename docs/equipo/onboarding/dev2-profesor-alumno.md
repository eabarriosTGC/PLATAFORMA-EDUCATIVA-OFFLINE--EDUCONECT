# Paquete de incorporación — DEV2

**Área:** flujos profesor–alumno, dominio educativo, accesibilidad.
**Unidad inicial:** **E-01 — flujos profesor-alumno y validación del dominio educativo.**
**Documento autocontenido.** No hace falta leer `.git/coordinacion/` para empezar. Si algo de esta
página y el código discrepan, **manda el código** y hay que corregir esta página.

**Referencias:** rutas relativas a la raíz del repositorio; los `archivo:línea` corresponden a la línea
base `educonect-baseline-v1` (`2858404`).

---

## 0. Qué NO podés hacer todavía

| Prohibición | Por qué |
|---|---|
| **No implementar esquemas definitivos** sin acuerdo conjunto | `E1–E12` es base de discusión |
| **No integrar contribuciones al producto** antes de aclarar el régimen de licencia | No hay `LICENSE` ni titularidad |
| **No tocar `src/models.rs`** | Contrato; revisión de los tres (S3) |
| **No tocar lo reservado por Codex** | Ver §7 — incluye `static/sw.js`, que decide qué se cachea |
| **No tocar `/api/profesor/*` ni `/api/progreso/*` en la PWA** | Deben quedar **sin caché** por política de privacidad vigente |
| Prototipos | Permitidos, **aislados**, sin integrarse |

---

## 1. Arquitectura frontend

**Stack:** Next.js **16.2.6**, React **19**, TypeScript 5.7, Tailwind **v4**
(`edu-conect-rural-dashboard/package.json:49,53,68-71`).

**Export estático sin runtime de servidor:** `output: "export"` y `trailingSlash`
(`next.config.mjs:8-9`). Y **`typescript.ignoreBuildErrors: true`** (`:3-5`): **los errores de tipo NO
bloquean el build**. Un tipo roto compila y llega a producción. Tenelo presente antes de confiar en
que «compila, entonces está bien».

**No hay router.** Hay una sola ruta y las vistas se cambian en memoria:

```ts
// lib/app-state.tsx:6
type ViewType = "dashboard" | "cursos" | "biblioteca" | "progreso"
              | "videos" | "youtube" | "profesores"
```

renderizadas por condicionales en `app/page.tsx:47-56`. Eso significa: **no hay URL por vista**, no se
puede enlazar a «el progreso de Juan», y el botón «atrás» del navegador no funciona como un docente
espera. Es un hallazgo de UX, no un detalle.

**Entradas:**

| Fichero | Rol |
|---|---|
| `app/layout.tsx` | `html lang="es"`, fuentes Inter + Space Grotesk, metadata (`:17-38`) |
| `app/page.tsx` | `DashboardPage` → `AppProvider` → `DashboardContent` (`:110-117`) |
| `lib/app-state.tsx` | `AppProvider` / `useAppState` (`:60-97`) |
| `lib/api.ts` | `API_BASE` (`:3`) |

**Estado:** **Context solamente.** Sin redux, zustand ni react-query. Incluye un **flag de rol falso**
`isTeacher` (`lib/app-state.tsx:65,78`) y `usuario = "estudiante"` hardcodeado (`:64`).

**Estilos:** variables CSS en OKLCH con variante `.dark` (`app/globals.css:4-77`); 58 ficheros
shadcn/Radix en `components/ui/`.

**Dos frontends conviven en el mismo proceso Rust:**

1. El export de Next, servido como `fallback_service(ServeDir(frontend_path))` (`src/main.rs:503`).
2. El **dashboard vanilla**: `static/dashboard.html` + `static/js/*` (`src/main.rs:409-412`).

Y `static/js/state.js:2` **duplica** `usuario` fuera de React. Cualquier cambio de identidad debe tocar
los dos o quedan divergentes sin que nadie lo note.

---

## 2. Arquitectura backend educativo

Todas las rutas se construyen en `fn app` (`src/main.rs:380`).

**Públicas, sin autenticación:**

| Ruta | Handler |
|---|---|
| `GET /api/cursos`, `GET /api/cursos/{id}` | `listar_cursos`, `obtener_curso` (`:413-414`) |
| `POST /api/progreso` | `guardar_progreso` (`:415`) |
| `GET /api/progreso/{usuario}` | `obtener_progreso_usuario` (`:416`) |
| `GET /api/quizzes` | `quiz_estudiante_listar` (`:423`) |
| `GET /api/quizzes/{id}/jugar` | `quiz_estudiante_obtener` (`:424`) |
| `POST /api/quizzes/{id}/responder` | `quiz_estudiante_responder` (`:425`) |

**Páginas:** `/profesor/` → `profesor_pagina`; `/profesor/quizzes/` → `profesor_quizzes_pagina`
(`:441-444`).

**Bajo `AuthLayer`, `nest("/api/profesor")`** (`:445-460`):

`/estudiantes` · `/progreso` · `/progreso/{usuario}` · `/reporte` · `/exportar` ·
`/quizzes` (listar, crear) · `/quizzes/importar` · `/quizzes/{id}` (obtener, actualizar, eliminar) ·
`/quizzes/{id}/publicacion` · `/quizzes/{id}/duplicar`

Handlers: `profesor_listar_estudiantes`, `profesor_progreso_completo`,
`profesor_progreso_estudiante`, `profesor_reporte`, `profesor_exportar_csv`, `quiz_listar`,
`quiz_crear`, `quiz_importar`, `quiz_obtener`, `quiz_actualizar`, `quiz_eliminar`, `quiz_publicar`,
`quiz_duplicar`.

---

## 3. Qué existe hoy, derivado del código (no de la documentación)

| Un docente puede | Un alumno puede |
|---|---|
| Autenticarse con la **única** credencial de admin del dispositivo (`admin_login`, `main.rs:1390+`; `static/profesor.html:590-603`) | Navegar cursos, biblioteca, módulos, videos, diccionario, Wikipedia |
| Ver estadísticas agregadas, nómina, progreso y exportar CSV | Responder quizzes publicados (`static/js/quizzes-estudiante.js:28-109`) |
| CRUD completo de quizzes + publicar, duplicar, importar y exportar JSON (`static/js/profesor-quizzes.js:16-27`) | Ver su propio progreso escribiendo un **nombre libre** (`progreso-view.tsx:10-33`) |

**Sólo UI, sin backend — no lo confundas con funcionalidad:**

| Elemento | Realidad |
|---|---|
| Vista «YouTube» | `/api/youtube` devuelve un **stub vacío** (`src/main.rs:428-430`) |
| «Gestionar Cursos» | reutiliza `CursosView`, que es de sólo lectura |
| Toggle de docente en el sidebar | `sidebar.tsx:92-99` llama `setIsTeacher`; **nadie lo lee en el servidor** |
| Módulo `quiz-601` | **no hace ni un `fetch`** |

**Dos cosas que un docente va a pedir el primer día y no existen:** ver un alumno concreto, y saber
quién es quién. La «nómina» se deriva de las filas de `progreso`, así que **un alumno que nunca escribió
progreso no existe para el sistema**.

---

## 4. Estado de cuestionarios y progreso

**Quizzes:** tabla `quizzes` (`migrations/005_quizzes.sql:1-11`) con las preguntas como **blob JSON**;
la columna `publicado` se agrega por migración-en-código (`src/db.rs:137-149`). **No hay datos
semilla.**

**Forma:**
- `Quiz { titulo, descripcion, tema, preguntas, propietario, … }`
- `PreguntaQuiz { type, text, options, items, answer, answers, time, accepted, min, max, tol }`
- seis tipos en `TIPOS` (`src/quiz.rs:5-45`)

**Corrección:** `Quiz::calificar` (`src/quiz.rs:113-135`); el porcentaje usa `checked_mul`/`checked_div`
(`:122-127`). Corrección por tipo en `respuesta_correcta` (`:137-180`).

**Los intentos NO se persisten.** `quiz_estudiante_responder` corrige en memoria y devuelve
`ResultadoQuiz`; el único rastro es `localStorage` (`static/js/quizzes-estudiante.js:102`, clave
`educonect_quiz_ultimo_<id>`). **Si el alumno cambia de dispositivo o borra datos del navegador, la nota
desaparece.** Eso es lo que `E7` (tabla `intentos` inmutable) viene a resolver, y es la razón por la que
no se puede «arreglar» el reporte del docente sin esquema nuevo.

**Progreso:** **una fila por `(usuario, curso)`** con `porcentaje` 0-100, UPSERT en `src/db.rs:231-266`;
esquema en `lib/types.ts:9-16`.

**Y el defecto de fondo:** el cliente lo escribe con **`0` literal** (`cursos-view.tsx:15`), y el avance
real por módulo vive en claves de `localStorage` (`modulos/cie-401/index.html:218`,
`modulos/cien-308/index.html:274-276`, `modulos/fin-401/index.html:286`) que **nunca llegan al
servidor**. RD-01B lo llama «progreso disperso»: tres verdades distintas sobre lo mismo.

---

## 5. Investigación RD-01B

Benchmark de UX y contenido sobre Kolibri, Studio, RACHEL, contentshell y KDS. Sin tocar archivos de
EduConect. Hallazgo central, verbatim:

> «El problema no es falta de contenido, sino **metadatos inconsistentes, identidad débil y progreso
> disperso** (servidor, `localStorage` por curso y `localStorage` por módulo).»

> «La mejor inversión UX no es migrar de framework: … unificar “continuar”, buscar con filtros,
> **persistir intentos**, ordenar la taxonomía y cerrar accesibilidad.»

Licencias: contentshell es CC BY-NC-SA 3.0; RACHEL5 y module-template **sin licencia** ⇒ sirven como
**patrones**, no como código a copiar.

**Abierto:** no hay ninguna validación con navegador real, lector de pantalla ni hardware, y la casilla
de aceptación está sin marcar. Es la parte de investigación con menos evidencia, y es tu área.

---

## 6. Brechas de accesibilidad (observadas en código)

| Brecha | Dónde |
|---|---|
| Sin skip link en ninguna de las dos cáscaras | `app/page.tsx:41-43`; `static/dashboard.html:191-206` |
| Toggle de docente sin estado para tecnologías de asistencia: `<button>` sin `aria-pressed` | `sidebar.tsx:92-99` |
| Checkbox de modo docente sin nombre accesible | `static/dashboard.html:181-186` |
| Pestañas con `role="tab"` y `aria-selected` pero **sin `tabpanel` ni `aria-controls`** | `static/profesor.html:465-468`, `:632-636` |
| Barras de progreso son `div` con ancho inline: sin `role="progressbar"` ni `aria-valuenow` | `progreso-view.tsx:163-170`; `modulos/quiz-601/index.html:171-196` |
| Feedback por `alert()` nativo, sin `aria-live` | `cursos-view.tsx:16-18` |
| Paleta fija que salta el tema ⇒ contraste en modo oscuro **no verificado** | `progreso-view.tsx:168`; `profesores-view.tsx:236,254` |
| `quiz-601`: etiquetas de 0,72–0,78 rem y grises `#808098`/`#9090A8` sobre `#1A1A2E`: riesgo de contraste; **cero `aria-*`** | `:378,:541,:567`; `:311,:332` |

**Lo que está bien y no hay que romper:** `video-grid.tsx:42-46` (`alt={video.title}`),
`video-modal.tsx:152,175,252` (aria-labels), `profesor.html:823-835` (`role="button" tabindex="0"` con
Enter/Espacio), `profesor.html:438-443` (inputs de login etiquetados).

**No existe auditoría de accesibilidad en `docs/`**: sólo una afirmación de marketing en
`docs/comparativa-alternativas.md:122-129`.

**Nota de contexto:** en aulas rurales el acceso puede ser una tablet compartida y un lector de
pantalla no es hipotético. Y `bg-green-500` para «aprobado» / `text-emerald-600` para «bien» es un
semáforo que **no distingue nada** para daltonismo: hoy el color es el único portador de la
información.

---

## 7. Dependencias con DEV1 (identidad) y archivos reservados por Codex

### Lo que hoy no existe y vos necesitás

| Necesidad | Estado |
|---|---|
| Tabla de usuarios | **no existe**; sólo `admin_usuarios` (`migrations/002_auth.sql`) |
| Roles | **no existen**; «Profesor = admin» (`static/profesor.html:590`) |
| Aula / grupo / membresía | **no existen**; especificados en `evidencias/RD-02A/MODELO-DOMINIO.md` §3.8-3.11 |
| Ledger de intentos | **no existe**; especificado en §3.16 |
| Separación de quizzes por docente | **no existe**: `propietario` = usuario admin (`src/db.rs`) |
| Alcance por institución/nodo | **no existe**: `/api/profesor/*` no tiene claims por usuario (`src/main.rs:459`) |

**Consecuencia:** sin DEV1 no hay «mi aula», y sin `intentos` no hay reporte que valga. E-01 tiene que
producir el **modelo de dominio validado**, no la pantalla.

**Inconsistencia de token que te afecta:** `localStorage` en Next (`profesores-view.tsx:23,69`) frente a
`sessionStorage` en el panel vanilla (`static/profesor.html:562,602`). Dos políticas de vida de sesión
en el mismo producto; unificarlas es una decisión compartida con DEV1.

### Reservado por Codex — no tocar

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

**Y la razón funcional que tenés que conocer:** por política de privacidad vigente, `/api/profesor/*` y
`/api/progreso/*` deben quedar **sin caché**. Si metés esas rutas en el service worker —aunque sea para
«mejorar la experiencia offline»— rompés la política y el dictamen de Codex.

### Otras superficies reservadas

`src/main.rs`, `src/config.rs`, `install.sh` (Persona C / D-03); `Dockerfile`, `docker-compose*.yml`,
`tests/fixtures/`, `.github/workflows/ci.yml`, `scripts/` (estabilización).

---

## 8. E-01 — tu primera unidad

**Objetivo:** validar el dominio educativo contra los flujos reales del docente y del alumno, y
producir las correcciones al modelo **antes** de que nadie escriba esquema. **Es diseño, no
implementación.**

**Entregable:** un documento que responda, con `archivo:línea`:

1. **Recorrido real del docente**, paso a paso, tal como el código lo permite hoy: qué puede hacer, qué
   cree que puede hacer y no puede, y en qué momento necesita identidad o intentos.
2. **Recorrido real del alumno**, con el mismo rigor, incluyendo qué se pierde al cambiar de
   dispositivo.
3. **Contraste con `E1–E12`**: para cada regla, ¿sirve al flujo observado, le falta algo o le sobra?
   Concretamente: ¿`E5` (asignación a un solo destino) cubre el caso «tarea para 4.º A excepto estos
   tres»? ¿`E6` (progreso monotónico) es correcto cuando un alumno reprueba?
4. **Taxonomía y metadatos**: qué campos de un contenido son realmente necesarios para que el docente
   encuentre algo (el «metadatos inconsistentes» de RD-01B).
5. **Brechas de accesibilidad priorizadas** por impacto real en el aula, no por checklist: cuáles
   bloquean una tarea y cuáles son cosméticas.
6. **Decisiones que necesitás de DEV1** para poder validar el dominio.
7. **Qué validación con usuarios reales falta** y cómo se haría sin datos personales.

**No escribas código de producto.** Prototipos aislados sí, y pantallas de prueba sin integrar.

---

## 9. Mapa de símbolos para arrancar

| Necesitás | Mirá |
|---|---|
| Vistas y navegación | `lib/app-state.tsx:6`, `app/page.tsx:47-56` |
| Cliente HTTP | `lib/api.ts:3` |
| Login del docente | `static/profesor.html:590-603`, `src/main.rs:1385-1392` |
| Rutas del docente | `src/main.rs:445-460` |
| Rutas del alumno | `src/main.rs:413-427` |
| Crear/listar quizzes | `src/db.rs` (`crear_quiz`, `listar_quizzes`, `listar_quizzes_estudiante`) |
| Corrección | `src/quiz.rs:113-180` |
| Esquema de quiz | `migrations/005_quizzes.sql:1-11` |
| Progreso (UPSERT) | `src/db.rs:231-266` |
| Nómina derivada de progreso | `src/db.rs:818-838` |
| Exportación CSV | `profesor_exportar_csv` (`src/main.rs`) |
| Vista de progreso | `progreso-view.tsx:10-33,163-170` |
| Vista de docentes | `profesores-view.tsx:44-58,218-260` |

## 10. Documentos que debés leer, en este orden

1. [`../contratos/modelo-educativo.md`](../contratos/modelo-educativo.md) — S1–S5 y E1–E12.
2. [`../agenda-decisiones-conjuntas.md`](../agenda-decisiones-conjuntas.md) — qué se decide y cuándo.
3. [`dev1-firebase.md`](dev1-firebase.md) — **tu dependencia**; leelo aunque no sea tuyo.
4. [`../licencias/inventario-decisiones.md`](../licencias/inventario-decisiones.md) — contenido NC,
   atribución y por qué no integrás todavía.
5. `odd/tasks/fase1-baseline-onboarding.md` — el estado de esta fase.
