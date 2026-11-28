# Documentación compartida del equipo — EduConect

Esta carpeta existe porque **el canal de coordinación no se versiona y los tres desarrolladores
pueden estar en equipos distintos**. Todo lo que un desarrollador necesita para trabajar
(arquitectura, contratos, tareas, acuerdos, referencias de investigación) vive aquí, en el
repositorio. Si algo sólo existe en `.git/coordinacion/`, no cuenta como transmitido.

`docs/equipo/` es la **fuente primaria** para las personas. `.git/coordinacion/` sigue siendo el
registro cronológico de mensajes entre agentes; no es el canal de incorporación.

## Índice

| Documento | Para qué |
|---|---|
| [`onboarding/dev1-firebase.md`](onboarding/dev1-firebase.md) | Paquete de incorporación de **DEV1** — Firebase, identidad, persistencia. Unidad inicial **F-01**. |
| [`onboarding/dev2-profesor-alumno.md`](onboarding/dev2-profesor-alumno.md) | Paquete de incorporación de **DEV2** — profesor/alumno, dominio educativo, accesibilidad. Unidad inicial **E-01**. |
| [`contratos/api-capacidades-v1.md`](contratos/api-capacidades-v1.md) | Contrato **D-05d** de `GET /api/capacidades`: forma, códigos cerrados, semántica HTTP, fallos y pruebas de aceptación. |
| [`contratos/api-capacidades-v1.schema.json`](contratos/api-capacidades-v1.schema.json) | El mismo contrato como JSON Schema ejecutable. |
| [`contratos/modelo-educativo.md`](contratos/modelo-educativo.md) | Reglas de coordinación **S1–S5** (aprobadas) y **E1–E12** (base de discusión, no esquema congelado). |
| [`agenda-decisiones-conjuntas.md`](agenda-decisiones-conjuntas.md) | Agenda de la revisión conjunta DEV1/DEV2/DEV3: qué se decide, quién decide y qué bloquea. |
| [`kiwix/rd02c-correcciones-documentales.md`](kiwix/rd02c-correcciones-documentales.md) | Las seis inconsistencias de la evidencia de RD-02C, con la lectura correcta. |
| [`kiwix/rd02c-propuesta-implementacion.md`](kiwix/rd02c-propuesta-implementacion.md) | Propuesta de implementación del lector separado en siete ejes. |
| [`kiwix/backlog-seguridad.md`](kiwix/backlog-seguridad.md) | Hallazgos de seguridad priorizados, con H3 al frente y la tarea independiente de protección del lector actual. |
| [`licencias/inventario-decisiones.md`](licencias/inventario-decisiones.md) | Inventario en cuatro categorías y decisiones jurídicas pendientes. |
| [`licencias/libzim.md`](licencias/libzim.md) | Resolución de la discrepancia de licencia de libzim por fuentes primarias. |

Documentos de fase en `odd/tasks/`:

| Documento | Estado |
|---|---|
| `odd/tasks/fase0-estabilizacion.md` | Fase 0 cerrada salvo T8 (ejecución del `.exe` en Windows real). |
| `odd/tasks/fase1-baseline-onboarding.md` | Esta fase: línea base verificable y habilitación del trabajo paralelo. |
| `odd/tasks/d05-perfiles-docker.md` | D-05a/b/c cerradas; D-05d contrato publicado, sin implementar; D-05e sin empezar. |

## Reglas de coordinación vigentes (S1–S5, aprobadas)

| ID | Regla | Por qué |
|---|---|---|
| **S1** | Cada desarrollador escribe `docs/equipo/onboarding/<nombre>.md` y lo mantiene al día **antes** de tocar código de producto. | Sin esto, la incorporación vuelve a depender de conversaciones no versionadas. |
| **S2** | Cada unidad declara su reserva de superficie en `odd/tasks/<ID>.md` **antes** de implementar. | La reserva es cooperativa, no un bloqueo del sistema de archivos. |
| **S3** | `src/models.rs` y toda migración requieren revisión de los tres. | Es el punto donde tres desarrolladores rompen compatibilidad sin darse cuenta. |
| **S4** | Un contrato nuevo se **presenta antes de implementar**, con forma, códigos cerrados y pruebas de aceptación. | Es el patrón de `pi-011`: se acuerda la forma, después se escribe el código. |
| **S5** | Nadie toca el árbol de trabajo de otro, ni hace `reset --hard`, `clean` o `stash` sobre trabajo ajeno. | Un `clean` ajeno borra horas de trabajo irrecuperable. |

## Reglas que no cambian

- **No se crea `LICENSE`** ni se cambia ninguna licencia sin autorización explícita.
- **No se integra** ninguna contribución al producto antes de aclarar el régimen de licencia.
- **No se hace merge** de implementaciones nuevas sin autorización.
- **No se publican** secretos, credenciales, datos personales ni rutas absolutas de máquinas
  personales en esta carpeta. Las referencias a archivos son relativas al repositorio.
- El contenido de terceros **sin autorización suficiente** queda fuera de cualquier distribución.

## Línea base

`educonect-baseline-v1` es una **línea base de desarrollo**, no una release de producción.

- Commit: `28584049de888db82aaa9ba9e1aeee55014b85bb` (= `origin/main` al momento de etiquetar).
- CI en ese commit: 6/6 en verde.
- Lo que **no** afirma: que T8 esté cumplida, que exista un ledger de migraciones, que haya licencia,
  que el contenido de terceros sea redistribuible, ni que esto sirva para producir.

Trabajar desde aquí significa: ramificar desde esta referencia, no desde una rama de estabilización.
